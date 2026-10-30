import { describe, expect, it, vi } from "vitest";

import { createEmployeeMission } from "../missions/employee-mission";
import { createEmployeeProfile } from "../profile/employee-profile";
import type { EmployeeProfileSpec } from "../profiles/profile-spec";
import { createCoreTools } from "../tools/tool";
import { EmployeeRuntime } from "./employee-runtime";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./llm-provider";
import { resolveToolsForProfile } from "./profile-tools";

function makeSpec(overrides: Partial<EmployeeProfileSpec> = {}): EmployeeProfileSpec {
  return {
    name: "software-engineer",
    version: "1.0.0",
    role: "Software Engineer",
    systemPrompt: "You are an engineer.",
    allowedTools: ["read_file", "write_file", "run_shell"],
    permissions: ["fs:read", "fs:write", "shell:exec"],
    maxSteps: 12,
    ...overrides,
  };
}

class ScriptedProvider implements EmployeeLLMProvider {
  readonly id = "scripted";
  readonly seen: EmployeeLLMRequest[] = [];

  constructor(private readonly replies: string[]) {}

  async generate(request: EmployeeLLMRequest): Promise<EmployeeLLMResponse> {
    this.seen.push(request);
    const content = this.replies.shift();

    if (content === undefined) {
      throw new Error("script exhausted");
    }

    return { content, model: "scripted" };
  }
}

describe("resolveToolsForProfile", () => {
  it("grants declared tools with their permissions", () => {
    const tools = resolveToolsForProfile(makeSpec(), createCoreTools());
    expect(tools.map((tool) => tool.name)).toEqual([
      "read_file",
      "write_file",
      "run_shell",
    ]);
  });

  it("restricts a least-privilege profile to its subset", () => {
    const tools = resolveToolsForProfile(
      makeSpec({
        name: "researcher",
        allowedTools: ["read_file", "write_file"],
        permissions: ["fs:read", "fs:write"],
      }),
      createCoreTools()
    );
    expect(tools.map((tool) => tool.name)).toEqual([
      "read_file",
      "write_file",
    ]);
  });

  it("REGLE D'OR : run_shell sans permission explicite est rejete", () => {
    expect(() =>
      resolveToolsForProfile(
        makeSpec({
          name: "sneaky",
          allowedTools: ["run_shell"],
          permissions: ["fs:read"],
        }),
        createCoreTools()
      )
    ).toThrow(
      'Profile "sneaky" declares tool "run_shell" without required permission "shell:exec"'
    );
  });

  it("rejects unknown tools and unknown permissions", () => {
    expect(() =>
      resolveToolsForProfile(
        makeSpec({ allowedTools: ["nuke"] }),
        createCoreTools()
      )
    ).toThrow('Profile "software-engineer" declares unknown tool "nuke"');
    expect(() =>
      resolveToolsForProfile(
        makeSpec({ permissions: ["nope" as never] }),
        createCoreTools()
      )
    ).toThrow('declares unknown permission "nope"');
  });
});

describe("EmployeeRuntime with profile", () => {
  it("refuses a mis-authorized profile before any LLM call", async () => {
    const provider = new ScriptedProvider(["FINAL: done"]);
    const generate = vi.spyOn(provider, "generate");
    const runtime = new EmployeeRuntime(provider, {
      profile: makeSpec({
        name: "sneaky",
        allowedTools: ["run_shell"],
        permissions: ["fs:read"],
      }),
    });

    await expect(
      runtime.run(
        createEmployeeProfile({ id: "emp_1", name: "A", role: "R" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow("without required permission");

    expect(generate).not.toHaveBeenCalled();
  });

  it("uses the profile system prompt and maxSteps", async () => {
    const provider = new ScriptedProvider(["FINAL: done"]);
    const runtime = new EmployeeRuntime(provider, {
      profile: makeSpec({ maxSteps: 3 }),
    });

    const result = await runtime.run(
      createEmployeeProfile({ id: "emp_1", name: "A", role: "R" }),
      createEmployeeMission({ prompt: "Do it" })
    );

    expect(result.mission.status).toBe("completed");
    expect(provider.seen).toHaveLength(1);
    expect(provider.seen[0].messages[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining("You are an engineer."),
    });
  });
});
