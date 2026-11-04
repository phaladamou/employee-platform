// lib/employees/mission-events.test.ts
// Contrat du protocole live des missions (parseur NDJSON,
// reducteur de timeline, presentation des outils).
// Execution : node --test lib/employees/mission-events.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyMissionEvent,
  createMissionStreamParser,
  emptyMissionProgress,
  formatThoughtSecs,
  parseLegacyMissionResult,
  parseMissionMessage,
  progressFromRecords,
  resolveMissionDisplayStatus,
  toolLabel,
  toolPhase,
  type MissionStreamEvent,
  type MissionStreamMessage,
} from "./mission-events.ts";

describe("parseMissionMessage", () => {
  it("parses every event shape", () => {
    assert.deepEqual(parseMissionMessage('{"type":"thinking","step":1}'), {
      type: "thinking",
      step: 1,
    });
    assert.deepEqual(
      parseMissionMessage(
        '{"type":"step","step":2,"title":"Fork du dépôt","tool":"github_fork","thoughtMs":8120}'
      ),
      {
        type: "step",
        step: 2,
        title: "Fork du dépôt",
        tool: "github_fork",
        thoughtMs: 8120,
      }
    );
    assert.deepEqual(
      parseMissionMessage(
        '{"type":"tool_result","step":2,"tool":"github_fork","ok":true,"files":[]}'
      ),
      { type: "tool_result", step: 2, tool: "github_fork", ok: true, files: [] }
    );
    assert.deepEqual(
      parseMissionMessage(
        '{"type":"tool_result","step":2,"tool":"write_file","ok":true,"files":[{"path":"app.js","status":"modified","added":1,"removed":0,"rows":[{"type":"add","oldNo":null,"newNo":1,"text":"x"}],"truncated":false}]}'
      ),
      {
        type: "tool_result",
        step: 2,
        tool: "write_file",
        ok: true,
        files: [
          {
            path: "app.js",
            status: "modified",
            added: 1,
            removed: 0,
            rows: [{ type: "add", oldNo: null, newNo: 1, text: "x" }],
            truncated: false,
          },
        ],
      }
    );
    assert.deepEqual(
      parseMissionMessage('{"type":"final","step":3,"title":null,"thoughtMs":400}'),
      { type: "final", step: 3, title: null, thoughtMs: 400 }
    );
    assert.deepEqual(
      parseMissionMessage('{"type":"error","step":1,"message":"boom"}'),
      { type: "error", step: 1, message: "boom" }
    );
  });

  it("parses the terminal done payload", () => {
    const done = parseMissionMessage(
      '{"type":"done","mission":{"id":"m1","title":"T","status":"succeeded","employeeId":"e1"},"summary":"ok","needsAcceptance":false,"sessionId":"s1"}'
    );
    assert.deepEqual(done, {
      type: "done",
      mission: { id: "m1", title: "T", status: "succeeded", employeeId: "e1" },
      summary: "ok",
      needsAcceptance: false,
      sessionId: "s1",
    });
  });

  it("drops malformed lines without throwing", () => {
    for (const line of [
      "",
      "   ",
      "not json",
      '{"type":"thinking"}',
      '{"type":"thinking","step":-1}',
      '{"type":"step","step":1,"title":"x"}',
      '{"type":"step","step":1,"title":null,"tool":"x","thoughtMs":-1}',
      '{"type":"tool_result","step":1,"tool":"x","ok":true}',
      '{"type":"tool_result","step":1,"tool":"x","ok":"yes","files":[]}',
      '{"type":"tool_result","step":1,"tool":"x","ok":true,"files":[{"path":""}]}',
      '{"type":"final","step":2,"title":null}',
      '{"type":"mystery","step":1}',
      '{"type":"done","summary":"ok"}',
      "[]",
    ]) {
      assert.equal(parseMissionMessage(line), null, line);
    }
  });
});

