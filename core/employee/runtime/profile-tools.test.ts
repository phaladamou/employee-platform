import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmployeeMission } from "../missions/employee-mission";
import { createEmployeeProfile } from "../profile/employee-profile";
import { createProfileRegistry } from "../profiles/profile-registry";
import type { EmployeeProfileSpec } from "../profiles/profile-spec";
import { createCoreTools } from "../tools/tool";
import { EmployeeRuntime } from "./employee-runtime";
import type {
  EmployeeLLMProvider,
  EmployeeLLMRequest,
  EmployeeLLMResponse,
} from "./llm-provider";
import { assertSpecEnvironment, resolveToolsForProfile } from "./profile-tools";

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

describe("assertSpecEnvironment", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function binDir(): Promise<string> {
    dir = await mkdtemp(join(tmpdir(), "emp-env-"));
    await writeFile(join(dir, "mytool"), "#!/bin/sh\necho hi\n");
    await chmod(join(dir, "mytool"), 0o755);
    return dir;
  }

  it("is a no-op without declared prerequisites", async () => {
    await expect(assertSpecEnvironment(makeSpec(), undefined)).resolves.toBeUndefined();
    await expect(
      assertSpecEnvironment(makeSpec({ environment: [] }), {})
    ).resolves.toBeUndefined();
  });

  it("passes when every binary resolves and is executable", async () => {
    const bin = await binDir();

    await expect(
      assertSpecEnvironment(makeSpec({ environment: ["mytool"] }), {
        PATH: bin,
      })
    ).resolves.toBeUndefined();
  });

  it("refuses missing binaries and missing PATH, fail closed", async () => {
    const bin = await binDir();

    await expect(
      assertSpecEnvironment(makeSpec({ environment: ["nope-missing"] }), {
        PATH: bin,
      })
    ).rejects.toThrow(
      'Environment prerequisite "nope-missing" for profile "software-engineer" is not available'
    );
    await expect(
      assertSpecEnvironment(makeSpec({ environment: ["mytool"] }), {})
    ).rejects.toThrow("no PATH is available");
    await expect(
      assertSpecEnvironment(makeSpec({ environment: ["mytool"] }), undefined)
    ).rejects.toThrow("no PATH is available");
  });
});

