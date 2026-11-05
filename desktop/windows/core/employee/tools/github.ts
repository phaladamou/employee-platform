import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { appendActivity } from "./activity";
import {
  resolveWithinRoot,
  toolFail,
  toolOk,
  toolRoot,
  type EmployeeTool,
  type ToolArgs,
  type ToolContext,
} from "./tool";

const execFileAsync = promisify(execFile);

const GITHUB_API = "https://api.github.com";
const API_TIMEOUT_MS = 30_000;
const GIT_TIMEOUT_MS = 120_000;
// Un fork GitHub met quelques secondes a etre clonable : le clone
// reessaie au lieu de faire echouer la mission du premier coup.
const CLONE_ATTEMPTS = 3;
const CLONE_RETRY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const GIT_BOT_NAME = "Atlas";
const GIT_BOT_EMAIL = "atlas@employee-platform.local";
// Branches protegees : Atlas pousse sur des branches de travail et
// ouvre des PRs, jamais directement sur la branche par defaut.
const PROTECTED_BRANCHES = new Set(["main", "master"]);

// Guidage paresseux : l'echec d'authentification n'arrete pas la
// mission — Atlas fait d'abord la partie publique, puis demande
// le compte ou transmet ses modifications locales.
const CONNECT_GUIDANCE =
  "Do what you can without it first (clone, read, edit locally), then ask the user to connect GitHub in Settings to continue — or hand off your local changes for them to apply.";

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toolToken(ctx: ToolContext): string | null {
  const token = ctx.env?.GITHUB_TOKEN;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/** Retire le token de tout texte destine au LLM ou aux logs. */
export function scrubToken(text: string, token: string): string {
  if (!token) {
    return text;
  }
  return text.split(token).join("***");
}

function splitRepo(repo: string): { owner: string; name: string } | null {
  const match = /^([^/\s]+)\/([^/\s]+?)(\.git)?$/.exec(repo.trim());
  if (!match) {
    return null;
  }
  return { owner: match[1], name: match[2] };
}

async function githubApi(
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "employee-atlas",
        ...(body === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `GitHub API unreachable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { message?: unknown };
      if (typeof data.message === "string" && data.message) {
        detail = `HTTP ${response.status}: ${data.message}`;
      }
    } catch {
      // Corps illisible : garder le statut seul.
    }
    throw new Error(`GitHub API ${method} ${path} failed: ${detail}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Injecte le token dans une URL https, laisse les autres (file://...)
 * telles quelles. Idempotent : un userinfo existant est remplace,
 * jamais empile — sinon git rejette l'URL ("Port number was not a
 * decimal number"). Sans token : URL publique inchangee.
 */
export function authedRemoteUrl(url: string, token: string | null): string {
  if (!token || !url.startsWith("https://")) {
    return url;
  }
  return stripCredentials(url).replace(
    "https://",
    `https://x-access-token:${token}@`
  );
}

/** Retire userinfo (tokens) d'une URL avant stockage disque (.git/config). */
export function stripCredentials(url: string): string {
  return url.replace(/^(https:\/\/)[^/]*@/, "$1");
}

function cloneSource(repo: string, token: string | null): string {
  if (repo.includes("://")) {
    return authedRemoteUrl(repo, token);
  }
  const parts = splitRepo(repo);
  if (!parts) {
    throw new Error(`invalid repository "${repo}" (want "owner/name" or a URL)`);
  }
  return authedRemoteUrl(
    `https://github.com/${parts.owner}/${parts.name}.git`,
    token
  );
}

function defaultCloneDir(repo: string): string {
  const clean = repo.replace(/\/+$/, "").replace(/\.git$/, "");
  const segment = clean.includes("://")
    ? clean.split("/").pop() ?? "repo"
    : (splitRepo(clean)?.name ?? "repo");
  return segment || "repo";
}

async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    const message =
      error instanceof Error && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr ?? error.message)
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(`git ${args[0] ?? ""} failed: ${message.trim()}`);
  }
}

export function createGithubForkTool(): EmployeeTool {
  return {
    name: "github_fork",
    description:
      "Fork a GitHub repository into the authenticated account. Returns the fork full name. Requires a connected GitHub account.",
    argsDescription: '{ "repo": "<owner/name>" }',
    async execute(args: ToolArgs, ctx: ToolContext) {
      const repo = asNonEmptyString(args.repo);
      const parts = repo ? splitRepo(repo) : null;
      if (!repo || !parts) {
        return toolFail('github_fork requires a "repo" ("owner/name") argument');
      }
      const token = toolToken(ctx);
      if (!token) {
        return toolFail(
          `github_fork requires a connected GitHub account. ${CONNECT_GUIDANCE}`
        );
      }
      await appendActivity(ctx, "github_fork", `Forking ${repo}...`, true);
      try {
        const data = await githubApi(
          token,
          "POST",
          `/repos/${parts.owner}/${parts.name}/forks`
        );
        const fullName = typeof data.full_name === "string" ? data.full_name : repo;
        const branch =
          typeof data.default_branch === "string" ? data.default_branch : "main";
        return toolOk(`Forked ${repo} into ${fullName} (default branch: ${branch}).`);
      } catch (error) {
        const message = scrubToken(
          error instanceof Error ? error.message : String(error),
          token
        );
        await appendActivity(ctx, "github_fork", `Fork failed: ${message}`, false);
        return toolFail(`github_fork: ${message}`);
      }
    },
  };
}

export function createGithubCloneTool(): EmployeeTool {
  return {
    name: "github_clone",
    description:
      "Clone a GitHub repository (or any git URL) into the workspace. Returns the directory. Public repositories clone without an account; private ones need a connected GitHub account.",
    argsDescription: '{ "repo": "<owner/name or URL>", "dir": "<optional target directory>" }',
    async execute(args: ToolArgs, ctx: ToolContext) {
      const repo = asNonEmptyString(args.repo);
      if (!repo) {
        return toolFail('github_clone requires a "repo" argument');
      }
      // Pas de compte requis : les depots publics se clonent sans
      // authentification. Les depots prives echouent naturellement.
      const token = toolToken(ctx);
      const dir = asNonEmptyString(args.dir) ?? defaultCloneDir(repo);
      let target: string;
      try {
        target = await resolveWithinRoot(toolRoot(ctx), dir);
      } catch {
        return toolFail(`path escapes the workspace: ${dir}`);
      }
      let source: string;
      try {
        source = cloneSource(repo, token);
      } catch (error) {
        return toolFail(
          `github_clone: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      await appendActivity(ctx, "github_clone", `Cloning ${repo} into ${dir}...`, true);
      try {
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= CLONE_ATTEMPTS; attempt += 1) {
          try {
            await runGit(["clone", "--depth", "50", source, target], toolRoot(ctx));
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < CLONE_ATTEMPTS) {
              await sleep(CLONE_RETRY_MS);
            }
          }
        }
        if (lastError) {
          throw lastError;
        }
        // Hygiene credential : origin reste publique sur disque, le
        // token ne persiste jamais dans .git/config.
        await runGit(
          ["remote", "set-url", "origin", stripCredentials(source)],
          target
        );
        return toolOk(
          `Cloned ${repo} into ${dir}/. Read or edit files with paths like ${dir}/README.md.`
        );
      } catch (error) {
        const message = scrubToken(
          error instanceof Error ? error.message : String(error),
          token ?? ""
        );
        await appendActivity(ctx, "github_clone", `Clone failed: ${message}`, false);
        return toolFail(`github_clone: ${message}`);
      }
    },
  };
}

export function createGithubCreateIssueTool(): EmployeeTool {
  return {
    name: "github_create_issue",
    description:
      "Create a GitHub issue. Returns the issue number and URL. Requires a connected GitHub account.",
    argsDescription:
      '{ "repo": "<owner/name>", "title": "<title>", "body": "<optional body>" }',
    async execute(args: ToolArgs, ctx: ToolContext) {
      const repo = asNonEmptyString(args.repo);
      const parts = repo ? splitRepo(repo) : null;
      const title = asNonEmptyString(args.title);
      if (!repo || !parts) {
        return toolFail('github_create_issue requires a "repo" ("owner/name") argument');
      }
      if (!title) {
        return toolFail('github_create_issue requires a "title" argument');
      }
      const token = toolToken(ctx);
      if (!token) {
        return toolFail(
          `github_create_issue requires a connected GitHub account. ${CONNECT_GUIDANCE}`
        );
      }
      const body = asNonEmptyString(args.body);
      await appendActivity(
        ctx,
        "github_create_issue",
        `Creating issue "${title}" on ${repo}...`,
        true
      );
      try {
        const data = await githubApi(
          token,
          "POST",
          `/repos/${parts.owner}/${parts.name}/issues`,
          { title, ...(body ? { body } : {}) }
        );
        const number = typeof data.number === "number" ? data.number : "?";
        const url = typeof data.html_url === "string" ? ` ${data.html_url}` : "";
        return toolOk(`Created issue #${number} on ${repo}.${url}`);
      } catch (error) {
        const message = scrubToken(
          error instanceof Error ? error.message : String(error),
          token
        );
        await appendActivity(ctx, "github_create_issue", `Issue failed: ${message}`, false);
        return toolFail(`github_create_issue: ${message}`);
      }
    },
  };
}

export function createGithubCreatePrTool(): EmployeeTool {
  return {
    name: "github_create_pr",
    description:
      "Open a GitHub pull request from a pushed branch. Returns the PR number and URL. Requires a connected GitHub account.",
    argsDescription:
      '{ "repo": "<owner/name>", "head": "<branch>", "base": "<optional base branch>", "title": "<title>", "body": "<optional body>" }',
    async execute(args: ToolArgs, ctx: ToolContext) {
      const repo = asNonEmptyString(args.repo);
      const parts = repo ? splitRepo(repo) : null;
      const head = asNonEmptyString(args.head);
      const title = asNonEmptyString(args.title);
      if (!repo || !parts) {
        return toolFail('github_create_pr requires a "repo" ("owner/name") argument');
      }
      if (!head) {
        return toolFail('github_create_pr requires a "head" branch argument');
      }
      if (!title) {
        return toolFail('github_create_pr requires a "title" argument');
      }
      const token = toolToken(ctx);
      if (!token) {
        return toolFail(
          `github_create_pr requires a connected GitHub account. ${CONNECT_GUIDANCE}`
        );
      }
      const body = asNonEmptyString(args.body);
      await appendActivity(
        ctx,
        "github_create_pr",
        `Opening PR "${title}" (${head}) on ${repo}...`,
        true
      );
      try {
        let base = asNonEmptyString(args.base);
        if (!base) {
          const info = await githubApi(
            token,
            "GET",
            `/repos/${parts.owner}/${parts.name}`
          );
          base =
            typeof info.default_branch === "string" && info.default_branch
              ? info.default_branch
              : "main";
        }
        const data = await githubApi(
          token,
          "POST",
          `/repos/${parts.owner}/${parts.name}/pulls`,
          { title, head, base, ...(body ? { body } : {}) }
        );
        const number = typeof data.number === "number" ? data.number : "?";
        const url = typeof data.html_url === "string" ? ` ${data.html_url}` : "";
        return toolOk(`Opened PR #${number} (${head} into ${base}) on ${repo}.${url}`);
      } catch (error) {
        const message = scrubToken(
          error instanceof Error ? error.message : String(error),
          token
        );
        await appendActivity(ctx, "github_create_pr", `PR failed: ${message}`, false);
        return toolFail(`github_create_pr: ${message}`);
      }
    },
  };
}

export function createGithubPushTool(): EmployeeTool {
  return {
    name: "github_push",
    description:
      "Commit all changes in a workspace directory on a branch and push it to the remote. Refuses protected branches (main, master): push a feature branch and open a PR instead. Requires a connected GitHub account.",
    argsDescription:
      '{ "dir": "<workspace directory>", "branch": "<branch name>", "message": "<commit message>" }',
    async execute(args: ToolArgs, ctx: ToolContext) {
      const dir = asNonEmptyString(args.dir);
      const branch = asNonEmptyString(args.branch);
      const message = asNonEmptyString(args.message);
      if (!dir) {
        return toolFail('github_push requires a "dir" argument');
      }
      if (!branch) {
        return toolFail('github_push requires a "branch" argument');
      }
      if (PROTECTED_BRANCHES.has(branch)) {
        return toolFail(
          `github_push refuses to push to protected branch "${branch}" (push a feature branch and open a PR instead)`
        );
      }
      if (!message) {
        return toolFail('github_push requires a "message" argument');
      }
      const token = toolToken(ctx);
      if (!token) {
        return toolFail(
          `github_push requires a connected GitHub account. ${CONNECT_GUIDANCE}`
        );
      }
      let target: string;
      try {
        target = await resolveWithinRoot(toolRoot(ctx), dir);
      } catch {
        return toolFail(`path escapes the workspace: ${dir}`);
      }
      const scrub = (text: string): string => scrubToken(text, token);
      await appendActivity(
        ctx,
        "github_push",
        `Pushing ${branch} from ${dir}...`,
        true
      );
      try {
        await runGit(["checkout", "-B", branch], target);
        await runGit(["add", "-A"], target);
        const status = await runGit(["status", "--porcelain"], target);
        // Arbre propre = rien a commiter, mais le push a lieu quand meme :
        // un retry doit converger vers la branche poussee, pas declarer
        // victoire sur une branche jamais envoyee.
        if (status) {
          await runGit(
            [
              "-c",
              `user.name=${GIT_BOT_NAME}`,
              "-c",
              `user.email=${GIT_BOT_EMAIL}`,
              "commit",
              "-m",
              message,
            ],
            target
          );
        }
        const remote = await runGit(["remote", "get-url", "origin"], target);
        const publicRemote = stripCredentials(remote);
        try {
          await runGit(
            ["remote", "set-url", "origin", authedRemoteUrl(publicRemote, token)],
            target
          );
          await runGit(["push", "-u", "origin", branch], target);
        } finally {
          // Restauration best-effort : le token ne persiste jamais
          // dans .git/config, succes comme echec du push.
          try {
            await runGit(["remote", "set-url", "origin", publicRemote], target);
          } catch {
            // Un set-url local n'echoue quasiment jamais ; ne pas
            // masquer le resultat du push.
          }
        }
        return toolOk(
          status
            ? `Pushed ${branch} from ${dir}/ to origin.`
            : `Pushed ${branch} from ${dir}/ to origin (nothing new to commit).`
        );
      } catch (error) {
        const detail = scrub(
          error instanceof Error ? error.message : String(error)
        );
        await appendActivity(ctx, "github_push", `Push failed: ${detail}`, false);
        return toolFail(`github_push: ${detail}`);
      }
    },
  };
}

/** Les 5 outils GitHub d'un Employee (derriere la permission "github:api"). */
export function createGithubTools(): EmployeeTool[] {
  return [
    createGithubForkTool(),
    createGithubCloneTool(),
    createGithubCreateIssueTool(),
    createGithubCreatePrTool(),
    createGithubPushTool(),
  ];
}
