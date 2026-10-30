import type { Employment } from "../employments/employment";
import type { EmploymentStore } from "../employments/employment-store";
import {
  assignMission,
  createEmployeeMission,
} from "../missions/employee-mission";
import type { MissionStore } from "../missions/mission-store";
import {
  createEmployeeJob,
  isTerminalJobStatus,
  type EmployeeJob,
  type JobStatus,
} from "../jobs/employee-job";
import type { JobStore } from "../jobs/job-store";
import type { EmployeeMission } from "../missions/employee-mission";
import type { ProfileStore } from "../profile/profile-store";
import type { EmployeeClient } from "./employee-client";
import type { JobEvent } from "./rest-contract";

const POLL_INTERVAL_MS = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface InProcessClientDeps {
  readonly employerId: string;
  readonly profiles: ProfileStore;
  readonly employments: EmploymentStore;
  readonly missions: MissionStore;
  readonly jobs: JobStore;
}

/**
 * Client employeur in-process : meme contrat que le client HTTP, sans
 * reseau. Toutes les lectures passent par les acces scopes des stores.
 */
export class InProcessEmployeeClient implements EmployeeClient {
  private readonly employerId: string;
  private readonly profiles: ProfileStore;
  private readonly employments: EmploymentStore;
  private readonly missions: MissionStore;
  private readonly jobs: JobStore;

  constructor(deps: InProcessClientDeps) {
    if (!deps.employerId.trim()) {
      throw new Error("Employer id cannot be empty");
    }
    this.employerId = deps.employerId;
    this.profiles = deps.profiles;
    this.employments = deps.employments;
    this.missions = deps.missions;
    this.jobs = deps.jobs;
  }

  async hire(employeeId: string): Promise<Employment> {
    const profile = await this.profiles.load(employeeId);
    if (!profile) {
      throw new Error(`Employee ${employeeId} not found`);
    }
    return this.employments.hire({
      employeeId: profile.id,
      employerId: this.employerId,
    });
  }

  async listHires(): Promise<readonly Employment[]> {
    return this.employments.listByEmployer(this.employerId);
  }

  async submit(employeeId: string, prompt: string): Promise<EmployeeJob> {
    const profile = await this.profiles.load(employeeId);
    if (!profile) {
      throw new Error(`Employee ${employeeId} not found`);
    }

    const employment = await this.employments.findActive(
      profile.id,
      this.employerId
    );
    if (!employment) {
      throw new Error(
        `Employee ${employeeId} is not hired by this employer`
      );
    }

    const mission = assignMission(
      createEmployeeMission({ prompt, employerId: this.employerId }),
      profile.id
    );
    await this.missions.save(mission);

    const job = createEmployeeJob({
      missionId: mission.id,
      employeeId: profile.id,
      employerId: this.employerId,
    });
    await this.jobs.enqueue(job);
    return job;
  }

  async status(jobId: string): Promise<EmployeeJob | null> {
    return this.jobs.loadScoped(this.employerId, jobId);
  }

  async listJobs(
    statuses?: readonly JobStatus[]
  ): Promise<readonly EmployeeJob[]> {
    return this.jobs.listByEmployer(this.employerId, statuses);
  }

  async cancel(jobId: string): Promise<EmployeeJob | null> {
    const scoped = await this.jobs.loadScoped(this.employerId, jobId);
    if (!scoped) {
      return null;
    }
    return this.jobs.requestCancellation(jobId);
  }

  async mission(missionId: string): Promise<EmployeeMission | null> {
    return this.missions.loadScoped(this.employerId, missionId);
  }

  async *events(jobId: string): AsyncIterable<JobEvent> {
    const first = await this.jobs.loadScoped(this.employerId, jobId);
    if (!first) {
      throw new Error(`Job ${jobId} not found`);
    }

    let lastStatus = "";
    for (;;) {
      const current = await this.jobs.loadScoped(this.employerId, jobId);
      if (!current) {
        throw new Error(`Job ${jobId} not found`);
      }
      if (current.status !== lastStatus) {
        lastStatus = current.status;
        yield { job: current };
      }
      if (isTerminalJobStatus(current.status)) {
        return;
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }
}
