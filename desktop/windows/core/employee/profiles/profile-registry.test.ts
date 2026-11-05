import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createProfileLockfile,
  createProfileRegistry,
  loadProfileRegistry,
  PROFILE_LOCKFILE_NAME,
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
    await createProfileLockfile(root);

    const registry = await loadProfileRegistry(root);
    expect(registry.get("data-analyst")?.role).toBe("Role");
    expect(registry.list()).toHaveLength(1);
  });

  it("fails loudly on invalid JSON or invalid spec", async () => {
    const root = await makeDir();
    await writeFile(
      join(root, PROFILE_LOCKFILE_NAME),
      JSON.stringify({ version: 1, profiles: {} }),
      "utf8"
    );
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

  it("rejects content modified without a lockfile update", async () => {
    const root = await makeDir();
    const file = join(root, "data-analyst.json");
    await writeFile(file, JSON.stringify(makeSpec("data-analyst", "1.0.0")), "utf8");
    await createProfileLockfile(root);

    // Meme version, prompt altere : le hash ne correspond plus.
    await writeFile(
      file,
      JSON.stringify({ ...makeSpec("data-analyst", "1.0.0"), systemPrompt: "PWNED" }),
      "utf8"
    );

    await expect(loadProfileRegistry(root)).rejects.toThrow(
      'Profile "data-analyst@1.0.0" failed integrity check'
    );
  });

  it("rejects a tool added without a lockfile update", async () => {
    const root = await makeDir();
    const file = join(root, "researcher.json");
    const spec = makeSpec("researcher", "1.0.0");
    await writeFile(file, JSON.stringify(spec), "utf8");
    await createProfileLockfile(root);

    // Scenario privilege escalation : shell ajoute, version inchangee.
    await writeFile(
      file,
      JSON.stringify({
        ...spec,
        allowedTools: ["read_file", "run_shell"],
        permissions: ["fs:read", "shell:exec"],
      }),
      "utf8"
    );

    await expect(loadProfileRegistry(root)).rejects.toThrow(
      'Profile "researcher@1.0.0" failed integrity check'
    );
  });

  it("requires a lockfile and pinned entries by default", async () => {
    const root = await makeDir();
    await writeFile(
      join(root, "data-analyst.json"),
      JSON.stringify(makeSpec("data-analyst", "1.0.0")),
      "utf8"
    );

    await expect(loadProfileRegistry(root)).rejects.toThrow(
      "Missing profile lockfile"
    );

    // Lockfile present mais profil non epingle (fichier ajoute apres).
    await createProfileLockfile(root);
    await writeFile(
      join(root, "researcher.json"),
      JSON.stringify(makeSpec("researcher", "1.0.0")),
      "utf8"
    );
    await expect(loadProfileRegistry(root)).rejects.toThrow(
      'Profile "researcher@1.0.0" is not pinned in lockfile'
    );
  });

  it("rejects corrupt lockfiles", async () => {
    const root = await makeDir();
    await writeFile(
      join(root, "data-analyst.json"),
      JSON.stringify(makeSpec("data-analyst", "1.0.0")),
      "utf8"
    );
    await writeFile(join(root, PROFILE_LOCKFILE_NAME), "{oops", "utf8");

    await expect(loadProfileRegistry(root)).rejects.toThrow(
      "Invalid profile lockfile"
    );
  });

  it("supports a separate read-only lockfile location", async () => {
    const root = await makeDir();
    await writeFile(
      join(root, "data-analyst.json"),
      JSON.stringify(makeSpec("data-analyst", "1.0.0")),
      "utf8"
    );
    const trusted = join(root, "trusted", PROFILE_LOCKFILE_NAME);
    await createProfileLockfile(root, { lockfilePath: trusted });

    // Ancre separee : OK. Colocalise (absent) : refuse.
    const registry = await loadProfileRegistry(root, {
      trust: { lockfilePath: trusted },
    });
    expect(registry.list()).toHaveLength(1);
    await expect(loadProfileRegistry(root)).rejects.toThrow(
      "Missing profile lockfile"
    );
  });

  it("verify:false explicitly skips verification (dev only)", async () => {
    const root = await makeDir();
    await writeFile(
      join(root, "data-analyst.json"),
      JSON.stringify(makeSpec("data-analyst", "1.0.0")),
      "utf8"
    );

    const registry = await loadProfileRegistry(root, {
      trust: { verify: false },
    });
    expect(registry.list()).toHaveLength(1);
  });
});

describe("createProfileLockfile", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  it("writes sorted stable hashes", async () => {
    dir = await mkdtemp(join(tmpdir(), "emp-lock-"));
    await writeFile(
      join(dir, "b.json"),
      JSON.stringify(makeSpec("b-prof", "1.0.0")),
      "utf8"
    );
    await writeFile(
      join(dir, "a.json"),
      JSON.stringify(makeSpec("a-prof", "2.0.0")),
      "utf8"
    );

    const map = await createProfileLockfile(dir);

    expect(Object.keys(map)).toEqual(["a-prof@2.0.0", "b-prof@1.0.0"]);
    expect(map["a-prof@2.0.0"]).toMatch(/^[0-9a-f]{64}$/);
    // Regeneration deterministe.
    expect(await createProfileLockfile(dir)).toEqual(map);
  });
});
