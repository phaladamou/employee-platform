import { describe, expect, it } from "vitest";

import {
  hirePath,
  jobCancelPath,
  jobEventsPath,
  jobPath,
  jobsPath,
  missionPath,
  parseServerSentEvents,
} from "./rest-contract";

describe("rest paths", () => {
  it("builds stable routes", () => {
    expect(hirePath()).toBe("/v1/hires");
    expect(jobsPath()).toBe("/v1/jobs");
    expect(jobPath("job_1")).toBe("/v1/jobs/job_1");
    expect(jobPath("a/b")).toBe("/v1/jobs/a%2Fb");
    expect(jobCancelPath("job_1")).toBe("/v1/jobs/job_1/cancel");
    expect(jobEventsPath("job_1")).toBe("/v1/jobs/job_1/events");
    expect(missionPath("mis_1")).toBe("/v1/missions/mis_1");
  });
});

describe("parseServerSentEvents", () => {
  it("extracts data payloads, ignoring noise", () => {
    const chunk = [
      ": heartbeat",
      "",
      'data: {"job": {"id": "job_1", "status": "running"}}',
      "event: status",
      'data: {"job": {"id": "job_1", "status": "succeeded"}}',
      "",
    ].join("\n");

    const events = parseServerSentEvents(chunk);

    expect(events).toHaveLength(2);
    expect(events[0]?.job.status).toBe("running");
    expect(events[1]?.job.status).toBe("succeeded");
  });

  it("skips truncated or foreign payloads", () => {
    const chunk = ['data: {"job": {"id":', "data: ", "data: 42"].join("\n");

    expect(parseServerSentEvents(chunk)).toEqual([]);
  });
});