describe("EmployeeRuntime with bound specialization", () => {
  const sneaky = makeSpec({
    name: "sneaky",
    allowedTools: ["run_shell"],
    permissions: ["fs:read"],
  });
  const engineer = makeSpec({ maxSteps: 3 });

  function registryWith(...specs: EmployeeProfileSpec[]) {
    return createProfileRegistry(specs);
  }

  function boundEmployee(specialization: { name: string; version: string }) {
    return createEmployeeProfile({
      id: "emp_1",
      name: "A",
      role: "R",
      specialization,
    });
  }

  // T1 : omission impossible — lie, sans options outils/profil.
  it("enforces the binding even when the caller passes no tools", async () => {
    const provider = new ScriptedProvider(["FINAL: done"]);
    const runtime = new EmployeeRuntime(provider, {
      profiles: registryWith(sneaky),
    });

    await expect(
      runtime.run(
        boundEmployee({ name: "sneaky", version: "1.0.0" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow("without required permission");
  });

  // T1 : registre absent ou spec inconnue = erreur franche.
  it("requires a registry resolving the exact bound version", async () => {
    const noRegistry = new EmployeeRuntime(new ScriptedProvider([]));
    await expect(
      noRegistry.run(
        boundEmployee({ name: "sneaky", version: "1.0.0" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow("no ProfileRegistry was provided");

    const empty = new EmployeeRuntime(new ScriptedProvider([]), {
      profiles: registryWith(engineer),
    });
    await expect(
      empty.run(
        boundEmployee({ name: "sneaky", version: "1.0.0" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow('Unknown profile "sneaky@1.0.0"');
  });

  it("refuses bound runs when the environment is not ready, before any LLM call", async () => {
    const spec = makeSpec({
      name: "needs-tools",
      environment: ["definitely-missing-tool-xyz"],
    });
    const provider = new ScriptedProvider(["FINAL: unreachable"]);
    const runtime = new EmployeeRuntime(provider, {
      profiles: registryWith(spec),
      toolContext: { sandboxRoot: tmpdir(), env: { PATH: tmpdir() } },
    });

    await expect(
      runtime.run(
        boundEmployee({ name: "needs-tools", version: "1.0.0" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow(
      'Environment prerequisite "definitely-missing-tool-xyz" for profile "needs-tools" is not available'
    );
    expect(provider.seen).toHaveLength(0);
  });

  // T2 : substitution / smuggling inoperants.
  it("ignores smuggled tools and runs the bound subset only", async () => {
    const provider = new ScriptedProvider(["FINAL: done"]);
    const runtime = new EmployeeRuntime(provider, {
      profiles: registryWith(
        makeSpec({
          name: "researcher",
          allowedTools: ["read_file", "write_file"],
          permissions: ["fs:read", "fs:write"],
        })
      ),
      // Tentative de l'employeur : injecter run_shell par les options.
      tools: createCoreTools(),
    });

    const result = await runtime.run(
      boundEmployee({ name: "researcher", version: "1.0.0" }),
      createEmployeeMission({ prompt: "Do it" })
    );

    expect(result.mission.status).toBe("completed");
    const catalog = provider.seen[0].messages[0].content;
    expect(catalog).toContain("read_file");
    expect(catalog).not.toContain("run_shell");
  });

  // T3 : permissions tranchees a l'execution, pas au chargement.
  it("loads shape-valid specs but rejects at run time", async () => {
    // Le registre accepte (forme valide, permission inconnue toleree).
    const registry = registryWith(
      makeSpec({
        name: "weird",
        allowedTools: ["read_file"],
        permissions: ["nope" as never],
      })
    );
    expect(registry.get("weird")).not.toBeNull();

    // Le runtime refuse (modele d'autorisation reel).
    const runtime = new EmployeeRuntime(new ScriptedProvider([]), {
      profiles: registry,
    });
    await expect(
      runtime.run(
        boundEmployee({ name: "weird", version: "1.0.0" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow('declares unknown permission "nope"');
  });

  // T5 : version exacte liee, jamais latest ; maxSteps restreint seulement.
  it("runs the exact bound version and caps maxSteps", async () => {
    const registry = registryWith(
      { ...engineer, version: "1.0.0", systemPrompt: "Prompt v1." },
      { ...engineer, version: "1.1.0", systemPrompt: "Prompt v1.1." }
    );
    const provider = new ScriptedProvider(["FINAL: done"]);
    const runtime = new EmployeeRuntime(provider, { profiles: registry });

    await runtime.run(
      boundEmployee({ name: "software-engineer", version: "1.0.0" }),
      createEmployeeMission({ prompt: "Do it" })
    );

    const system = provider.seen[0].messages[0].content;
    expect(system).toContain("Prompt v1.");
    expect(system).not.toContain("Prompt v1.1.");
    expect(system).toContain("[SPECIALIZATION software-engineer v1.0.0");

    const widening = new EmployeeRuntime(provider, {
      profiles: registry,
      maxSteps: 50,
    });
    await expect(
      widening.run(
        boundEmployee({ name: "software-engineer", version: "1.0.0" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow("exceeds profile");

    const narrowing = new EmployeeRuntime(new ScriptedProvider(["FINAL: ok"]), {
      profiles: registry,
      maxSteps: 2,
    });
    const narrowed = await narrowing.run(
      boundEmployee({ name: "software-engineer", version: "1.0.0" }),
      createEmployeeMission({ prompt: "Do it" })
    );
    expect(narrowed.mission.status).toBe("completed");
  });

  it("refuses a mis-authorized spec before any LLM call", async () => {
    const provider = new ScriptedProvider(["FINAL: done"]);
    const generate = vi.spyOn(provider, "generate");
    const runtime = new EmployeeRuntime(provider, {
      profiles: registryWith(sneaky),
    });

    await expect(
      runtime.run(
        boundEmployee({ name: "sneaky", version: "1.0.0" }),
        createEmployeeMission({ prompt: "Do it" })
      )
    ).rejects.toThrow("without required permission");

    expect(generate).not.toHaveBeenCalled();
  });
});
