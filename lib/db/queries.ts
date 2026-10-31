// lib/db/queries.ts
import "server-only";

import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import type { ArtifactKind } from "@/components/workspace/artifact";
import type { VisibilityType } from "@/components/workspace/visibility-selector";
import { ChatbotError } from "../errors";
import type { TalentSeed } from "../employees/talents";
import {
  account,
  type Chat,
  chat,
  type DBMessage,
  connector,
  type Department,
  department,
  document,
  type Employee,
  employee,
  message,
  type Mission,
  mission,
  notification,
  type Suggestion,
  stream,
  suggestion,
  type TalentProfile,
  talentProfile,
  type User,
  user,
  userSettings,
  vote,
} from "./schema";
import { getDb } from "./client";
import { generateHashedPassword } from "./utils";

export async function getUser(email: string): Promise<User[]> {
  try {
    const db = await getDb();
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    console.error("getUser DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    const db = await getDb();
    return await db.insert(user).values({ email, password: hashedPassword } as any);
  } catch (_error) {
    console.error("createUser DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    const db = await getDb();
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    } as any);
  } catch (_error) {
    console.error("saveChat DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    const db = await getDb();
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    console.error("deleteChatById DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const db = await getDb();
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    console.error("deleteAllChatsByUserId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const db = await getDb();
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    console.error("getChatsByUserId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const db = await getDb();
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    console.error("getChatById DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    const db = await getDb();
    return await db.insert(message).values(messages as any);
  } catch (_error) {
    console.error("saveMessages DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    const db = await getDb();
    return await db.update(message).set({ parts } as any).where(eq(message.id, id));
  } catch (_error) {
    console.error("updateMessage DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    console.error("getMessagesByChatId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const db = await getDb();
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" } as any)
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    } as any);
  } catch (_error) {
    console.error("voteMessage DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    const db = await getDb();
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    console.error("getVotesByChatId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  chatId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  chatId?: string;
}) {
  try {
    const db = await getDb();
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind: kind as "image" | "text" | "code" | "sheet",
        content,
        userId,
        chatId: chatId ?? null,
        createdAt: new Date(),
      } as any)
      .returning();
  } catch (_error) {
    console.error("saveDocument DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const db = await getDb();
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content } as any)
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    console.error("updateDocumentContent DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const db = await getDb();
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    console.error("getDocumentsById DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const db = await getDb();
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    console.error("getDocumentById DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    const db = await getDb();
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    console.error("deleteDocumentsByIdAfterTimestamp DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    const db = await getDb();
    return await db.insert(suggestion).values(suggestions as any);
  } catch (_error) {
    console.error("saveSuggestions DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    console.error("getSuggestionsByDocumentId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    const db = await getDb();
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    console.error("getMessageById DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const db = await getDb();
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    console.error("deleteMessagesByChatIdAfterTimestamp DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    const db = await getDb();
    return await db.update(chat).set({ visibility } as any).where(eq(chat.id, chatId));
  } catch (_error) {
    console.error("updateChatVisibilityById DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    const db = await getDb();
    return await db.update(chat).set({ title } as any).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const db = await getDb();
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    console.error("getMessageCountByUserId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    const db = await getDb();
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() } as any);
  } catch (_error) {
    console.error("createStreamId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const db = await getDb();
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();
    return streamIds.map(({ id }) => id);
  } catch (_error) {
    console.error("getStreamIdsByChatId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

export async function getUserStats({ userId }: { userId: string }) {
  try {
    const db = await getDb();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalChatsResult] = await db
      .select({ count: count(chat.id) })
      .from(chat)
      .where(eq(chat.userId, userId));

    const [chatsThisMonthResult] = await db
      .select({ count: count(chat.id) })
      .from(chat)
      .where(and(eq(chat.userId, userId), gte(chat.createdAt, startOfMonth)));

    const [totalMessagesResult] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(chat.userId, userId), eq(message.role, "user")));

    const [messagesThisMonthResult] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          eq(message.role, "user"),
          gte(message.createdAt, startOfMonth)
        )
      );

    const messagesLastHour = await getMessageCountByUserId({
      id: userId,
      differenceInHours: 1,
    });

    const [totalDocumentsResult] = await db
      .select({ count: count(document.id) })
      .from(document)
      .where(eq(document.userId, userId));

    return {
      totalChats: totalChatsResult?.count ?? 0,
      chatsThisMonth: chatsThisMonthResult?.count ?? 0,
      totalMessages: totalMessagesResult?.count ?? 0,
      messagesThisMonth: messagesThisMonthResult?.count ?? 0,
      messagesLastHour,
      totalDocuments: totalDocumentsResult?.count ?? 0,
    };
  } catch (_error) {
    console.error("getUserStats DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to get user stats");
  }
}

export async function deleteUserById({ userId }: { userId: string }) {
  try {
    const db = await getDb();
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length > 0) {
      const chatIds = userChats.map((c) => c.id);
      await db.delete(vote).where(inArray(vote.chatId, chatIds));
      await db.delete(message).where(inArray(message.chatId, chatIds));
      await db.delete(stream).where(inArray(stream.chatId, chatIds));
      await db.delete(chat).where(eq(chat.userId, userId));
    }

    const userDocs = await db
      .select({ id: document.id })
      .from(document)
      .where(eq(document.userId, userId));

    if (userDocs.length > 0) {
      const docIds = userDocs.map((d) => d.id);
      await db.delete(suggestion).where(inArray(suggestion.documentId, docIds));
      await db.delete(document).where(eq(document.userId, userId));
    }

    await db.delete(user).where(eq(user.id, userId));

    return { success: true };
  } catch (_error) {
    console.error("deleteUserById DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to delete user");
  }
}

export async function getUserSettings({ userId }: { userId: string }) {
  try {
    const db = await getDb();
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return settings ?? null;
  } catch (_error) {
    console.error("getUserSettings DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user settings"
    );
  }
}

export async function upsertUserSettings({
  userId,
  preferences,
}: {
  userId: string;
  preferences: Record<string, unknown>;
}) {
  try {
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    if (existing) {
      return await db
        .update(userSettings)
        .set({ preferences, updatedAt: new Date() } as any)
        .where(eq(userSettings.userId, userId))
        .returning();
    }

    return await db
      .insert(userSettings)
      .values({ userId, preferences } as any)
      .returning();
  } catch (_error) {
    console.error("upsertUserSettings DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to upsert user settings"
    );
  }
}

export async function updateUserProfile({
  userId,
  name,
  bio,
  image,
}: {
  userId: string;
  name?: string;
  bio?: string;
  image?: string;
}) {
  try {
    const db = await getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (image !== undefined) updates.image = image;

    return await db
      .update(user)
      .set(updates as any)
      .where(eq(user.id, userId))
      .returning();
  } catch (_error) {
    console.error("updateUserProfile DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update user profile"
    );
  }
}

export async function getDocumentsByUserId({ userId }: { userId: string }) {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(document)
      .where(eq(document.userId, userId))
      .orderBy(desc(document.createdAt));
  } catch (_error) {
    console.error("getDocumentsByUserId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by user id"
    );
  }
}

export async function getChatIdByDocumentId({ documentId, userId }: { documentId: string; userId: string }) {
  try {
    const db = await getDb();
    const messages = await db
      .select({ id: message.id, chatId: message.chatId, parts: message.parts })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(eq(chat.userId, userId));

    for (const msg of messages) {
      const parts = msg.parts as any[];
      if (!parts) continue;
      const hasDocument = parts.some((p: any) => {
        const output = p?.output;
        return output?.id === documentId || p?.documentId === documentId;
      });
      if (hasDocument) {
        return { chatId: msg.chatId };
      }
    }

    return { chatId: null };
  } catch (_error) {
    console.error("getChatIdByDocumentId DB Error:", _error);
    return { chatId: null };
  }
}

export async function getConnectorsByUserId({ userId }: { userId: string }) {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(connector)
      .where(eq(connector.userId, userId));
  } catch (error) {
    console.error("getConnectorsByUserId DB Error:", error);
    throw error;
  }
}

export async function getConnector({
  userId,
  provider,
}: {
  userId: string;
  provider: string;
}) {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(connector)
      .where(and(eq(connector.userId, userId), eq(connector.provider, provider)));
  } catch (error) {
    console.error("getConnector DB Error:", error);
    throw error;
  }
}

export async function upsertConnector({
  userId,
  provider,
  accessToken,
  refreshToken,
  expiresAt,
  scope,
}: {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
}) {
  try {
    const db = await getDb();
    const existing = await getConnector({ userId, provider });

    if (existing.length > 0) {
      return await db
        .update(connector)
        .set({
          accessToken,
          refreshToken: refreshToken ?? null,
          expiresAt: expiresAt ?? null,
          scope: scope ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(connector.userId, userId), eq(connector.provider, provider))
        );
    }

    return await db.insert(connector).values({
      userId,
      provider,
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAt ?? null,
      scope: scope ?? null,
    });
  } catch (error) {
    console.error("upsertConnector DB Error:", error);
    throw error;
  }
}

export async function deleteConnector({
  userId,
  provider,
}: {
  userId: string;
  provider: string;
}) {
  try {
    const db = await getDb();
    return await db
      .delete(connector)
      .where(and(eq(connector.userId, userId), eq(connector.provider, provider)));
  } catch (error) {
    console.error("deleteConnector DB Error:", error);
    throw error;
  }
}
export async function getNotificationsByUserId({
  userId,
  limit = 50,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
  } catch (_error) {
    console.error("getNotificationsByUserId DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get notifications"
    );
  }
}

export async function getUnreadNotificationsCount({
  userId,
}: {
  userId: string;
}) {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ count: count(notification.id) })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
    return row?.count ?? 0;
  } catch (_error) {
    console.error("getUnreadNotificationsCount DB Error:", _error);
    return 0;
  }
}

export async function createNotification({
  userId,
  type,
  provider,
  title,
  body,
}: {
  userId: string;
  type: string;
  provider?: string | null;
  title: string;
  body?: string | null;
}) {
  try {
    const db = await getDb();
    return await db.insert(notification).values({
      userId,
      type,
      provider: provider ?? null,
      title,
      body: body ?? null,
    });
  } catch (_error) {
    console.error("createNotification DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create notification"
    );
  }
}

export async function markAllNotificationsAsRead({
  userId,
}: {
  userId: string;
}) {
  try {
    const db = await getDb();
    return await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  } catch (_error) {
    console.error("markAllNotificationsAsRead DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to mark notifications as read"
    );
  }
}

// ============ MODULE EMPLOYEES (departements + employes IA) ============

export async function getDepartments(): Promise<Department[]> {
  try {
    const db = await getDb();
    return await db.select().from(department).orderBy(asc(department.id));
  } catch (_error) {
    console.error("getDepartments DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get departments"
    );
  }
}

// ============ MODULE MULTI-TENANT (isolation stricte par compte) ============
//
// Regle absolue : aucune requete metier ci-dessous ne lit ni n'ecrit
// sans accountId. Les seules lectures globales sont le referentiel
// partage (departements, catalogue des talents).

export const CHEF_PROFILE = {
  name: "Chef",
  role: "Manager",
  departmentId: "operations",
  background:
    "Your team's manager. Coordinates your AI employees, routes work to the right specialist, and helps you get started.",
  createdBy: "Cofoundator",
} as const;

export async function getAccountIdForUser(
  userId: string
): Promise<string | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ accountId: user.accountId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.accountId ?? null;
  } catch (_error) {
    console.error("getAccountIdForUser DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get account for user"
    );
  }
}

// Cree le compte + le Chef + son chat d'accueil. Idempotent et sur
// contre les appels concurrents : un seul gagnant pose le accountId
// (UPDATE atomique), les perdants relisent le compte existant.
export async function ensureAccountProvisioned(
  userId: string
): Promise<string> {
  try {
    const db = await getDb();
    const candidate = randomUUID();
    const claimed = await db
      .update(user)
      .set({ accountId: candidate })
      .where(and(eq(user.id, userId), isNull(user.accountId)))
      .returning({ id: user.id });

    if (claimed.length > 0) {
      const [owner] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      await db
        .insert(account)
        .values({ id: candidate, name: owner?.email ?? "My team" });
      await db.insert(employee).values({
        accountId: candidate,
        kind: "chef",
        status: "idle",
        ...CHEF_PROFILE,
      });
      await db.insert(chat).values({
        userId,
        title: CHEF_PROFILE.name,
        createdAt: new Date(),
      });
      return candidate;
    }

    const [row] = await db
      .select({ accountId: user.accountId, email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) {
      throw new ChatbotError(
        "bad_request:database",
        "User not found for provisioning"
      );
    }
    // Auto-guerison : ligne Account manquante (crash entre UPDATE et
    // INSERT) ou Chef manquant -> recrees sans doublon.
    await db
      .insert(account)
      .values({ id: row.accountId, name: row.email })
      .onConflictDoNothing();
    await ensureChefForAccount(row.accountId);
    return row.accountId;
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    console.error("ensureAccountProvisioned DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to provision account"
    );
  }
}

// Garantit le Chef du compte (creation sous verrou transactionnel).
export async function ensureChefForAccount(
  accountId: string
): Promise<string> {
  try {
    const db = await getDb();
    const [existing] = await db
      .select({ id: employee.id })
      .from(employee)
      .where(
        and(eq(employee.accountId, accountId), eq(employee.kind, "chef"))
      )
      .limit(1);
    if (existing) return existing.id;

    const [created] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT 1 FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`
      );
      const [locked] = await tx
        .select({ id: employee.id })
        .from(employee)
        .where(
          and(eq(employee.accountId, accountId), eq(employee.kind, "chef"))
        )
        .limit(1);
      if (locked) return [locked];
      return await tx
        .insert(employee)
        .values({
          accountId,
          kind: "chef",
          status: "idle",
          ...CHEF_PROFILE,
        })
        .returning({ id: employee.id });
    });
    if (!created) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to create Chef employee"
      );
    }
    return created.id;
  } catch (_error) {
    if (_error instanceof ChatbotError) throw _error;
    console.error("ensureChefForAccount DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to ensure Chef");
  }
}

// Point d'entree de scoping pour les routes : resout le compte de
// l'utilisateur connecte, en le provisionnant si besoin.
export async function requireAccountId(userId: string): Promise<string> {
  const existing = await getAccountIdForUser(userId);
  if (existing) {
    await ensureChefForAccount(existing);
    return existing;
  }
  return ensureAccountProvisioned(userId);
}

export async function getEmployeesByAccount(
  accountId: string
): Promise<Employee[]> {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(employee)
      .where(eq(employee.accountId, accountId))
      .orderBy(asc(employee.hiredAt), asc(employee.createdAt));
  } catch (_error) {
    console.error("getEmployeesByAccount DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get account employees"
    );
  }
}

// Lecture ownership-checkee : un id d'un autre compte -> null
// (meme en modifiant l'URL).
export async function getEmployeeById(
  accountId: string,
  employeeId: string
): Promise<Employee | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(employee)
      .where(
        and(eq(employee.id, employeeId), eq(employee.accountId, accountId))
      )
      .limit(1);
    return row ?? null;
  } catch (_error) {
    console.error("getEmployeeById DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get employee"
    );
  }
}

export async function getHiredTalentSpecs(
  accountId: string
): Promise<string[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({ talentSpec: employee.talentSpec })
      .from(employee)
      .where(eq(employee.accountId, accountId));
    return rows
      .map((row) => row.talentSpec)
      .filter((spec): spec is string => spec !== null);
  } catch (_error) {
    console.error("getHiredTalentSpecs DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get hired talents"
    );
  }
}

// Instancie un talent du catalogue pour le compte. Contrainte unique
// (accountId, talentSpec) : un talent = une instance par compte.
export async function hireEmployee({
  accountId,
  talent,
}: {
  accountId: string;
  talent: TalentSeed;
}): Promise<Employee[]> {
  try {
    const db = await getDb();
    return await db
      .insert(employee)
      .values({
        accountId,
        kind: "hired",
        talentSpec: talent.spec,
        specVersion: talent.version,
        name: talent.name,
        role: talent.role,
        status: "idle",
        departmentId: talent.departmentId,
        background: talent.background,
        createdBy: talent.createdBy,
        technologies: talent.technologies,
      })
      .returning();
  } catch (_error) {
    console.error("hireEmployee DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to hire employee");
  }
}

// Referentiel partage : lecture globale volontaire (meme catalogue
// pour tous les comptes).
export async function getTalentProfiles(): Promise<TalentProfile[]> {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(talentProfile)
      .orderBy(asc(talentProfile.departmentId), asc(talentProfile.name));
  } catch (_error) {
    console.error("getTalentProfiles DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get talent catalog"
    );
  }
}

export async function getTalentBySpec(
  spec: string
): Promise<TalentProfile | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(talentProfile)
      .where(eq(talentProfile.spec, spec))
      .limit(1);
    return row ?? null;
  } catch (_error) {
    console.error("getTalentBySpec DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to get talent");
  }
}

// ============ MODULE MISSIONS (suivi ownership-checke) ============

export async function createMission({
  accountId,
  employeeId,
  title,
  prompt,
  expectFile,
  expectTest,
}: {
  accountId: string;
  employeeId: string;
  title: string;
  prompt: string;
  expectFile?: string;
  expectTest?: boolean;
}): Promise<Mission[]> {
  try {
    const db = await getDb();
    return await db
      .insert(mission)
      .values({
        accountId,
        employeeId,
        title,
        prompt,
        expectFile: expectFile ?? null,
        expectTest: expectTest ?? false,
      })
      .returning();
  } catch (_error) {
    console.error("createMission DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to create mission");
  }
}

export async function getMissionsByAccount(
  accountId: string
): Promise<Mission[]> {
  try {
    const db = await getDb();
    return await db
      .select()
      .from(mission)
      .where(eq(mission.accountId, accountId))
      .orderBy(desc(mission.createdAt));
  } catch (_error) {
    console.error("getMissionsByAccount DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get account missions"
    );
  }
}

export async function getMissionById(
  accountId: string,
  missionId: string
): Promise<Mission | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(mission)
      .where(and(eq(mission.id, missionId), eq(mission.accountId, accountId)))
      .limit(1);
    return row ?? null;
  } catch (_error) {
    console.error("getMissionById DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to get mission");
  }
}

export async function updateMission({
  accountId,
  missionId,
  patch,
}: {
  accountId: string;
  missionId: string;
  patch: {
    status?: string;
    report?: string | null;
    kernelJobId?: string | null;
  };
}): Promise<Mission | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .update(mission)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(mission.id, missionId), eq(mission.accountId, accountId)))
      .returning();
    return row ?? null;
  } catch (_error) {
    console.error("updateMission DB Error:", _error);
    throw new ChatbotError("bad_request:database", "Failed to update mission");
  }
}

// Premier chat de l'utilisateur = le chat d'accueil du Chef (cree au
// provisioning, avant tout autre chat possible).
export async function getFirstChatIdForUser(
  userId: string
): Promise<string | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId))
      .orderBy(asc(chat.createdAt))
      .limit(1);
    return row?.id ?? null;
  } catch (_error) {
    console.error("getFirstChatIdForUser DB Error:", _error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get first chat"
    );
  }
}
