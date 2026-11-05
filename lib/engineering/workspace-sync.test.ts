// lib/engineering/workspace-sync.test.ts
// Contrat de la synchro disque -> miroir DB (WorkspaceFile).
// Execution : node --test lib/engineering/workspace-sync.test.ts
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_FILE_BYTES } from "./files.ts";
import {
  SYNC_MAX_FILE_BYTES,
  snapshotWorkspaceDir,
  syncWorkspaceToDb,
  type WorkspaceMirrorStore,
  type WorkspaceSnapshotFile,
} from "./workspace-sync.ts";

function memoryStore(
  initial: ReadonlyArray<{ path: string; sha256: string }> = []
): WorkspaceMirrorStore & {
  rows: Map<string, WorkspaceSnapshotFile>;
  deleted: string[][];
} {
  const rows = new Map<string, WorkspaceSnapshotFile>();
  for (const row of initial) {
    rows.set(row.path, {
      path: row.path,
      content: "",
      size: 0,
      sha256: row.sha256,
    });
  }
  const deleted: string[][] = [];
  return {
    rows,
    deleted,
    list: async () =>
      [...rows.values()].map((row) => ({
        path: row.path,
        sha256: row.sha256,
      })),
    upsert: async (files) => {
      for (const file of files) {
        rows.set(file.path, file);
      }
    },
    deleteNotIn: async (paths) => {
      deleted.push([...paths]);
      let count = 0;
      for (const path of [...rows.keys()]) {
        if (!paths.includes(path)) {
          rows.delete(path);
          count += 1;
        }
      }
      return count;
    },
  };
}

async function makeWorkspace(
  files: Record<string, string | Buffer>
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "workspace-sync-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content);
  }
  return dir;
}

describe("snapshotWorkspaceDir", () => {
  it("photographie les fichiers tries, avec SHA-256", async () => {
    const dir = await makeWorkspace({
      "b.py": "print(2)\n",
      "a.py": "print(1)\n",
    });
    try {
      const snapshot = await snapshotWorkspaceDir(dir);
      assert.equal(snapshot.files.length, 2);
      assert.deepEqual(
        snapshot.files.map((file) => file.path),
        ["a.py", "b.py"]
      );
      assert.match(snapshot.files[0]?.sha256 ?? "", /^[0-9a-f]{64}$/);
      assert.equal(snapshot.truncated, false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignore .git, archive et le journal d'activite", async () => {
    const dir = await makeWorkspace({
      "src/app.py": "print(1)\n",
      ".git/config": "[core]\n",
      "archive/old.txt": "vieux\n",
      ".employee-activity.log": '{"message":"run"}\n',
    });
    try {
      const snapshot = await snapshotWorkspaceDir(dir);
      assert.deepEqual(
        snapshot.files.map((file) => file.path),
        ["src/app.py"]
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("saute le binaire et le surdimensionne (compteurs)", async () => {
    const dir = await makeWorkspace({
      "ok.txt": "lisible\n",
      "image.png": Buffer.from([0x89, 0x50, 0x00, 0x01]),
      "gros.txt": "x".repeat(100),
    });
    try {
      const snapshot = await snapshotWorkspaceDir(dir, {
        maxFileBytes: 10,
      });
      assert.deepEqual(
        snapshot.files.map((file) => file.path),
        ["ok.txt"]
      );
      assert.equal(snapshot.skippedBinary, 1);
      assert.equal(snapshot.skippedOversized, 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("dossier absent -> photographie vide, jamais d'exception", async () => {
    const snapshot = await snapshotWorkspaceDir(
      join(tmpdir(), "workspace-sync-absent-test")
    );
    assert.deepEqual(snapshot.files, []);
  });
});

describe("syncWorkspaceToDb", () => {
  it("ecrit tout au premier passage", async () => {
    const dir = await makeWorkspace({ "a.py": "print(1)\n" });
    const store = memoryStore();
    try {
      const result = await syncWorkspaceToDb({ dir, store });
      assert.equal(result.status, "synced");
      assert.equal(result.scanned, 1);
      assert.equal(result.written, 1);
      assert.equal(result.deleted, 0);
      assert.equal(store.rows.get("a.py")?.content, "print(1)\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("n'ecrit que les contenus modifies (SHA-256)", async () => {
    const dir = await makeWorkspace({
      "stable.py": "print(1)\n",
      "change.py": "v2\n",
    });
    const first = memoryStore();
    try {
      await syncWorkspaceToDb({ dir, store: first });
      const fingerprints = await first.list();
      const second = memoryStore(fingerprints);
      // Le contenu reel du miroir ne change pas : seul le SHA compte.
      const result = await syncWorkspaceToDb({ dir, store: second });
      assert.equal(result.written, 0);
      assert.equal(result.deleted, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("elague les chemins disparus du disque", async () => {
    const dir = await makeWorkspace({ "reste.py": "print(1)\n" });
    const store = memoryStore([
      { path: "reste.py", sha256: "x" },
      { path: "supprime.py", sha256: "y" },
    ]);
    try {
      const result = await syncWorkspaceToDb({ dir, store });
      assert.equal(result.deleted, 1);
      assert.equal(store.rows.has("supprime.py"), false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("disque absent -> no-op, le miroir est conserve", async () => {
    const store = memoryStore([{ path: "a.py", sha256: "x" }]);
    const result = await syncWorkspaceToDb({
      dir: join(tmpdir(), "workspace-sync-absent-test"),
      store,
    });
    assert.equal(result.status, "no-workspace");
    assert.equal(store.rows.has("a.py"), true);
    assert.equal(store.deleted.length, 0);
  });

  it("photographie tronquee -> elagage suspendu", async () => {
    const dir = await makeWorkspace({
      "a.py": "1\n",
      "b.py": "2\n",
    });
    const store = memoryStore([{ path: "b.py", sha256: "zzz" }]);
    try {
      const result = await syncWorkspaceToDb({
        dir,
        store,
        limits: { maxFiles: 1 },
      });
      assert.equal(result.truncated, true);
      assert.equal(result.deleted, 0);
      assert.equal(store.deleted.length, 0);
      assert.equal(store.rows.has("b.py"), true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("constantes miroirs", () => {
  it("le plafond de synchro suit le plafond IDE", () => {
    assert.equal(SYNC_MAX_FILE_BYTES, MAX_FILE_BYTES);
  });
});
