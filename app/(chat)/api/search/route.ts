// app/(chat)/api/search/route.ts
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { NextRequest } from "next/server";
import postgres from "postgres";
import { auth } from "@/app/(auth)/auth";
import { chat, message } from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "", {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  keep_alive: 1,
});
const db = drizzle(client);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const searchTerm = `%${q}%`;

  // Recherche dans les titres des chats
  const titleMatches = await db
    .select({
      chatId: chat.id,
      chatTitle: chat.title,
      chatCreatedAt: chat.createdAt,
    })
    .from(chat)
    .where(
      and(eq(chat.userId, session.user.id), ilike(chat.title, searchTerm))
    )
    .orderBy(desc(chat.createdAt))
    .limit(30);

  // Recherche dans les messages
  const messageMatches = await db
    .select({
      chatId: chat.id,
      chatTitle: chat.title,
      chatCreatedAt: chat.createdAt,
      matchContent: message.parts,
      messageCreatedAt: message.createdAt,
      messageId: message.id,
    })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(
      and(
        eq(chat.userId, session.user.id),
        sql`${message.parts}::text ILIKE ${searchTerm}`
      )
    )
    .orderBy(desc(message.createdAt))
    .limit(50);

  // Groupement par chat
  const groupedByChat = new Map<
    string,
    {
      chatId: string;
      chatTitle: string;
      chatCreatedAt: Date;
      titleMatch: string | null;
      messageSnippets: { snippet: string; createdAt: Date }[];
    }
  >();

  // Ajouter les titres
  for (const match of titleMatches) {
    const chatIdStr = match.chatId;
    if (!groupedByChat.has(chatIdStr)) {
      groupedByChat.set(chatIdStr, {
        chatId: chatIdStr,
        chatTitle: match.chatTitle,
        chatCreatedAt: match.chatCreatedAt,
        titleMatch: null,
        messageSnippets: [],
      });
    }
    groupedByChat.get(chatIdStr)!.titleMatch = match.chatTitle;
  }

  // Ajouter les messages
  for (const match of messageMatches) {
    const chatIdStr = match.chatId;
    if (!groupedByChat.has(chatIdStr)) {
      groupedByChat.set(chatIdStr, {
        chatId: chatIdStr,
        chatTitle: match.chatTitle,
        chatCreatedAt: match.chatCreatedAt,
        titleMatch: null,
        messageSnippets: [],
      });
    }

    const group = groupedByChat.get(chatIdStr)!;
    const content = extractTextFromParts(match.matchContent);
    if (
      content &&
      content.toLowerCase().includes(q.toLowerCase()) &&
      !group.messageSnippets.some((m) => m.snippet === content)
    ) {
      group.messageSnippets.push({
        snippet: extractSnippet(content, q, 80),
        createdAt: match.messageCreatedAt,
      });
    }
  }

  // Trier par date de chat décroissante
  const results = Array.from(groupedByChat.values())
    .filter(
      (group) =>
        group.titleMatch !== null || group.messageSnippets.length > 0
    )
    .sort(
      (a, b) =>
        new Date(b.chatCreatedAt).getTime() -
        new Date(a.chatCreatedAt).getTime()
    )
    .map((group) => ({
      chatId: group.chatId,
      chatTitle: group.chatTitle,
      chatCreatedAt: group.chatCreatedAt,
      titleMatch: group.titleMatch,
      messageSnippets: group.messageSnippets.slice(0, 5),
    }));

  return Response.json({ results });
}

function extractTextFromParts(parts: unknown): string {
  try {
    if (Array.isArray(parts)) {
      return parts
        .map((part: { type?: string; text?: string }) =>
          part.type === "text" ? part.text || "" : ""
        )
        .join(" ");
    }
    if (typeof parts === "string") return parts;
    return JSON.stringify(parts);
  } catch {
    return "";
  }
}

function extractSnippet(
  content: string,
  query: string,
  contextChars: number
): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) return content.slice(0, contextChars * 2);

  const start = Math.max(0, index - contextChars);
  const end = Math.min(
    content.length,
    index + query.length + contextChars
  );

  let snippet = content.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";

  return snippet;
}