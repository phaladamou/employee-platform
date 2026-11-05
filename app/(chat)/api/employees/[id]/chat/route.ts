// app/(chat)/api/employees/[id]/chat/route.ts
// Espace Engineering (mode unique) : chaque message passe par la
// boucle agentique du noyau (plan ecrit, puis execution in-process,
// dev-first). Persistance multi-sessions : ?session=<id> cible une
// session, absent = derniere session (GET) ou nouvelle (POST).
// ?stream=1 renvoie les evenements live en NDJSON (thinking, plan,
// etapes titre agent, resultats) puis une ligne `done` avec la
// charge utile habituelle ; sinon reponse JSON bloquante.
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { InMemoryJobSignal } from "@/core/employee/jobs/job-signal";
import { isConversationalPrompt } from "@/core/employee/missions/mission-intent";
import type { ReactLoopEventHandler } from "@/core/employee/runtime/react-loop";
import {
  createEmployeeSession,
  createMission,
  deleteStaleWorkspaceFiles,
  getEmployeeById,
  getEmployeeSession,
  getEmployeeSessions,
  getMessagesByChatId,
  getMissionById,
  listWorkspaceFilesDb,
  requireAccountId,
  saveEmployeeMessage,
  titleSessionFromFirstMessage,
  updateMission,
  upsertWorkspaceFiles,
} from "@/lib/db/queries";
import { isMissionStatus } from "@/lib/employees/catalog";
import { syncWorkspaceToDb } from "@/lib/engineering/workspace-sync";
import { buildSessionHistory } from "@/lib/server/employee-history";
import {
  invalidateWorkspaceTree,
  workspacePathOf,
} from "@/lib/engineering/workspace-store";

