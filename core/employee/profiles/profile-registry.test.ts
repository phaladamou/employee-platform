import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProfileRegistry,
  loadProfileRegistry,
} from "./profile-registry";

function makeSpec(name: string, version: string): unknown {
  return {
    name,
    version,
    role: "Role",
    systemPrompt: "Prompt.",
    allowedTools: ["read_file"],
    permissions: ["fs:read"],
    maxSteps: 8,
  };
}

describe("createProfileRegistry", () => {
  it("resolves exact versions and latest", () => {
    const registry = createProfileRegistry([
      makeSpec("data-analyst", "1.0.0"),
      makeSpec("data-analyst", "1.10.0"),
      makeSpec("data-analyst", "1.2.0"),
      makeSpec("researcher", "2.0.0"),
    ]);

    // Comparaison semver numerique, pas lexicographique (1.10 > 1.2).
    expect(registry.get("data-analyst")?.version).toBe("1.10.0");
    expect(registry.get("data-analyst", "1.0.0")?.version).toBe("1.0.0");
    expect(registry.get("data-analyst", "9.9.9")).toBeNull();
    expect(registry.get("unknown")).toBeNull();
    expect(registry.list()).toHaveLength(4);
  });

  it("rejects invalid specs and duplicates", () => {
    expect(() =>
      createProfileRegistry([{ name: "nope" }])
    ).toThrow("Invalid profile spec at index 0");
    expect(() =>
      createProfileRegistry([
        makeSpec("data-analyst", "1.0.0"),
        makeSpec("data-analyst", "1.0.0"),
      ])
    ).toThrow("Duplicate profile spec: data-analyst@1.0.0");
  });
});

describe("loadProfileRegistry", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeDir(): Promise<string> {
    dir = await mkdtemp(join(tmpdir(), "emp-prof-"));
    return dir;
  }

  it("loads *.json specs and ignores other files", async () => {
    const root = await makeDir();
    await writeFile(
      join(root, "data-analyst.json"),
      JSON.stringify(makeSpec("data-analyst", "1.0.0")),
      "utf8"
    );
    await writeFile(join(root, "README.md"), "# profiles", "utf8");

    const registry = await loadProfileRegistry(root);
    expect(registry.get("data-analyst")?.role).toBe("Role");
    expect(registry.list()).toHaveLength(1);
  });

  it("fails loudly on invalid JSON or invalid spec", async () => {
    const root = await makeDir();
    await writeFile(join(root, "broken.json"), "{oops", "utf8");

    await expect(loadProfileRegistry(root)).rejects.toThrow(
      "Invalid JSON in profile broken.json"
    );

    await writeFile(
      join(root, "broken.json"),
      JSON.stringify({ name: "nope" }),
      "utf8"
    );
    await expect(loadProfileRegistry(root)).rejects.toThrow(
      "Invalid profile registry"
    );
  });

  it("missing directory yields an empty registry", async () => {
    const root = await makeDir();
    const registry = await loadProfileRegistry(join(root, "absent"));
    expect(registry.list()).toEqual([]);
  });
});