describe("parseLegacyMissionResult", () => {
  it("accepts the historical blocking payload", () => {
    assert.deepEqual(
      parseLegacyMissionResult(
        '{"mission":{"id":"m1","title":"T","status":"succeeded","employeeId":"e1"},"summary":"ok","needsAcceptance":false,"sessionId":"s1"}'
      ),
      {
        mission: {
          id: "m1",
          title: "T",
          status: "succeeded",
          employeeId: "e1",
        },
        summary: "ok",
        needsAcceptance: false,
        sessionId: "s1",
      }
    );
  });

  it("rejects anything else without throwing", () => {
    for (const text of [
      "",
      "not json",
      '{"type":"done"}',
      '{"mission":{"id":"m1"},"summary":"ok","needsAcceptance":false}',
      '{"mission":{"id":"m1","title":"T","status":"ok","employeeId":"e1"},"summary":"ok"}',
      '[{"type":"thinking","step":1}]',
    ]) {
      assert.equal(parseLegacyMissionResult(text), null, text);
    }
    // sessionId absente : resultat quand meme (le header prend le relais).
    assert.equal(
      parseLegacyMissionResult(
        '{"mission":{"id":"m1","title":"T","status":"ok","employeeId":"e1"},"summary":"ok","needsAcceptance":true}'
      )?.sessionId,
      null
    );
  });
});

describe("createMissionStreamParser", () => {
  it("reassembles lines split across chunks", () => {
    const received: MissionStreamMessage[] = [];
    const parser = createMissionStreamParser((message) =>
      received.push(message)
    );
    parser.push('{"type":"thinking","step":1}\n{"type":"st');
    parser.push('ep","step":1,"title":null,"tool":"read_f');
    parser.push('ile","thoughtMs":90}\nnot json\n{"type":"final","step":2,"title":null,"thoughtMs":40}');
    parser.flush();
    assert.deepEqual(received, [
      { type: "thinking", step: 1 },
      { type: "step", step: 1, title: null, tool: "read_file", thoughtMs: 90 },
      { type: "final", step: 2, title: null, thoughtMs: 40 },
    ]);
  });
});

