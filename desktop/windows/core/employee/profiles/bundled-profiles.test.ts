import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadProfileRegistry } from "./profile-registry";

describe("bundled profiles", () => {
  it("loads and validates the shipped JSON profiles", async () => {
    const registry = await loadProfileRegistry(
      fileURLToPath(new URL(".", import.meta.url))
    );

    expect(registry.list().map((spec) => spec.name).sort()).toEqual([
      "aria-data-analyst",
      "atlas-software-engineer",
      "chef-manager",
      "data-analyst",
      "milo-content-strategist",
      "newton-researcher",
      "nova-devops-engineer",
      "researcher",
      "sana-seo-analyst",
      "software-engineer",
    ]);
    // Moindre privilege du researcher : pas de shell.
    expect(registry.get("researcher")?.allowedTools).not.toContain("run_shell");
    // L'ingenieur a le shell + sa permission.
    expect(registry.get("software-engineer")?.allowedTools).toContain(
      "run_shell"
    );
    expect(registry.get("software-engineer")?.permissions).toContain(
      "shell:exec"
    );
    // Le Manager accueille et guide : lecture seule, jamais de shell
    // ni d'ecriture (moindre privilege + prompt qui interdit les
    // missions techniques).
    expect(registry.get("chef-manager")?.role).toBe("Manager");
    expect(registry.get("chef-manager")?.allowedTools).toEqual([
      "read_file",
    ]);
    expect(registry.get("chef-manager")?.permissions).toEqual([
      "fs:read",
    ]);
  });
});
