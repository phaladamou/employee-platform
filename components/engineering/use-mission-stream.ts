// components/engineering/use-mission-stream.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyMissionEvent,
  createMissionStreamParser,
  emptyMissionProgress,
  parseLegacyMissionResult,
  type ConversationalDoneMessage,
  type MissionDoneMessage,
  type MissionProgressState,
} from "@/lib/employees/mission-events";

export interface MissionRunResult {
  missionId: string | undefined;
  summary: string;
  needsAcceptance: boolean;
  sessionId: string;
  /** Reponse directe (zero outil) : etat live inchange. */
  conversational?: boolean;
}

export interface MissionOutcome extends MissionRunResult {
  status: string;
}

interface SessionRunState {
  running: boolean;
  progress: MissionProgressState;
  startedAt: number;
  elapsed: number;
  outcome: MissionOutcome | null;
  lastPrompt: string | null;
}

function emptySessionRun(): SessionRunState {
  return {
    running: false,
    progress: emptyMissionProgress(),
    startedAt: 0,
    elapsed: 0,
    outcome: null,
    lastPrompt: null,
  };
}

// Logique de run partagee (onglet discussion + onglet GitHub) :
// un seul envoi a la fois, flux NDJSON reduit en timeline,
// annulation propre. Etat isole PAR SESSION : changer de session
// fige la vue (fraiche), y revenir reprend le live ou le dernier
// run restaure ; un run en tache de fond n'ecrit jamais dans la
// session visitee (la base recoit tout, chaque vue son seau).
export function useMissionStream(activeSessionId: string | null) {
  const [sessions, setSessions] = useState<
    Record<string, SessionRunState>
  >({});
  // Texte affichable en cours d'arrivee (reponse directe ou rapport
  // final) : ephemere, hors seaux (les flux conversationnels
  // n'ecrivent aucun etat), vide des que le resultat aboutit.
  const [draft, setDraft] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  // Epoques de run : un run supplante par un plus recent (double
  // envoi inter-onglets) n'ecrit plus dans l'etat partage.
  const runEpochRef = useRef(0);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  // Seau de la session active ("" = vue neuve sans session).
  const activeKey = activeSessionId ?? "";
  const empty = useMemo(emptySessionRun, []);
  const view = sessions[activeKey] ?? empty;

  useEffect(() => {
    if (!view.running) {
      return;
    }
    const key = activeKey;
    const timer = setInterval(() => {
      setSessions((prev) => {
        const bucket = prev[key];
        if (!bucket || !bucket.running) {
          return prev;
        }
        return {
          ...prev,
          [key]: {
            ...bucket,
            elapsed: Math.floor((Date.now() - bucket.startedAt) / 1000),
          },
        };
      });
    }, 500);
    return () => clearInterval(timer);
  }, [view.running, activeKey]);

  const run = useCallback(
    async ({
      employeeId,
      sessionId,
      message,
      greeting,
      forceMission,
    }: {
      employeeId: string;
      sessionId: string | null;
      message: string;
      /** Accueil affiche : persiste en premier si session vierge. */
      greeting?: string;
      /** Bouton "en faire une mission" : boucle outillee imposee. */
      forceMission?: boolean;
    }): Promise<MissionRunResult> => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setDraft("");
      const sessionQuery = sessionId
        ? `?session=${encodeURIComponent(sessionId)}&stream=1`
        : "?stream=1";
      const response = await fetch(
        `/api/employees/${encodeURIComponent(employeeId)}/chat${sessionQuery}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message,
            ...(greeting ? { greeting } : {}),
            ...(forceMission ? { forceMission: true } : {}),
          }),
          signal: controller.signal,
        }
      );
      if (!response.ok || !response.body) {
        const detail = await response
          .text()
          .then((text) => text.slice(0, 300))
          .catch(() => "");
        console.error(
          `Mission stream failed: HTTP ${response.status} ${detail}`
        );
        throw new Error(`mission stream failed: ${response.status}`);
      }
      // Reponse conversationnelle (JSON bloquant) : retour immediat,
      // AUCUNE ecriture d'etat (le panneau et les onglets bougent
      // seulement pour les vraies missions).
      if (
        (response.headers.get("content-type") ?? "").includes(
          "application/json"
        )
      ) {
        const data: unknown = await response.json().catch(() => null);
        if (
          typeof data !== "object" ||
          data === null ||
          typeof (data as { summary?: unknown }).summary !== "string" ||
          typeof (data as { sessionId?: unknown }).sessionId !== "string"
        ) {
          throw new Error("conversational reply malformed");
        }
        const payload = data as { summary: string; sessionId: string };
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        return {
          missionId: undefined,
          summary: payload.summary,
          needsAcceptance: false,
          sessionId: payload.sessionId,
          conversational: true,
        };
      }
      runEpochRef.current += 1;
      const epoch = runEpochRef.current;
      const bucketKey = sessionId ?? "";
      // Seau paresseux : les flux conversationnels (tokens + ligne
      // terminale, zero mission) n'ecrivent AUCUN etat, comme le JSON
      // bloquant historique. Seules les lignes mission reveillent
      // le seau (progres, panneau, onglets).
      let bucketReady = false;
      const ensureBucket = () => {
        if (!bucketReady) {
          bucketReady = true;
          setSessions((prev) => ({
            ...prev,
            [bucketKey]: {
              ...emptySessionRun(),
              running: true,
              startedAt: Date.now(),
              lastPrompt: message,
            },
          }));
        }
      };
      let done: MissionDoneMessage | null = null;
      let conversationalDone: ConversationalDoneMessage | null = null;
      let raw = "";
      // Cle du seau final (le seau d'attente migre vers la session
      // resolue) : lue par le finally pour eteindre `running`.
      let finalKey = bucketKey;
      try {
        const parser = createMissionStreamParser((line) => {
          if (epoch !== runEpochRef.current) {
            return;
          }
          if (line.type === "done") {
            ensureBucket();
            done = line;
            return;
          }
          if (line.type === "conversational_done") {
            conversationalDone = line;
            return;
          }
          if (line.type === "token") {
            setDraft((prev) => prev + line.text);
            return;
          }
          ensureBucket();
          const key = bucketKey;
          setSessions((prev) => {
            const bucket = prev[key] ?? emptySessionRun();
            return {
              ...prev,
              [key]: {
                ...bucket,
                progress: applyMissionEvent(bucket.progress, line),
              },
            };
          });
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done: finished, value } = await reader.read();
          if (finished) {
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          raw += chunk;
          parser.push(chunk);
        }
        parser.flush();
        // Repli : serveur pas a jour qui renvoie le JSON bloquant
        // historique au lieu du NDJSON (pas de timeline, mais la
        // reponse aboutit au lieu d'echouer).
        const legacy = !done ? parseLegacyMissionResult(raw) : null;
        const fallbackSession =
          legacy?.sessionId ??
          response.headers.get("x-employee-session") ??
          sessionId;
        const result: MissionRunResult | null = done
          ? {
              missionId: done.mission.id,
              summary: done.summary,
              needsAcceptance: done.needsAcceptance,
              sessionId: done.sessionId,
            }
          : conversationalDone
            ? {
                missionId: undefined,
                summary: conversationalDone.summary,
                needsAcceptance: false,
                sessionId: conversationalDone.sessionId,
                conversational: true,
              }
            : legacy && fallbackSession
            ? {
                missionId: legacy.mission.id,
                summary: legacy.summary,
                needsAcceptance: legacy.needsAcceptance,
                sessionId: fallbackSession,
              }
            : null;
        if (!result) {
          console.error(
            `Mission stream closed without result (${raw.length} bytes received)`
          );
          throw new Error("mission stream closed without result");
        }
        // Terminale conversationnelle : AUCUNE ecriture de seau
        // (pas de panneau ni d'onglets pour une reponse directe).
        if (epoch === runEpochRef.current && !conversationalDone) {
          finalKey = result.sessionId;
          const status = done
            ? done.mission.status
            : (legacy?.mission.status ?? "failed");
          setSessions((prev) => {
            const from = prev[bucketKey] ?? emptySessionRun();
            const finished: SessionRunState = {
              ...from,
              outcome: { ...result, status },
            };
            // Vue neuve : le seau d'attente est COPIE vers la
            // session resolue (pas de deplacement : l'URL suit
            // avec un temps de retard, le panneau ne clignote
            // pas). resetPending() le vide a la prochaine neuve.
            return { ...prev, [result.sessionId]: finished };
          });
        }
        return result;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        // Le resultat (ou l'erreur) prend le relais : le brouillon
        // s'efface ici, le message complet suit dans le meme rendu.
        setDraft("");
        if (epoch === runEpochRef.current) {
          const key = finalKey;
          const pending = bucketKey;
          setSessions((prev) => {
            const next = { ...prev };
            for (const target of [key, pending]) {
              const bucket = next[target];
              if (bucket && bucket.running) {
                next[target] = { ...bucket, running: false };
              }
            }
            return next;
          });
        }
      }
    },
    []
  );

  // Restaure un processus termine (revisite de session) : le
  // panneau montre le dernier run stocke. No-op si le seau est
  // en cours de run (le live gagne toujours sur le restaure).
  const restore = useCallback(
    (input: {
      sessionId: string;
      progress: MissionProgressState;
      outcome: MissionOutcome | null;
      /** Duree mesuree cote serveur (preuves restaurees). */
      elapsed?: number;
    }) => {
      setSessions((prev) => {
        if (prev[input.sessionId]?.running) {
          return prev;
        }
        return {
          ...prev,
          [input.sessionId]: {
            ...emptySessionRun(),
            progress: input.progress,
            outcome: input.outcome,
            elapsed: input.elapsed ?? 0,
          },
        };
      });
    },
    []
  );

  // Vide le seau d'attente (nouvelle session : vue neuve, sans
  // le run termine de la precedente vue neuve).
  const resetPending = useCallback(() => {
    setSessions((prev) => {
      if (!prev[""]) {
        return prev;
      }
      const next = { ...prev };
      delete next[""];
      return next;
    });
  }, []);

  return {
    running: view.running,
    progress: view.progress,
    elapsed: view.elapsed,
    outcome: view.outcome,
    lastPrompt: view.lastPrompt,
    draft,
    run,
    restore,
    resetPending,
  };
}
