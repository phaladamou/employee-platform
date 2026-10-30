import { describe, expect, it } from "vitest";

import { HttpEmployeeClient, HttpEmployeeError } from "./http-client";

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    body: null,
  } as Response;
}

function textResponse(text: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    body: null,
  } as Response;
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    text: async () => "",
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  } as unknown as Response;
}

function stubFetch(
  handler: (call: RecordedCall) => Response | Promise<Response>
): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (url: unknown, init?: unknown) => {
    const request = (init ?? {}) as {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };
    const call: RecordedCall = {
      url: String(url),
      method: request.method ?? "GET",
      headers: request.headers ?? {},
      body: request.body ? JSON.parse(request.body as string) : undefined,
    };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const JOB = {
  id: "job_1",
  missionId: "mis_1",
  employeeId: "emp_1",
  employerId: "acme",
  status: "queued",
  lockOwner: null,
  report: null,
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
};

describe("HttpEmployeeClient", () => {
  it("requires baseUrl and token", () => {
    expect(() => new HttpEmployeeClient({ baseUrl: "", token: "t" })).toThrow(
      "requires a baseUrl"
    );
    expect(
      () => new HttpEmployeeClient({ baseUrl: "http://x", token: "  " })
    ).toThrow("requires a token");
  });

  it("maps methods to routes with bearer auth", async () => {
    const { fetchImpl, calls } = stubFetch(() => jsonResponse({ ok: true }));
    const client = new HttpEmployeeClient({
      baseUrl: "http://api/",
      token: "emo_secret",
      fetchImpl,
    });

    await client.hire("emp_1");
    await client.listHires();
    await client.submit("emp_1", "Work");
    await client.status("job_1");
    await client.listJobs(["queued", "running"]);
    await client.cancel("job_1");
    await client.mission("mis_1");

    const simplified = calls.map((call) => [
      call.method,
      call.url.replace("http://api", ""),
    ]);
    expect(simplified).toEqual([
      ["POST", "/v1/hires"],
      ["GET", "/v1/hires"],
      ["POST", "/v1/jobs"],
      ["GET", "/v1/jobs/job_1"],
      ["GET", "/v1/jobs?status=queued,running"],
      ["POST", "/v1/jobs/job_1/cancel"],
      ["GET", "/v1/missions/mis_1"],
    ]);

    for (const call of calls) {
      expect(call.headers.authorization).toBe("Bearer emo_secret");
    }
    expect(calls[0]?.body).toEqual({ employeeId: "emp_1" });
    expect(calls[2]?.body).toEqual({ employeeId: "emp_1", prompt: "Work" });

    await client.submit("emp_1", "Write", {
      acceptance: { files: [{ path: "a.txt" }] },
    });
    expect(calls[7]?.body).toEqual({
      employeeId: "emp_1",
      prompt: "Write",
      acceptance: { files: [{ path: "a.txt" }] },
    });
  });

  it("returns null on 404", async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse({}, 404));
    const client = new HttpEmployeeClient({
      baseUrl: "http://api",
      token: "t",
      fetchImpl,
    });

    expect(await client.status("job_x")).toBeNull();
    expect(await client.cancel("job_x")).toBeNull();
    expect(await client.mission("mis_x")).toBeNull();
  });

  it("throws typed errors on API failures", async () => {
    const { fetchImpl } = stubFetch(() =>
      jsonResponse({ error: "not_hired", message: "Nope" }, 403)
    );
    const client = new HttpEmployeeClient({
      baseUrl: "http://api",
      token: "t",
      fetchImpl,
    });

    const failure = await client.submit("emp_1", "Work").catch((error) => error);
    expect(failure).toBeInstanceOf(HttpEmployeeError);
    expect((failure as HttpEmployeeError).status).toBe(403);
    expect((failure as HttpEmployeeError).code).toBe("not_hired");
    expect((failure as HttpEmployeeError).message).toBe("Nope");
  });

  it("rejects invalid JSON payloads", async () => {
    const { fetchImpl } = stubFetch(() => textResponse("{oops"));
    const client = new HttpEmployeeClient({
      baseUrl: "http://api",
      token: "t",
      fetchImpl,
    });

    await expect(client.status("job_1")).rejects.toThrow("Invalid JSON");
  });

  it("streams SSE events across split chunks", async () => {
    const line1 = 'data: {"job": {"id": "job_1", "status": "running"}}\n\n';
    const line2 = 'data: {"job": {"id": "job_1", "status": "succeeded"}}\n\n';
    // Coupe au milieu d'une ligne : le client doit re-assembler.
    const chunks = [
      line1.slice(0, 20),
      line1.slice(20) + line2.slice(0, 10),
      line2.slice(10),
    ];
    const { fetchImpl, calls } = stubFetch(() => sseResponse(chunks));
    const client = new HttpEmployeeClient({
      baseUrl: "http://api",
      token: "t",
      fetchImpl,
    });

    const statuses: string[] = [];
    for await (const event of client.events("job_1")) {
      statuses.push(event.job.status);
    }

    expect(statuses).toEqual(["running", "succeeded"]);
    expect(calls[0]?.headers.accept).toBe("text/event-stream");
  });

  it("stops the stream at the first terminal event", async () => {
    const chunks = [
      'data: {"job": {"id": "job_1", "status": "failed"}}\n\n',
      'data: {"job": {"id": "job_1", "status": "succeeded"}}\n\n',
    ];
    const { fetchImpl } = stubFetch(() => sseResponse(chunks));
    const client = new HttpEmployeeClient({
      baseUrl: "http://api",
      token: "t",
      fetchImpl,
    });

    const statuses: string[] = [];
    for await (const event of client.events("job_1")) {
      statuses.push(event.job.status);
    }

    expect(statuses).toEqual(["failed"]);
  });

  it("throws on missing event streams", async () => {
    const { fetchImpl } = stubFetch(() => jsonResponse({}, 404));
    const client = new HttpEmployeeClient({
      baseUrl: "http://api",
      token: "t",
      fetchImpl,
    });

    await expect(async () => {
      for await (const _event of client.events("job_x")) {
        void _event;
      }
    }).rejects.toThrow("Job job_x not found");
  });
});