describe("applyMissionEvent", () => {
  const EVENTS: MissionStreamEvent[] = [
    { type: "thinking", step: 1 },
    {
      type: "step",
      step: 1,
      title: "Fork du dépôt",
      tool: "github_fork",
      thoughtMs: 8120,
    },
    { type: "tool_result", step: 1, tool: "github_fork", ok: true, files: [] },
    { type: "thinking", step: 2 },
    { type: "final", step: 2, title: "Rapport", thoughtMs: 1500 },
  ];

  it("walks thinking -> step -> result -> final", () => {
    let state = emptyMissionProgress();
    state = applyMissionEvent(state, EVENTS[0]);
    assert.equal(state.thinkingStep, 1);
    assert.deepEqual(state.steps, []);
    state = applyMissionEvent(state, EVENTS[1]);
    assert.equal(state.thinkingStep, null);
    assert.deepEqual(state.steps, [
      {
        step: 1,
        title: "Fork du dépôt",
        tool: "github_fork",
        status: "running",
        thoughtMs: 8120,
      },
    ]);
    state = applyMissionEvent(state, EVENTS[2]);
    assert.deepEqual(state.steps, [
      {
        step: 1,
        title: "Fork du dépôt",
        tool: "github_fork",
        status: "ok",
        thoughtMs: 8120,
      },
    ]);
    assert.deepEqual(state.changes, []);
    state = applyMissionEvent(state, EVENTS[3]);
    assert.equal(state.thinkingStep, 2);
    state = applyMissionEvent(state, EVENTS[4]);
    assert.equal(state.thinkingStep, null);
    assert.equal(state.finalTitle, "Rapport");
    assert.equal(state.finalThoughtMs, 1500);
    assert.equal(state.failed, null);
  });

  it("marks failed results and terminal errors", () => {
    let state = emptyMissionProgress();
    state = applyMissionEvent(state, {
      type: "tool_result",
      step: 1,
      tool: "teleport",
      ok: false,
      files: [],
    });
    assert.deepEqual(state.steps, [
      {
        step: 1,
        title: null,
        tool: "teleport",
        status: "failed",
        thoughtMs: null,
      },
    ]);
    state = applyMissionEvent(state, {
      type: "error",
      step: 2,
      message: "LLM timeout",
    });
    assert.equal(state.failed, "LLM timeout");
    assert.equal(state.thinkingStep, null);
  });

  it("accumulates file changes, latest write wins per path", () => {
    const first = {
      path: "app.js",
      status: "added" as const,
      added: 2,
      removed: 0,
      rows: [],
      truncated: false,
    };
    const second = { ...first, status: "modified" as const, added: 1 };
    const other = { ...first, path: "lib.js" };
    let state = emptyMissionProgress();
    state = applyMissionEvent(state, {
      type: "tool_result",
      step: 1,
      tool: "write_file",
      ok: true,
      files: [first],
    });
    state = applyMissionEvent(state, {
      type: "tool_result",
      step: 2,
      tool: "write_file",
      ok: true,
      files: [other, second],
    });
    assert.deepEqual(state.changes, [other, second]);
  });

  it("does not mutate its input", () => {
    const before = emptyMissionProgress();
    const after = applyMissionEvent(before, EVENTS[0]);
    assert.notEqual(after, before);
    assert.equal(before.thinkingStep, null);
  });

  it("rebuilds a finished timeline from stored records", () => {
    assert.deepEqual(
      progressFromRecords([
        { tool: "github_fork", ok: true, title: "Fork du dépôt", thoughtMs: 8120 },
        { tool: "read_file", ok: false },
      ]),
      {
        steps: [
          {
            step: 1,
            title: "Fork du dépôt",
            tool: "github_fork",
            status: "ok",
            thoughtMs: 8120,
          },
          { step: 2, title: null, tool: "read_file", status: "failed", thoughtMs: null },
        ],
        thinkingStep: null,
        finalTitle: null,
        finalThoughtMs: null,
        failed: null,
        changes: [],
      }
    );
  });

  it("formats thought seconds like Devin", () => {
    assert.equal(formatThoughtSecs(0), 1);
    assert.equal(formatThoughtSecs(400), 1);
    assert.equal(formatThoughtSecs(8120), 8);
    assert.equal(formatThoughtSecs(1500), 2);
  });

  it("resolves banner statuses from terminal outcomes", () => {
    assert.equal(
      resolveMissionDisplayStatus({
        status: "succeeded",
        summary: "ok",
        needsAcceptance: false,
      }),
      "succeeded"
    );
    assert.equal(
      resolveMissionDisplayStatus({
        status: "failed",
        summary: "boom",
        needsAcceptance: false,
      }),
      "failed"
    );
    assert.equal(
      resolveMissionDisplayStatus({
        status: "failed",
        summary: "  cancelled\n",
        needsAcceptance: false,
      }),
      "cancelled"
    );
    assert.equal(
      resolveMissionDisplayStatus({
        status: "succeeded",
        summary: "",
        needsAcceptance: true,
      }),
      "needs_review"
    );
    assert.equal(
      resolveMissionDisplayStatus({
        status: "needs_review",
        summary: "",
        needsAcceptance: false,
      }),
      "needs_review"
    );
  });
});

describe("tool presentation", () => {
  it("maps tools to phases", () => {
    assert.equal(toolPhase(null), "thinking");
    assert.equal(toolPhase("github_fork"), "github");
    assert.equal(toolPhase("github_create_pr"), "github");
    assert.equal(toolPhase("run_shell"), "shell");
    assert.equal(toolPhase("read_file"), "file");
    assert.equal(toolPhase("write_file"), "file");
    assert.equal(toolPhase("protocol"), "protocol");
    assert.equal(toolPhase("teleport"), "thinking");
  });

  it("labels tools shortly", () => {
    assert.equal(toolLabel("github_fork"), "Fork");
    assert.equal(toolLabel("github_create_pr"), "PR");
    assert.equal(toolLabel("run_shell"), "Shell");
    assert.equal(toolLabel("read_file"), "Read");
    assert.equal(toolLabel("protocol"), "Format");
    assert.equal(toolLabel("teleport"), "Teleport");
  });
});
