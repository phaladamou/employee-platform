import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { issueCredential, verifyCredential } from "./employee-credential";
import { FileCredentialStore } from "./file-credential-store";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const TOKEN = "emk_test-token-value";

describe("FileCredentialStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeStore(): Promise<{ store: FileCredentialStore; dir: string }> {
    dir = await mkdtemp(join(tmpdir(), "emp-cred-"));
    return { store: new FileCredentialStore({ directory: dir }), dir };
  }

  function issue(label = "cli-local") {
    return issueCredential({
      employeeId: "emp_ada",
      label,
      scopes: ["missions:submit"],
      id: `cred_${label}`,
      token: TOKEN,
      now: NOW,
    });
  }

  it("round-trips credentials and lists per employee", async () => {
    const { store } = await makeStore();
    const { credential } = issue();

    await store.save(credential);

    expect(await store.findByHash(credential.tokenHash)).toEqual(credential);
    expect(await store.findByHash("nope")).toBeNull();
    expect(await store.list("emp_ada")).toEqual([credential]);
    expect(await store.list("emp_unknown")).toEqual([]);
  });

  it("never writes the cleartext token to disk", async () => {
    const { store, dir: root } = await makeStore();
    const { credential } = issue();
    await store.save(credential);

    const raw = await readFile(join(root, "credentials.json"), "utf8");
    expect(raw).toContain(credential.tokenHash);
    expect(raw).not.toContain(TOKEN);
  });

  it("revocation persists across instances and kills verification", async () => {
    const { store, dir: root } = await makeStore();
    const { credential } = issue();
    await store.save(credential);
    await store.revoke(credential.id, NOW);

    const reopened = new FileCredentialStore({ directory: root });
    const [listed] = await reopened.list("emp_ada");
    expect(listed.revokedAt).toBe("2026-10-30T12:00:00.000Z");
    await expect(
      verifyCredential(reopened, TOKEN, { now: NOW })
    ).resolves.toBeNull();
  });

  it("revoking an unknown id throws", async () => {
    const { store } = await makeStore();
    await expect(store.revoke("cred_nope", NOW)).rejects.toThrow(
      "Unknown credential: cred_nope"
    );
  });

  it("quarantines corrupt files and fails closed", async () => {
    const { store, dir: root } = await makeStore();
    await writeFile(join(root, "credentials.json"), "{oops", "utf8");

    expect(await store.list("emp_ada")).toEqual([]);

    const files = await readdir(root);
    expect(files.some((f) => f.endsWith(".bak"))).toBe(true);
  });

  // chmod POSIX uniquement (no-op sous Windows).
  it.runIf(process.platform !== "win32")(
    "restricts credentials file to owner (0600)",
    async () => {
      const { store, dir: root } = await makeStore();
      await store.save(issue().credential);

      const { mode } = await stat(join(root, "credentials.json"));
      expect(mode & 0o777).toBe(0o600);
    }
  );

  it("creates directories on save", async () => {
    const { dir: root } = await makeStore();
    const nested = join(root, "deep", "auth");
    const store = new FileCredentialStore({ directory: nested });

    await store.save(issue().credential);

    const raw = await readFile(join(nested, "credentials.json"), "utf8");
    expect(JSON.parse(raw).credentials).toHaveLength(1);
  });
});
