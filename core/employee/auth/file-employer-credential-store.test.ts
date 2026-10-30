import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { issueEmployerCredential, verifyEmployerCredential } from "./employer-credential";
import { FileEmployerCredentialStore } from "./file-employer-credential-store";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const TOKEN = "emo_test-token-value";

describe("FileEmployerCredentialStore", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeStore(): Promise<{ store: FileEmployerCredentialStore; dir: string }> {
    dir = await mkdtemp(join(tmpdir(), "emp-emo-cred-"));
    return { store: new FileEmployerCredentialStore({ directory: dir }), dir };
  }

  it("round-trips and scopes listing per employer", async () => {
    const { store } = await makeStore();
    const { credential } = issueEmployerCredential({
      employerId: "acme",
      label: "k",
      scopes: ["missions:submit"],
      id: "emcred_1",
      token: TOKEN,
      now: NOW,
    });
    await store.save(credential);

    expect(await store.findByHash(credential.tokenHash)).toEqual(credential);
    expect(await store.listByEmployer("acme")).toEqual([credential]);
    expect(await store.listByEmployer("other")).toEqual([]);
  });

  it("never writes the cleartext token to disk", async () => {
    const { store, dir: root } = await makeStore();
    const { credential } = issueEmployerCredential({
      employerId: "acme",
      label: "k",
      scopes: ["missions:submit"],
      token: TOKEN,
      now: NOW,
    });
    await store.save(credential);

    const raw = await readFile(join(root, "employer-credentials.json"), "utf8");
    expect(raw).toContain(credential.tokenHash);
    expect(raw).not.toContain(TOKEN);
  });

  it("revocation persists and kills verification", async () => {
    const { store, dir: root } = await makeStore();
    const { credential } = issueEmployerCredential({
      employerId: "acme",
      label: "k",
      scopes: ["missions:submit"],
      token: TOKEN,
      now: NOW,
    });
    await store.save(credential);
    await store.revoke(credential.id, NOW);

    const reopened = new FileEmployerCredentialStore({ directory: root });
    await expect(
      verifyEmployerCredential(reopened, TOKEN, { now: NOW })
    ).resolves.toBeNull();
  });

  it("quarantines corrupt files and fails closed", async () => {
    const { store, dir: root } = await makeStore();
    await writeFile(join(root, "employer-credentials.json"), "{oops", "utf8");

    expect(await store.listByEmployer("acme")).toEqual([]);

    const files = await readdir(root);
    expect(files.some((f) => f.endsWith(".bak"))).toBe(true);
  });
});
