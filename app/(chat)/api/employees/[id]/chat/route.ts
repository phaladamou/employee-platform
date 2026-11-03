// app/(chat)/api/employees/[id]/chat/route.ts
// Discussion Engineering : reponse LLM reelle + missions executees
// pour de vrai via le noyau (in-process, dev-first).
// Persistance : chaque message (user + assistant) est stocke dans
// Message_v2 sur le fil (user, employe) ; le GET recharge
// l'historique apres rechargement de page.
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  createMission,
  getEmployeeById,
  getEmployeeChat,
  getMessagesByChatId,
  getOrCreateEmployeeChat,
  requireAccountId,
  saveEmployeeMessage,
  updateMission,
} from "@/lib/db/queries";
import { isMissionStatus } from "@/lib/employees/catalog";
import { streamEmployeeReply } from "@/lib/server/employee-chat-stream";
import {
  partsToText,
  toDisplayRole,
} from "@/lib/server/employee-conversation-mapping";
import {
  chatWithEmployee,
  runWebMission,
} from "@/lib/server/run-web-mission";

// Enveloppe un flux texte : octets transmis tels quels, texte
// integral sauvegarde a la fin (ou a l'annulation : ce qui a ete
// recu). La sauvegarde ne casse jamais le flux (log seule).
function persistStreamBody(
  upstream: ReadableStream<Uint8Array>,
  onComplete: (text: string) => Promise<void>
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let received = "";
  let saved = false;
  const finish = async () => {
    if (saved) {
      return;
    }
    saved = true;
    if (!received) {
      return;
    }
    try {
      await onComplete(received);
    } catch (error) {
      console.error("Employee chat stream persist error:", error);
    }
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await finish();
          return;
        }
        received += decoder.decode(value, { stream: true });
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
      void finish();
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing employee" }, { status: 400 });
  }
  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    // Lecture seule : aucun fil cree quand on n'a jamais discute.
    const conversation = await getEmployeeChat(session.user.id, id);
    if (!conversation) {
      return NextResponse.json({ messages: [] });
    }
    const rows = await getMessagesByChatId({ id: conversation.id });
    return NextResponse.json({
      messages: rows.map((row) => ({
        id: row.id,
        role: toDisplayRole(row.role),
        text: partsToText(row.parts),
        missionId: row.missionId,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/employees/[id]/chat Error:", error);
    return NextResponse.json(
      { error: "Failed to load employee chat" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing employee" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const asMission = body.asMission === true;
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    const conversation = await getOrCreateEmployeeChat({
      userId: session.user.id,
      employeeId: id,
      title: target.name,
    });
    await saveEmployeeMessage({
      chatId: conversation.id,
      role: "user",
      text: message,
    });

    if (!asMission) {
      const url = new URL(request.url);
      if (url.searchParams.get("stream") === "1") {
        try {
          const upstream = await streamEmployeeReply({
            name: target.name,
            role: target.role,
            message,
          });
          if (!upstream.body) {
            throw new Error("LLM stream has no body");
          }
          return new Response(
            persistStreamBody(upstream.body, (text) =>
              saveEmployeeMessage({
                chatId: conversation.id,
                role: "assistant",
                text,
              }).then(() => undefined)
            ),
            { headers: upstream.headers }
          );
        } catch (error) {
          console.error("POST /api/employees/[id]/chat Stream Error:", error);
          return NextResponse.json(
            { error: "Chat unavailable" },
            { status: 500 }
          );
        }
      }
      try {
        const reply = await chatWithEmployee({
          employeeName: target.name,
          employeeRole: target.role,
          message,
        });
        await saveEmployeeMessage({
          chatId: conversation.id,
          role: "assistant",
          text: reply,
        });
        return NextResponse.json({ reply });
      } catch (error) {
        console.error("POST /api/employees/[id]/chat LLM Error:", error);
        return NextResponse.json({ error: "Chat unavailable" }, { status: 500 });
      }
    }

    const [created] = await createMission({
      accountId,
      employeeId: id,
      title: message.slice(0, 80),
      prompt: message,
    });
    if (!created) {
      throw new Error("insert returned no row");
    }
    await updateMission({
      accountId,
      missionId: created.id,
      patch: { status: "running" },
    });

    try {
      const outcome = await runWebMission({
        userId: session.user.id,
        employeeId: id,
        employeeName: target.name,
        employeeRole: target.role,
        talentSpec: target.talentSpec,
        specVersion: target.specVersion,
        prompt: message,
      });
      const updated = await updateMission({
        accountId,
        missionId: created.id,
        patch: {
          status: outcome.status,
          report: outcome.summary || null,
          toolCalls: outcome.toolCalls,
        },
      });
      // Reponse de mission dans le fil (texte vide + missionId =
      // needs_acceptance, libelle rendu cote client).
      await saveEmployeeMessage({
        chatId: conversation.id,
        role: "assistant",
        text: outcome.summary,
        missionId: created.id,
      });
      const row = updated ?? created;
      return NextResponse.json(
        {
          mission: {
            id: row.id,
            title: row.title,
            status: isMissionStatus(row.status) ? row.status : "queued",
            employeeId: row.employeeId,
          },
          summary: outcome.summary,
          needsAcceptance: outcome.needsAcceptance,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("POST /api/employees/[id]/chat Run Error:", error);
      const detail = String(
        error instanceof Error ? error.message : error
      ).slice(0, 500);
      const failed = await updateMission({
        accountId,
        missionId: created.id,
        patch: { status: "failed", report: detail },
      });
      await saveEmployeeMessage({
        chatId: conversation.id,
        role: "assistant",
        text: detail,
        missionId: created.id,
      });
      const row = failed ?? created;
      return NextResponse.json(
        {
          mission: {
            id: row.id,
            title: row.title,
            status: "failed",
            employeeId: row.employeeId,
          },
          summary: detail,
          needsAcceptance: false,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("POST /api/employees/[id]/chat Error:", error);
    return NextResponse.json(
      { error: "Failed to chat with employee" },
      { status: 500 }
    );
  }
}
