import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVITY_LOG_FILE,
  authedRemoteUrl,
  createGithubCloneTool,
  createGithubCreateIssueTool,
  createGithubCreatePrTool,
  createGithubForkTool,
  createGithubPushTool,
  scrubToken,
} from "./github";
import type { ToolContext } from "./tool";

const execFileAsync = promisify(execFile);
const TOKEN = "gh-test-token";

describe("github tools", () => {
  let dir = "";
  let extraDirs: string[] = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
    for (const extra of extraDirs) {
      await rm(extra, { recursive: true, force: true });
    }
    extraDirs = [];
  });

  async function sandbox(): Promise<ToolContext> {
    dir = await mkdtemp(join(tmpdir(), "emp-github-"));
    return { sandboxRoot: dir, env: { GITHUB_TOKEN: TOKEN } };
  }

  async function activityLines(): Promise<string[]> {
    const content = await readFile(join(dir, ACTIVITY_LOG_FILE), "utf8");
    return content.trim().split("\n");
  }

  function mockFetchOnce(status: number, body: unknown) {
    const stub = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", stub);
    return stub;
  }

  async function localSourceRepo(): Promise<string> {
    const src = await mkdtemp(join(tmpdir(), "emp-gh-src-"));
    extraDirs.push(src);
    await execFileAsync("git", ["init"], { cwd: src });
    await execFileAsync("git", ["config", "user.email", "t@t.t"], { cwd: src });
    await execFileAsync("git", ["config", "user.name", "t"], { cwd: src });
    await writeFile(join(src, "README.md"), "hello\n", "utf8");
    await execFileAsync("git", ["add", "-A"], { cwd: src });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: src });
    return src;
  }

  it("scrubs the token from outputs and builds authed https URLs", () => {
    expect(scrubToken(`Bearer ${TOKEN} ok`, TOKEN)).toBe("Bearer *** ok");
    expect(authedRemoteUrl("https://github.com/o/r.git", TOKEN)).toBe(
      `https://x-access-token:${TOKEN}@github.com/o/r.git`
    );
    expect(authedRemoteUrl("file:///tmp/x", TOKEN)).toBe("file:///tmp/x");
  });

  it("authedRemoteUrl injects credentials exactly once (idempotent)", () => {
    const clean = "https://github.com/o/r.git";
    const authed = `https://x-access-token:${TOKEN}@github.com/o/r.git`;
    // Regression E2E : le clone laisse origin authentifiee ; re-injecter
    // par-dessus produisait "URL rejected: Port number...".
    expect(authedRemoteUrl(authed, TOKEN)).toBe(authed);
    expect(authedRemoteUrl("https://user:pass@github.com/o/r.git", TOKEN)).toBe(
      authed
    );
    expect(authedRemoteUrl("https://user@github.com/o/r.git", TOKEN)).toBe(
      authed
    );
  });

  it("github_fork posts to the API and logs activity", async () => {
    const ctx = await sandbox();
    const stub = mockFetchOnce(202, {
      full_name: "me/Hello-World",
      default_branch: "main",
    });

    const result = await createGithubForkTool().execute(
      { repo: "octocat/Hello-World" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("me/Hello-World");
    expect(stub).toHaveBeenCalledTimes(1);
    const [url, init] = stub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/octocat/Hello-World/forks");
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>).authorization
    ).toBe(`Bearer ${TOKEN}`);
    const lines = await activityLines();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).message).toContain("Forking octocat/Hello-World");
  });

  it("github_fork maps API errors without leaking the token", async () => {
    const ctx = await sandbox();
    mockFetchOnce(422, { message: "forking is disabled" });

    const result = await createGithubForkTool().execute(
      { repo: "octocat/Hello-World" },
      ctx
    );

    expect(result.ok).toBe(false);
    expect(result.output).toContain("HTTP 422: forking is disabled");
    expect(result.output).not.toContain(TOKEN);
  });

  it("github tools reject missing token and bad arguments", async () => {
    const ctx = await sandbox();
    const noToken: ToolContext = { sandboxRoot: dir };
    expect(
      (await createGithubForkTool().execute({ repo: "o/r" }, noToken)).ok
    ).toBe(false);
    expect(
      (await createGithubForkTool().execute({ repo: "nope" }, ctx)).ok
    ).toBe(false);
    expect(
      (
        await createGithubCreateIssueTool().execute(
          { repo: "o/r", title: "" },
          ctx
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await createGithubCloneTool().execute(
          { repo: "o/r", dir: "../escape" },
          ctx
        )
      ).ok
    ).toBe(false);
  });

  it("github_clone clones a local repo into the workspace", async () => {
    const ctx = await sandbox();
    const src = await localSourceRepo();

    const result = await createGithubCloneTool().execute(
      { repo: `file://${src}`, dir: "demo" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("demo/");
    expect(await readFile(join(dir, "demo", "README.md"), "utf8")).toBe("hello\n");
    const lines = await activityLines();
    expect(JSON.parse(lines[0]).tool).toBe("github_clone");
  });

  it("github_create_issue posts title and body", async () => {
    const ctx = await sandbox();
    const stub = mockFetchOnce(201, {
      number: 42,
      html_url: "https://github.com/me/r/issues/42",
    });

    const result = await createGithubCreateIssueTool().execute(
      { repo: "me/r", title: "Bug: typo", body: "details" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("#42");
    const [, init] = stub.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      title: "Bug: typo",
      body: "details",
    });
  });

  it("github_create_pr resolves the default base branch", async () => {
    const ctx = await sandbox();
    const stub = vi.fn(async (url: string) => {
      if (url.endsWith("/repos/me/r")) {
        return new Response(JSON.stringify({ default_branch: "trunk" }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ number: 7, html_url: "https://github.com/me/r/pull/7" }),
        { status: 201 }
      );
    });
    vi.stubGlobal("fetch", stub);

    const result = await createGithubCreatePrTool().execute(
      { repo: "me/r", head: "fix", title: "Fix it" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("#7");
    expect(result.output).toContain("trunk");
    expect(stub).toHaveBeenCalledTimes(2);
    const [, init] = stub.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      head: "fix",
      base: "trunk",
    });
  });

  it("github_create_pr honors an explicit base without extra calls", async () => {
    const ctx = await sandbox();
    const stub = mockFetchOnce(201, { number: 8 });

    const result = await createGithubCreatePrTool().execute(
      { repo: "me/r", head: "fix", base: "main", title: "Fix it" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("github_push commits and pushes a new branch to a local remote", async () => {
    const ctx = await sandbox();
    const src = await localSourceRepo();
    const clone = await createGithubCloneTool().execute(
      { repo: `file://${src}`, dir: "work" },
      ctx
    );
    expect(clone.ok).toBe(true);
    await writeFile(join(dir, "work", "README.md"), "hello atlas\n", "utf8");

    const result = await createGithubPushTool().execute(
      { dir: "work", branch: "atlas/demo", message: "docs: atlas line" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(result.output).toContain("atlas/demo");
    const { stdout } = await execFileAsync(
      "git",
      ["ls-remote", src, "atlas/demo"],
      { cwd: dir }
    );
    expect(stdout).toContain("refs/heads/atlas/demo");
  });

  it("github_push pushes clean trees instead of silently skipping", async () => {
    const ctx = await sandbox();
    const src = await localSourceRepo();
    await createGithubCloneTool().execute(
      { repo: `file://${src}`, dir: "work" },
      ctx
    );

    const result = await createGithubPushTool().execute(
      { dir: "work", branch: "atlas/noop", message: "noop" },
      ctx
    );

    // Contrat corrige (incident E2E) : "rien a commiter" n'est pas
    // "rien a pusher" — un retry doit converger vers la branche poussee.
    expect(result.ok).toBe(true);
    expect(result.output).toContain("Pushed atlas/noop");
    const { stdout } = await execFileAsync(
      "git",
      ["ls-remote", src, "atlas/noop"],
      { cwd: dir }
    );
    expect(stdout).toContain("refs/heads/atlas/noop");
  });

  it("github_push re-pushes a locally committed branch missing from the remote", async () => {
    const ctx = await sandbox();
    const src = await localSourceRepo();
    await createGithubCloneTool().execute(
      { repo: `file://${src}`, dir: "work" },
      ctx
    );
    await writeFile(join(dir, "work", "README.md"), "hello atlas\n", "utf8");
    const first = await createGithubPushTool().execute(
      { dir: "work", branch: "atlas/demo", message: "docs: atlas line" },
      ctx
    );
    expect(first.ok).toBe(true);

    // Incident E2E : le commit existe en local mais la branche n'a
    // jamais atterri sur le remote (moitie push avortee).
    await execFileAsync("git", ["branch", "-D", "atlas/demo"], { cwd: src });

    const retry = await createGithubPushTool().execute(
      { dir: "work", branch: "atlas/demo", message: "docs: atlas line" },
      ctx
    );

    expect(retry.ok).toBe(true);
    const { stdout } = await execFileAsync(
      "git",
      ["ls-remote", src, "atlas/demo"],
      { cwd: dir }
    );
    expect(stdout).toContain("refs/heads/atlas/demo");
  });
});