// Processus de la derniere mission de la session (plan + appels
// + statut) : le client restaure le panneau d'execution avec
// (le processus fait partie de la reponse). NULL sans mission.
async function loadLastMissionProcess(
  accountId: string,
  rows: ReadonlyArray<{ missionId: string | null }>
): Promise<{
  id: string;
  status: string;
  summary: string;
  needsAcceptance: boolean;
  toolCalls: unknown;
  plan: unknown;
} | null> {
  let missionId: string | null = null;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.missionId) {
      missionId = rows[index].missionId;
      break;
    }
  }
  if (!missionId) {
    return null;
  }
  const mission = await getMissionById(accountId, missionId);
  if (!mission) {
    return null;
  }
  return {
    id: mission.id,
    status: mission.status,
    summary: mission.report ?? "",
    needsAcceptance: mission.status === "needs_review",
    toolCalls: mission.toolCalls,
    plan: mission.plan,
  };
}
import {
  normalizeGreetingInput,
  partsToText,
  toDisplayRole,
} from "@/lib/server/employee-conversation-mapping";
import {
  runConversationalReply,
  runWebMission,
} from "@/lib/server/run-web-mission";
import { shouldAnswerDirectly } from "@/lib/server/web-mission-mapping";

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
        lastMission: await loadLastMissionProcess(accountId, rows),
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
      lastMission: await loadLastMissionProcess(accountId, rows),
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
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }
  // Accueil affiche par le client (deja traduit) : sauvegarde comme
  // premier message si la session est encore vierge (voir ci-dessous).
  const greeting = normalizeGreetingInput(body.greeting);
  // Bouton "en faire une mission" : court-circuite le routage
  // conversationnel pour forcer la boucle outillee.
  const forceMission = body.forceMission === true;

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
    // Ordre de sauvegarde : accueil (session vierge) PUIS message
    // utilisateur PUIS reponse mission. Awaits sequentiels :
    // `createdAt` distingue chaque ligne, le GET les rend dans cet
    // ordre (aucune egalite de timestamp constatee en base).
    if (greeting) {
      const existing = await getMessagesByChatId({ id: conversation.id });
      if (existing.length === 0) {
        await saveEmployeeMessage({
          chatId: conversation.id,
          role: "assistant",
          text: greeting,
        });
      }
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

    // Routage parole / mission : une question simple obtient une
    // reponse directe (un appel LLM, zero outil, zero mission en
    // base) au lieu de declencher clone/lecture. JSON bloquant
    // meme avec ?stream=1 (le client bifurque au content-type).
    if (
      shouldAnswerDirectly({
        forceMission,
        conversational: isConversationalPrompt(message),
      })
    ) {
      const rows = await getMessagesByChatId({ id: conversation.id });
      const history = buildSessionHistory(
        rows.map((row) => ({ role: row.role, text: partsToText(row.parts) })),
        { excludeLast: true }
      );
      const workspaceRoot = workspacePathOf(id, conversation.id);
      const replyOf = (error: unknown) => {
        console.error("POST /api/employees/[id]/chat Reply Error:", error);
        return String(
          error instanceof Error ? error.message : error
        ).slice(0, 500);
      };
      if (url.searchParams.get("stream") !== "1") {
        const reply = await runConversationalReply({
          employeeName: target.name,
          employeeRole: target.role,
          talentSpec: target.talentSpec,
          history,
          prompt: message,
          workspaceRoot,
        }).catch(replyOf);
        await saveEmployeeMessage({
          chatId: conversation.id,
          role: "assistant",
          text: reply,
        });
        return NextResponse.json(
          {
            sessionId: conversation.id,
            mission: null,
            summary: reply,
            needsAcceptance: false,
          },
          { status: 201 }
        );
      }
      // Streaming : reponse immediate, generation en tache de fond
      // (attendre ici rebufferiserait tout). Ordre preserve :
      // la reponse est sauvee APRES le message utilisateur, avant
      // la ligne terminale. Deconnexion : le flux casse, la base
      // recoit quand meme la reponse (l'historique reste coherent).
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const writeLine = (value: unknown) =>
        writer.write(encoder.encode(`${JSON.stringify(value)}\n`));
      void (async () => {
        let broken = false;
        try {
          const reply = await runConversationalReply({
            employeeName: target.name,
            employeeRole: target.role,
            talentSpec: target.talentSpec,
            history,
            prompt: message,
            workspaceRoot,
            onToken: async (text) => {
              try {
                await writeLine({ type: "token", step: 0, text });
              } catch {
                broken = true;
              }
            },
          }).catch(replyOf);
          await saveEmployeeMessage({
            chatId: conversation.id,
            role: "assistant",
            text: reply,
          });
          if (!broken) {
            await writeLine({
              type: "conversational_done",
              summary: reply,
              sessionId: conversation.id,
            });
          }
        } catch (error) {
          console.error("Conversational stream write error:", error);
        } finally {
          await writer.close().catch(() => {});
        }
      })();
      return new Response(readable, {
        headers: {
          "content-type": "application/x-ndjson",
          "x-employee-session": conversation.id,
          // Anti-buffering proxies/tunnels : chaque fragment doit
          // partir au fil de l'eau, jamais retenu jusqu'a la fin.
          "cache-control": "no-cache, no-transform",
          "x-accel-buffering": "no",
        },
      });
    }

    // Mission : la boucle agentique (plan ecrit, puis execution).
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

    // Esprit unique : la mission voit la discussion qui l'a
    // precedee (meme assembleur borne que le chemin direct).
    const missionRows = await getMessagesByChatId({ id: conversation.id });
    const missionHistory = buildSessionHistory(
      missionRows.map((row) => ({
        role: row.role,
        text: partsToText(row.parts),
      })),
      { excludeLast: true }
    );

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
        sessionId: conversation.id,
        prompt: message,
        history: missionHistory,
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
          plan: [],
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
            plan: outcome.plan,
          },
        });
        // Miroir durable : le travail de la session quitte son
        // dossier local pour la base en ligne (scope session).
        // Echec isole : une synchro en panne ne doit jamais avaler
        // le resultat mission.
        try {
          await syncWorkspaceToDb({
            dir: workspacePathOf(id, conversation.id),
            store: {
              list: async () =>
                (
                  await listWorkspaceFilesDb({
                    accountId,
                    employeeId: id,
                    chatId: conversation.id,
                  })
                ).map((row) => ({ path: row.path, sha256: row.sha256 })),
              upsert: async (files) =>
                upsertWorkspaceFiles({
                  accountId,
                  employeeId: id,
                  chatId: conversation.id,
                  missionId: created.id,
                  files,
                }),
              deleteNotIn: async (paths) =>
                deleteStaleWorkspaceFiles({
                  accountId,
                  employeeId: id,
                  chatId: conversation.id,
                  keepPaths: paths,
                }),
            },
          });
          // Arbre disque frais a la prochaine lecture (l'IDE
          // rebascule sur Files avec des fichiers a jour).
          invalidateWorkspaceTree(accountId, id, conversation.id);
        } catch (syncError) {
          console.error(
            "POST /api/employees/[id]/chat Sync Error:",
            syncError
          );
        }
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
          // Anti-buffering proxies/tunnels : chaque evenement doit
          // partir au fil de l'eau, jamais retenu jusqu'a la fin.
          "cache-control": "no-cache, no-transform",
          "x-accel-buffering": "no",
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
