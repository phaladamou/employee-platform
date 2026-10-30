import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Les tests parlent au loopback : court-circuite tout proxy HTTP du
// sandbox (fetch/undici honore no_proxy).
process.env.no_proxy = ["127.0.0.1", "localhost", process.env.no_proxy]
  .filter(Boolean)
  .join(",");
process.env.NO_PROXY = process.env.no_proxy;

import type { CredentialScope } from "../auth/employee-credential";
import { issueEmployerCredential } from "../auth/employer-credential";
import { FileEmployerCredentialStore } from "../auth/file-employer-credential-store";
import { FileEmploymentStore } from "../employments/file-employment-store";
import { FileJobStore } from "../jobs/file-job-store";
import { FileMissionStore } from "../missions/file-mission-store";
import { FileProfileStore } from "../profile/file-profile-store";
import { createProfileRegistry } from "../profiles/profile-registry";
import { HttpEmployeeClient } from "../sdk/http-client";
import { serveEmployeeApi } from "./node-adapter";

const SCOPES: CredentialScope[] = [
  "missions:submit",
  "missions:read",
  "memory:read",
  "employments:read",
  "employments:write",
];

describe("serveEmployeeApi", () => {
  let dir = "";
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (close) {
      await close();
      close = null;
    }
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = "";
    }
  });

  async function makeServer(): Promise<{ url: string; admin: string; employer: string }> {
    dir = await mkdtemp(join(tmpdir(), "emp-adapter-"));
    const credentials = new FileEmployerCredentialStore({
      directory: join(dir, "credentials"),
    });
    const server = await serveEmployeeApi(
      {
        profiles: new FileProfileStore({ directory: join(dir, "profiles") }),
        employments: new FileEmploymentStore({
          directory: join(dir, "employments"),
        }),
        missions: new FileMissionStore({ directory: join(dir, "missions") }),
        jobs: new FileJobStore({ directory: join(dir, "jobs") }),
        credentials,
        registry: createProfileRegistry([]),
        eventsPollMs: 10,
      },
      {}
    );
    close = server.close;

    const admin = issueEmployerCredential({
      employerId: "admin",
      label: "admin",
      scopes: [...SCOPES, "admin"],
    });
    const employer = issueEmployerCredential({
      employerId: "acme",
      label: "acme",
      scopes: SCOPES,
    });
    await credentials.save(admin.credential);
    await credentials.save(employer.credential);

    return { url: server.url, admin: admin.token, employer: employer.token };
  }

  it("serves the full client flow over real HTTP", async () => {
    const { url, admin, employer } = await makeServer();

    const created = await fetch(`${url}/v1/employees`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${admin}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Aria", role: "Dev" }),
    });
    expect(created.status).toBe(201);
    const employee = (await created.json()) as { id: string };

    // Le SDK HTTP parle au serveur sans adaptation.
    const client = new HttpEmployeeClient({ baseUrl: url, token: employer });
    await client.hire(employee.id);
    const job = await client.submit(employee.id, "Audit churn");

    expect(job.status).toBe("queued");
    expect((await client.status(job.id))?.id).toBe(job.id);
    expect((await client.listJobs()).length).toBe(1);

    const unauthenticated = await fetch(`${url}/v1/jobs`);
    expect(unauthenticated.status).toBe(401);
  });

  it("streams SSE until termination, then closes", async () => {
    const { url, admin, employer } = await makeServer();
    const adminHeaders = {
      authorization: `Bearer ${admin}`,
      "content-type": "application/json",
    };
    const employee = (await (
      await fetch(`${url}/v1/employees`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ name: "Aria", role: "Dev" }),
      })
    ).json()) as { id: string };

    const client = new HttpEmployeeClient({ baseUrl: url, token: employer });
    await client.hire(employee.id);
    const job = await client.submit(employee.id, "Work");

    const statuses: string[] = [];
    const consuming = (async () => {
      for await (const event of client.events(job.id)) {
        statuses.push(event.job.status);
        if (event.job.status === "queued") {
          await client.cancel(job.id);
        }
      }
    })();

    await consuming;
    expect(statuses).toEqual(["queued", "cancelled"]);
  });

  it("rejects oversized bodies with 413", async () => {
    const { url, employer } = await makeServer();

    const res = await fetch(`${url}/v1/jobs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${employer}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt: "x".repeat(2_000_000) }),
    });

    expect(res.status).toBe(413);
  });
});
