// components/engineering/use-mission-stream.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyMissionEvent,
  createMissionStreamParser,
  emptyMissionProgress,
  parseLegacyMissionResult,
  type MissionDoneMessage,
  type MissionProgressState,
} from "@/lib/employees/mission-events";

export interface MissionRunResult {
  missionId: string | undefined;
  summary: string;
  needsAcceptance: boolean;
  sessionId: string;
}

export interface MissionOutcome extends MissionRunResult {
  status: string;
}

// Logique de run partagee (onglet discussion en mode mission +
// onglet GitHub) : un seul envoi a la fois, flux NDJSON reduit en
// timeline, annulation propre.
export function useMissionStream() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<MissionProgressState>(
    emptyMissionProgress
  );
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // Dernier resultat terminal (banniere de statut) + dernier prompt
  // (bouton Retry). Reinitialises a chaque run().
  const [outcome, setOutcome] = useState<MissionOutcome | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!running) {
      return;
    }
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      500
    );
    return () => clearInterval(timer);
  }, [running, startedAt]);

  const run = useCallback(
    async ({
      employeeId,
      sessionId,
      message,
    }: {
      employeeId: string;
      sessionId: string | null;
      message: string;
    }): Promise<MissionRunResult> => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setRunning(true);
      setStartedAt(Date.now());
      setProgress(emptyMissionProgress());
      setOutcome(null);
      setLastPrompt(message);
      const sessionQuery = sessionId
        ? `?session=${encodeURIComponent(sessionId)}&stream=1`
        : "?stream=1";
      try {
        const response = await fetch(
          `/api/employees/${encodeURIComponent(employeeId)}/chat${sessionQuery}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message }),
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
        let done: MissionDoneMessage | null = null;
        let raw = "";
        const parser = createMissionStreamParser((line) => {
          if (line.type === "done") {
            done = line;
            return;
          }
          setProgress((prev) => applyMissionEvent(prev, line));
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
        if (!done) {
          // Repli : serveur pas a jour qui renvoie le JSON bloquant
          // historique au lieu du NDJSON (pas de timeline, mais la
          // reponse aboutit au lieu d'echouer).
          const legacy = parseLegacyMissionResult(raw);
          const fallbackSession =
            legacy?.sessionId ??
            response.headers.get("x-employee-session") ??
            sessionId;
          if (legacy && fallbackSession) {
            const result = {
              missionId: legacy.mission.id,
              summary: legacy.summary,
              needsAcceptance: legacy.needsAcceptance,
              sessionId: fallbackSession,
            };
            setOutcome({ ...result, status: legacy.mission.status });
            return result;
          }
          console.error(
            `Mission stream closed without result (${raw.length} bytes received)`
          );
          throw new Error("mission stream closed without result");
        }
        const result = {
          missionId: done.mission.id,
          summary: done.summary,
          needsAcceptance: done.needsAcceptance,
          sessionId: done.sessionId,
        };
        setOutcome({ ...result, status: done.mission.status });
        return result;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        setRunning(false);
      }
    },
    []
  );

  return { running, progress, elapsed, outcome, lastPrompt, run };
}
