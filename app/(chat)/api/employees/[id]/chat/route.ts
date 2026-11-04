// app/(chat)/api/employees/[id]/chat/route.ts
// Discussion Engineering : reponse LLM reelle + missions executees
// pour de vrai via le noyau (in-process, dev-first).
// Persistance multi-sessions : ?session=<id> cible une session,
// absent = derniere session (GET) ou nouvelle session (POST).
// Missions : ?stream=1 renvoie les evenements live en NDJSON
// (thinking, etapes titre agent, resultats) puis une ligne `done`
// avec la charge utile habituelle ; sinon reponse JSON bloquante.
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { InMemoryJobSignal } from "@/core/employee/jobs/job-signal";
import type { ReactLoopEventHandler } from "@/core/employee/runtime/react-loop";
import {
  createEmployeeSession,
  createMission,
  getEmployeeById,
  getEmployeeSession,
  getEmployeeSessions,
  getMessagesByChatId,
  requireAccountId,
  saveEmployeeMessage,
  titleSessionFromFirstMessage,
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
  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }
    // Lecture seule : aucune session creee ici.
    const wanted = new URL(request.url).searchParams.get("session");
    if (wanted) {
      const conversation = await getEmployeeSession(
        session.user.id,
        id,
        wanted
      );
      if (!conversation) {
        return NextResponse.json(
          { error: "Unknown session" },
          { status: 404 }
        );
      }
      const rows = await getMessagesByChatId({ id: conversation.id });
      return NextResponse.json({
        sessionId: conversation.id,
        messages: rows.map((row) => ({
          id: row.id,
          role: toDisplayRole(row.role),
          text: partsToText(row.parts),
          missionId: row.missionId,
          createdAt: row.createdAt.toISOString(),
        })),
      });
    }
    const sessions = await getEmployeeSessions(session.user.id, id);
    const latest = sessions[0] ?? null;
    if (!latest) {
      return NextResponse.json({ sessionId: null, messages: [] });
    }
    const rows = await getMessagesByChatId({ id: latest.id });
    return NextResponse.json({
      sessionId: latest.id,
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
    // Session ciblee ou nouvelle session (jamais de reutilisation
    // implicite : sans ?session=, le POST ouvre un nouveau fil).
    const url = new URL(request.url);
    const wanted = url.searchParams.get("session");
    const conversation = wanted
      ? await getEmployeeSession(session.user.id, id, wanted)
      : await createEmployeeSession({
          userId: session.user.id,
          employeeId: id,
        });
    if (!conversation) {
      return NextResponse.json({ error: "Unknown session" }, { status: 404 });
    }
    await saveEmployeeMessage({
      chatId: conversation.id,
      role: "user",
      text: message,
    });
    await titleSessionFromFirstMessage({
      chatId: conversation.id,
      text: message,
    });

    if (!asMission) {
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
            {
              headers: {
                ...Object.fromEntries(upstream.headers),
                "x-employee-session": conversation.id,
              },
            }
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
        return NextResponse.json({ reply, sessionId: conversation.id });
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

    // Execution + persistance partagees par les deux reponses
    // (JSON bloquante et NDJSON) : meme charge utile terminale.
    const cancelSignal = new InMemoryJobSignal();
    const runAndPersist = async (onEvent?: ReactLoopEventHandler) => {
      const outcome = await runWebMission({
        userId: session.user.id,
        employeeId: id,
        employeeName: target.name,
        employeeRole: target.role,
        talentSpec: target.talentSpec,
        specVersion: target.specVersion,
        prompt: message,
        onEvent,
        signal: onEvent ? cancelSignal : undefined,
      }).catch((error) => {
        console.error("POST /api/employees/[id]/chat Run Error:", error);
        return {
          status: "failed" as const,
          summary: String(
            error instanceof Error ? error.message : error
          ).slice(0, 500),
          needsAcceptance: false,
          toolCalls: [],
        };
      });
      try {
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
        return {
          mission: {
            id: row.id,
            title: row.title,
            status: isMissionStatus(row.status) ? row.status : "queued",
            employeeId: row.employeeId,
          },
          summary: outcome.summary,
          needsAcceptance: outcome.needsAcceptance,
        };
      } catch (error) {
        // La persistance ne doit jamais avaler le resultat : la
        // ligne `done` part quand meme (l'historique manquera,
        // l'utilisateur a sa reponse, l'erreur est loguee).
        console.error("POST /api/employees/[id]/chat Persist Error:", error);
        return {
          mission: {
            id: created.id,
            title: created.title,
            status: outcome.status,
            employeeId: created.employeeId,
          },
          summary: outcome.summary,
          needsAcceptance: outcome.needsAcceptance,
        };
      }
    };

    if (url.searchParams.get("stream") === "1") {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const writeLine = (value: unknown) =>
        writer.write(encoder.encode(`${JSON.stringify(value)}\n`));
      // Deconnexion client (ou flux casse) : la boucle s'interrompt
      // au prochain pas, la mission termine "cancelled".
      request.signal.addEventListener("abort", () => cancelSignal.cancel(), {
        once: true,
      });
      const onEvent: ReactLoopEventHandler = async (event) => {
        try {
          await writeLine(event);
        } catch {
          cancelSignal.cancel();
        }
      };
      void (async () => {
        try {
          const payload = await runAndPersist(onEvent);
          await writeLine({
            type: "done",
            ...payload,
            sessionId: conversation.id,
          });
        } catch (error) {
          // Mission deja persistee par runAndPersist : on ferme.
          console.error("Mission stream write error:", error);
        } finally {
          await writer.close().catch(() => {});
        }
      })();
      return new Response(readable, {
        headers: {
          "content-type": "application/x-ndjson",
          "x-employee-session": conversation.id,
        },
      });
    }

    const payload = await runAndPersist();
    return NextResponse.json(
      { ...payload, sessionId: conversation.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/employees/[id]/chat Error:", error);
    return NextResponse.json(
      { error: "Failed to chat with employee" },
      { status: 500 }
    );
  }
}
