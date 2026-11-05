import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createEmployeeProfile } from "../profile/employee-profile";
import { createEmployeeMission } from "../missions/employee-mission";
import { EmployeeMemory, type MissionRecord } from "../memory/employee-memory";
import { FileMemoryStore } from "../memory/file-memory-store";
import type {
  EmployeeMemoryScope,
  EmployeeMemoryStore,
} from "../memory/memory-store";
import type { ToolContext } from "../tools/tool";
import { EmployeeRuntime } from "./employee-runtime";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./llm-provider";

function makeProfile() {
  return createEmployeeProfile({
    id: "emp_1",
    name: "Aria",
    role: "Data Analyst",
    skills: ["SQL"],
  });
}

class ScriptedProvider implements EmployeeLLMProvider {
  readonly id = "scripted";

  constructor(private readonly replies: string[]) {}

  async generate(request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    void request;
    const content = this.replies.shift();

    if (content === undefined) {
      throw new Error("script exhausted");
    }

    return { content, model: "scripted" };
  }
}

class FailingProvider implements EmployeeLLMProvider {
  readonly id = "failing";

  async generate(): Promise<EmployeeLLMResponse> {
    throw new Error("LLM timeout");
  }
}

const ACME: EmployeeMemoryScope = { employeeId: "emp_1", employerId: "acme" };

class InMemoryStore implements EmployeeMemoryStore {
  private readonly byScope = new Map<string, MissionRecord[]>();

  private key(scope: EmployeeMemoryScope): string {
    return `${scope.employeeId}:${scope.employerId}`;
  }

  async load(scope: EmployeeMemoryScope): Promise<readonly MissionRecord[]> {
    return [...(this.byScope.get(this.key(scope)) ?? [])];
  }

  async save(
    scope: EmployeeMemoryScope,
    records: readonly MissionRecord[]
  ): Promise<void> {
    this.byScope.set(this.key(scope), [...records]);
  }
}

function seededRecord(prompt: string, employerId: string | null = "acme"): MissionRecord {
  return {
    missionId: `mis_${prompt}`,
    employeeId: "emp_1",
    employerId,
    prompt,
    status: "completed",
    summary: `Summary ${prompt}`,
    reportHash: null,
    completedAt: "2026-01-01T00:00:00.000Z",
  };
}

function scopedMission(prompt: string, employerId = "acme") {
  return createEmployeeMission({ prompt, employerId });
}

describe("EmployeeRuntime with persistent memory", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function sandbox(): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-runmem-"));
    return { sandboxRoot: dir };
  }

  it("reloads past history at startup", async () => {
    const store = new InMemoryStore();
    await store.save(ACME, [seededRecord("previous")]);
    const memory = new EmployeeMemory();
    const runtime = new EmployeeRuntime(new ScriptedProvider(["FINAL: New."]), {
      tools: [],
      toolContext: await sandbox(),
      memory,
      memoryStore: store,
    });

    await runtime.run(makeProfile(), scopedMission("Now"));

    expect(memory.history("emp_1", "acme").map((r) => r.prompt)).toEqual([
      "previous",
      "Now",
    ]);
  });

  it("persists completed and failed missions", async () => {
    const store = new InMemoryStore();
    const ctx = await sandbox();

    const ok = new EmployeeRuntime(new ScriptedProvider(["FINAL: Done."]), {
      tools: [],
      toolContext: ctx,
      memory: new EmployeeMemory(),
      memoryStore: store,
    });
    const okResult = await ok.run(
      makeProfile(),
      scopedMission("Win")
    );

    const ko = new EmployeeRuntime(new FailingProvider(), {
      tools: [],
      toolContext: ctx,
      memory: new EmployeeMemory(),
      memoryStore: store,
    });
    await ko.run(makeProfile(), scopedMission("Lose"));

    const saved = await store.load(ACME);
    expect(saved.map((r) => r.prompt)).toEqual(["Win", "Lose"]);
    expect(saved.map((r) => r.status)).toEqual(["completed", "failed"]);
    expect(saved[0]?.missionId).toBe(okResult.mission.id);
    expect(saved[0]?.summary).toBe("Done.");
  });

  it("persists across instances with the file store", async () => {
    const root = await mkdtemp(join(tmpdir(), "emp-runfile-"));
    dir = root;
    const memoryDir = join(root, "memory");
    const ctx = { sandboxRoot: join(root, "work") };

    const first = new EmployeeRuntime(new ScriptedProvider(["FINAL: One."]), {
      tools: [],
      toolContext: ctx,
      memory: new EmployeeMemory(),
      memoryStore: new FileMemoryStore({ directory: memoryDir }),
    });
    await first.run(makeProfile(), scopedMission("One"));

    const files = await readdir(join(memoryDir, "employee_emp_1"));
    expect(files).toContain("employer_acme.json");

    const secondMemory = new EmployeeMemory();
    const second = new EmployeeRuntime(
      new ScriptedProvider(["FINAL: Two."]),
      {
        tools: [],
        toolContext: ctx,
        memory: secondMemory,
        memoryStore: new FileMemoryStore({ directory: memoryDir }),
      }
    );
    await second.run(makeProfile(), scopedMission("Two"));

    expect(secondMemory.history("emp_1", "acme").map((r) => r.prompt)).toEqual([
      "One",
      "Two",
    ]);
  });

  it("reminds the LLM of past missions", async () => {
    const store = new InMemoryStore();
    await store.save(ACME, [seededRecord("previous")]);

    const seen: EmployeeLLMRequest[] = [];
    const spying: EmployeeLLMProvider = {
      id: "spying",
      generate: async (request) => {
        seen.push(request);
        return { content: "FINAL: New.", model: "spying" };
      },
    };
    const runtime = new EmployeeRuntime(spying, {
      tools: [],
      toolContext: await sandbox(),
      memory: new EmployeeMemory(),
      memoryStore: store,
    });

    await runtime.run(makeProfile(), scopedMission("Now"));

    const system = seen[0]?.messages[0]?.content ?? "";
    expect(system).toContain("Your previous missions:");
    expect(system).toContain("Summary previous");
  });

  it("never injects another employer history into the LLM", async () => {
    const store = new InMemoryStore();
    await store.save(ACME, [seededRecord("acme-secret")]);
    await store.save(
      { employeeId: "emp_1", employerId: "globex" },
      [seededRecord("globex-secret", "globex")]
    );

    const seen: EmployeeLLMRequest[] = [];
    const spying: EmployeeLLMProvider = {
      id: "spying",
      generate: async (request) => {
        seen.push(request);
        return { content: "FINAL: New.", model: "spying" };
      },
    };
    const runtime = new EmployeeRuntime(spying, {
      tools: [],
      toolContext: await sandbox(),
      memory: new EmployeeMemory(),
      memoryStore: store,
    });

    await runtime.run(makeProfile(), scopedMission("Now", "globex"));

    const system = seen[0]?.messages[0]?.content ?? "";
    expect(system).toContain("Summary globex-secret");
    expect(system).not.toContain("Summary acme-secret");
  });

  it("records nothing when only half of the memory pair is set", async () => {
    const memory = new EmployeeMemory();
    const runtime = new EmployeeRuntime(new ScriptedProvider(["FINAL: Done."]), {
      tools: [],
      toolContext: await sandbox(),
      memory,
    });

    const result = await runtime.run(
      makeProfile(),
      createEmployeeMission({ prompt: "Win" })
    );

    expect(result.mission.status).toBe("completed");
    expect(memory.history()).toEqual([]);
  });
});
