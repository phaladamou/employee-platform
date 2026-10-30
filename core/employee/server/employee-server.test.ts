import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CredentialScope } from "../auth/employee-credential";
import {
  issueEmployerCredential,
  type EmployerCredential,
} from "../auth/employer-credential";
import { FileEmployerCredentialStore } from "../auth/file-employer-credential-store";
import { FileEmploymentStore } from "../employments/file-employment-store";
import { FileJobStore } from "../jobs/file-job-store";
import { FileMissionStore } from "../missions/file-mission-store";
import { FileProfileStore } from "../profile/file-profile-store";
import { createProfileRegistry } from "../profiles/profile-registry";
import { parseServerSentEvents } from "../sdk/rest-contract";
import {
  createEmployeeHandler,
  type EmployeeHttpRequest,
  type EmployeeHttpResponse,
} from "./employee-server";

const SPEC = {
  name: "data-analyst",
  version: "1.0.0",
  role: "Data Analyst",
  systemPrompt: "Analyze.",
  allowedTools: ["read_file"],
  permissions: ["fs:read"],
  maxSteps: 12,
};

const EMPLOYER_SCOPES: CredentialScope[] = [
  "missions:submit",
  "missions:read",
  "memory:read",
  "employments:read",
  "employments:write",
];

describe("createEmployeeHandler", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeWorld(): Promise<{
    handle: ReturnType<typeof createEmployeeHandler>;
    tokens: Record<string, string>;
    credentials: FileEmployerCredentialStore;
    issued: Record<string, EmployerCredential>;
  }> {
    dir = await mkdtemp(join(tmpdir(), "emp-server-"));
    const credentials = new FileEmployerCredentialStore({
      directory: join(dir, "credentials"),
    });
    const handle = createEmployeeHandler({
      profiles: new FileProfileStore({ directory: join(dir, "profiles") }),
      employments: new FileEmploymentStore({
        directory: join(dir, "employments"),
      }),
      missions: new FileMissionStore({ directory: join(dir, "missions") }),
      jobs: new FileJobStore({ directory: join(dir, "jobs") }),
      credentials,
      registry: createProfileRegistry([SPEC]),
      eventsPollMs: 10,
      eventsHeartbeatMs: 60_000,
    });

    async function issue(
      employerId: string,
      scopes: readonly CredentialScope[],
      extra?: { expiresAt?: Date }
    ): Promise<{ credential: EmployerCredential; token: string }> {
      const pair = issueEmployerCredential({
        employerId,
        label: `${employerId}-key`,
        scopes,
        expiresAt: extra?.expiresAt,
      });
      await credentials.save(pair.credential);
      return pair;
    }

    const employer = await issue("acme", EMPLOYER_SCOPES);
    const admin = await issue("admin", [...EMPLOYER_SCOPES, "admin"]);
    const rival = await issue("globex", EMPLOYER_SCOPES);
    const reader = await issue("acme", ["missions:read"]);
    const expired = await issue("acme", EMPLOYER_SCOPES, {
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    return {
      handle,
      credentials,
      tokens: {
        employer: employer.token,
        admin: admin.token,
        rival: rival.token,
        reader: reader.token,
        expired: expired.token,
      },
      issued: { employer: employer.credential },
    };
  }

  async function call(
    handle: ReturnType<typeof createEmployeeHandler>,
    method: string,
    path: string,
    options: { token?: string; body?: unknown; rawBody?: string } = {}
  ): Promise<{ status: number; json: unknown; stream?: AsyncIterable<string> }> {
    const url = new URL(path, "http://test");
    const req: EmployeeHttpRequest = {
      method,
      pathname: url.pathname,
      searchParams: url.searchParams,
      headers:
        options.token !== undefined
          ? { authorization: `Bearer ${options.token}` }
          : {},
      bodyText:
        options.rawBody ??
        (options.body !== undefined ? JSON.stringify(options.body) : ""),
    };
    const res: EmployeeHttpResponse = await handle(req);
    if ("stream" in res) {
      return { status: res.status, json: null, stream: res.stream };
    }
    return { status: res.status, json: JSON.parse(res.body) as unknown };
  }

  async function drain(stream: AsyncIterable<string>): Promise<string> {
    let out = "";
    for await (const chunk of stream) {
      out += chunk;
    }
    return out;
  }

  function statusesOf(sse: string): string[] {
    return parseServerSentEvents(sse).map((event) => event.job.status);
  }

  it("rejects missing, bad, expired or revoked tokens uniformly", async () => {
    const { handle, tokens, credentials, issued } = await makeWorld();

    for (const token of [undefined, "emo_bogus", tokens.expired]) {
      const res = await call(handle, "GET", "/v1/jobs", { token });
      expect(res.status).toBe(401);
      expect(res.json).toEqual({
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    await credentials.revoke(issued.employer.id);
    const revoked = await call(handle, "GET", "/v1/jobs", {
      token: tokens.employer,
    });
    expect(revoked.status).toBe(401);
  });

  it("enforces scopes without leaking which failed", async () => {
    const { handle, tokens } = await makeWorld();

    // missions:read seul : lecture ok, ecriture 401.
    expect(
      (await call(handle, "GET", "/v1/jobs", { token: tokens.reader })).status
    ).toBe(200);
    expect(
      (
        await call(handle, "POST", "/v1/jobs", {
          token: tokens.reader,
          body: { employeeId: "emp_1", prompt: "Hi" },
        })
      ).status
    ).toBe(401);
    expect(
      (
        await call(handle, "POST", "/v1/employees", {
          token: tokens.employer,
          body: { name: "X", role: "Y" },
        })
      ).status
    ).toBe(401);
  });

  it("publishes employees via admin only", async () => {
    const { handle, tokens } = await makeWorld();

    const created = await call(handle, "POST", "/v1/employees", {
      token: tokens.admin,
      body: {
        name: "Aria",
        role: "Data Analyst",
        skills: ["SQL"],
        specialization: { name: "data-analyst", version: "1.0.0" },
      },
    });
    expect(created.status).toBe(201);
    expect((created.json as { id: string }).id).toMatch(/^emp_/);

    const catalog = await call(handle, "GET", "/v1/employees", {
      token: tokens.employer,
    });
    expect(catalog.status).toBe(200);
    expect((catalog.json as unknown[]).length).toBe(1);

    const missing = await call(handle, "POST", "/v1/employees", {
      token: tokens.admin,
      body: { role: "Dev" },
    });
    expect(missing.status).toBe(400);

    const unknownSpec = await call(handle, "POST", "/v1/employees", {
      token: tokens.admin,
      body: {
        name: "Ghost",
        role: "Dev",
        specialization: { name: "nope", version: "1.0.0" },
      },
    });
    expect(unknownSpec.status).toBe(400);
  });

  it("runs the hire -> submit -> status flow", async () => {
    const { handle, tokens } = await makeWorld();
    await call(handle, "POST", "/v1/employees", {
      token: tokens.admin,
      body: { name: "Aria", role: "Dev" },
    });
    const catalog = (await call(handle, "GET", "/v1/employees", {
      token: tokens.employer,
    })).json as { id: string }[];
    const employeeId = catalog[0].id;

    // Sans engagement : 403, pas de fuite.
    const forbidden = await call(handle, "POST", "/v1/jobs", {
      token: tokens.employer,
      body: { employeeId, prompt: "Work" },
    });
    expect(forbidden.status).toBe(403);

    const hired = await call(handle, "POST", "/v1/hires", {
      token: tokens.employer,
      body: { employeeId },
    });
    expect(hired.status).toBe(201);

    const again = await call(handle, "POST", "/v1/hires", {
      token: tokens.employer,
      body: { employeeId },
    });
    expect(again.status).toBe(201);
    expect((again.json as { id: string }).id).toBe(
      (hired.json as { id: string }).id
    );

    const submitted = await call(handle, "POST", "/v1/jobs", {
      token: tokens.employer,
      body: { employeeId, prompt: "Audit churn" },
    });
    expect(submitted.status).toBe(202);
    const job = submitted.json as { id: string; missionId: string };

    const status = await call(handle, "GET", `/v1/jobs/${job.id}`, {
      token: tokens.employer,
    });
    expect(status.status).toBe(200);

    const mission = await call(handle, "GET", `/v1/missions/${job.missionId}`, {
      token: tokens.employer,
    });
    expect(mission.status).toBe(200);
  });

  it("accepts valid acceptance criteria, rejects malformed ones", async () => {
    const { handle, tokens } = await makeWorld();
    await call(handle, "POST", "/v1/employees", {
      token: tokens.admin,
      body: { name: "Aria", role: "Dev" },
    });
    const catalog = (await call(handle, "GET", "/v1/employees", {
      token: tokens.employer,
    })).json as { id: string }[];
    const employeeId = catalog[0].id;
    await call(handle, "POST", "/v1/hires", {
      token: tokens.employer,
      body: { employeeId },
    });

    const ok = await call(handle, "POST", "/v1/jobs", {
      token: tokens.employer,
      body: {
        employeeId,
        prompt: "Write hello",
        acceptance: { files: [{ path: "hello.txt", contains: "hi" }] },
      },
    });
    expect(ok.status).toBe(202);
    const job = ok.json as { missionId: string };
    const mission = (await call(handle, "GET", `/v1/missions/${job.missionId}`, {
      token: tokens.employer,
    })).json as { acceptance: unknown };
    expect(mission.acceptance).toEqual({
      files: [{ path: "hello.txt", contains: "hi" }],
    });

    for (const acceptance of [
      { files: [{ path: "../escape.txt" }] },
      { files: [{ path: "" }] },
      { files: "nope" },
    ]) {
      const bad = await call(handle, "POST", "/v1/jobs", {
        token: tokens.employer,
        body: { employeeId, prompt: "Write hello", acceptance },
      });
      expect(bad.status).toBe(400);
    }
  });

  it("isolates tenants on every scoped route", async () => {
    const { handle, tokens } = await makeWorld();
    await call(handle, "POST", "/v1/employees", {
      token: tokens.admin,
      body: { name: "Aria", role: "Dev" },
    });
    const catalog = (await call(handle, "GET", "/v1/employees", {
      token: tokens.employer,
    })).json as { id: string }[];
    const employeeId = catalog[0].id;
    await call(handle, "POST", "/v1/hires", {
      token: tokens.employer,
      body: { employeeId },
    });
    const submitted = await call(handle, "POST", "/v1/jobs", {
      token: tokens.employer,
      body: { employeeId, prompt: "Secret" },
    });
    const job = submitted.json as { id: string; missionId: string };

    // Le rival voit 404 partout, comme si rien n'existait.
    expect(
      (await call(handle, "GET", `/v1/jobs/${job.id}`, { token: tokens.rival }))
        .status
    ).toBe(404);
    expect(
      (
        await call(handle, "POST", `/v1/jobs/${job.id}/cancel`, {
          token: tokens.rival,
        })
      ).status
    ).toBe(404);
    expect(
      (
        await call(handle, "GET", `/v1/jobs/${job.id}/events`, {
          token: tokens.rival,
        })
      ).status
    ).toBe(404);
    expect(
      (
        await call(handle, "GET", `/v1/missions/${job.missionId}`, {
          token: tokens.rival,
        })
      ).status
    ).toBe(404);
    expect(
      (await call(handle, "GET", "/v1/jobs", { token: tokens.rival })).json
    ).toEqual([]);
  });

  it("streams job events until termination", async () => {
    const { handle, tokens } = await makeWorld();
    await call(handle, "POST", "/v1/employees", {
      token: tokens.admin,
      body: { name: "Aria", role: "Dev" },
    });
    const catalog = (await call(handle, "GET", "/v1/employees", {
      token: tokens.employer,
    })).json as { id: string }[];
    await call(handle, "POST", "/v1/hires", {
      token: tokens.employer,
      body: { employeeId: catalog[0].id },
    });
    const submitted = await call(handle, "POST", "/v1/jobs", {
      token: tokens.employer,
      body: { employeeId: catalog[0].id, prompt: "Work" },
    });
    const job = submitted.json as { id: string };

    const opened = await call(handle, "GET", `/v1/jobs/${job.id}/events`, {
      token: tokens.employer,
    });
    expect(opened.status).toBe(200);
    if (!opened.stream) {
      throw new Error("expected an event stream");
    }

    const draining = drain(opened.stream);
    // Laisse le flux emettre "queued", puis annule.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await call(handle, "POST", `/v1/jobs/${job.id}/cancel`, {
      token: tokens.employer,
    });

    expect(statusesOf(await draining)).toEqual(["queued", "cancelled"]);
  });

  it("validates bodies, queries and routes", async () => {
    const { handle, tokens } = await makeWorld();

    expect(
      (
        await call(handle, "POST", "/v1/jobs", {
          token: tokens.employer,
          rawBody: "{oops",
        })
      ).status
    ).toBe(400);
    expect(
      (
        await call(handle, "POST", "/v1/jobs", {
          token: tokens.employer,
          body: { employeeId: "emp_1" },
        })
      ).status
    ).toBe(400);
    expect(
      (await call(handle, "GET", "/v1/jobs?status=nope", {
        token: tokens.employer,
      })).status
    ).toBe(400);
    expect(
      (await call(handle, "GET", "/v1/jobs?status=queued,failed", {
        token: tokens.employer,
      })).status
    ).toBe(200);
    expect(
      (await call(handle, "GET", "/v1/nope", { token: tokens.employer })).status
    ).toBe(404);
    expect(
      (
        await call(handle, "POST", "/v1/hires", {
          token: tokens.employer,
          body: { employeeId: "emp_missing" },
        })
      ).status
    ).toBe(404);
  });
});
