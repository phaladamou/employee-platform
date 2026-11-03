// app/(chat)/api/cli/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getCommand, helpText, parseMissionsArgs } from "@/lib/cli/commands";
import { parseLine } from "@/lib/cli/parser";
import {
  getEmployeesByAccount,
  getHiredTalentSpecs,
  getMissionsByAccount,
  getRecentMissionsByAccount,
  getTalentProfiles,
  requireAccountId,
} from "@/lib/db/queries";
import { isMissionStatus } from "@/lib/employees/catalog";

const MAX_LINE_LENGTH = 4000;

function shortId(id: string): string {
  return id.slice(0, 8);
}

async function runStatus(accountId: string): Promise<string> {
  const [employees, missions] = await Promise.all([
    getEmployeesByAccount(accountId),
    getMissionsByAccount(accountId),
  ]);
  const byEmployeeStatus = new Map<string, number>();
  for (const employee of employees) {
    byEmployeeStatus.set(
      employee.status,
      (byEmployeeStatus.get(employee.status) ?? 0) + 1
    );
  }
  const byMissionStatus = new Map<string, number>();
  for (const mission of missions) {
    const status = isMissionStatus(mission.status) ? mission.status : "queued";
    byMissionStatus.set(status, (byMissionStatus.get(status) ?? 0) + 1);
  }
  const employeeParts = [...byEmployeeStatus.entries()].map(
    ([status, count]) => `${count} ${status}`
  );
  const missionParts = [...byMissionStatus.entries()].map(
    ([status, count]) => `${count} ${status}`
  );
  return [
    `Employees: ${employees.length}${employeeParts.length > 0 ? ` (${employeeParts.join(", ")})` : ""}`,
    `Missions: ${missions.length}${missionParts.length > 0 ? ` (${missionParts.join(", ")})` : ""}`,
  ].join("\n");
}

async function runEmployees(accountId: string): Promise<string> {
  const employees = await getEmployeesByAccount(accountId);
  if (employees.length === 0) {
    return "No employees yet. Hire one from the Talent Network (/employees/recruit) or with: hire <spec>";
  }
  return employees
    .map(
      (employee) =>
        `${shortId(employee.id)}  ${employee.status.padEnd(10)} ${employee.name} — ${employee.role}`
    )
    .join("\n");
}

async function runMissions(accountId: string, limit: number): Promise<string> {
  const missions = await getRecentMissionsByAccount(accountId, limit);
  if (missions.length === 0) {
    return "No missions yet.";
  }
  return missions
    .map((mission) => {
      const status = isMissionStatus(mission.status)
        ? mission.status
        : "queued";
      return `${shortId(mission.id)}  ${status.padEnd(12)} ${mission.title} (${mission.employeeName})`;
    })
    .join("\n");
}

async function runTalents(accountId: string): Promise<string> {
  const [talents, hired] = await Promise.all([
    getTalentProfiles(),
    getHiredTalentSpecs(accountId),
  ]);
  if (talents.length === 0) {
    return "Talent catalog is empty.";
  }
  return talents
    .map((talent) => {
      const mark = hired.includes(talent.spec) ? "[hired] " : "";
      return `${mark}${talent.spec} — ${talent.name} (${talent.role})`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let line = "";
  try {
    const body = (await request.json()) as { line?: unknown };
    if (typeof body.line !== "string") {
      return NextResponse.json(
        { output: "Error: missing command line.", exitCode: 1 },
        { status: 200 }
      );
    }
    line = body.line;
  } catch {
    return NextResponse.json(
      { output: "Error: invalid request.", exitCode: 1 },
      { status: 200 }
    );
  }

  if (line.length > MAX_LINE_LENGTH) {
    return NextResponse.json(
      { output: "Error: command line too long.", exitCode: 1 },
      { status: 200 }
    );
  }

  const parsed = parseLine(line);
  if (parsed.ok === false) {
    return NextResponse.json(
      { output: `Error: ${parsed.error}`, exitCode: 1 },
      { status: 200 }
    );
  }

  const spec = getCommand(parsed.command.name);
  if (!spec) {
    return NextResponse.json(
      {
        output: `Unknown command: ${parsed.command.name}\nType "help" to list commands.`,
        exitCode: 1,
      },
      { status: 200 }
    );
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const { args } = parsed.command;

    switch (spec.name) {
      case "help": {
        if (args.length > 1) {
          return NextResponse.json(
            { output: `Usage: ${spec.usage}`, exitCode: 1 },
            { status: 200 }
          );
        }
        return NextResponse.json(
          { output: helpText(args[0]), exitCode: 0 },
          { status: 200 }
        );
      }
      case "status": {
        if (args.length > 0) {
          return NextResponse.json(
            { output: `Usage: ${spec.usage}`, exitCode: 1 },
            { status: 200 }
          );
        }
        return NextResponse.json(
          { output: await runStatus(accountId), exitCode: 0 },
          { status: 200 }
        );
      }
      case "employees": {
        if (args.length > 0) {
          return NextResponse.json(
            { output: `Usage: ${spec.usage}`, exitCode: 1 },
            { status: 200 }
          );
        }
        return NextResponse.json(
          { output: await runEmployees(accountId), exitCode: 0 },
          { status: 200 }
        );
      }
      case "missions": {
        const validated = parseMissionsArgs(args);
        if (validated.ok === false) {
          return NextResponse.json(
            { output: `Error: ${validated.error}`, exitCode: 1 },
            { status: 200 }
          );
        }
        return NextResponse.json(
          {
            output: await runMissions(accountId, validated.limit),
            exitCode: 0,
          },
          { status: 200 }
        );
      }
      case "talents": {
        if (args.length > 0) {
          return NextResponse.json(
            { output: `Usage: ${spec.usage}`, exitCode: 1 },
            { status: 200 }
          );
        }
        return NextResponse.json(
          { output: await runTalents(accountId), exitCode: 0 },
          { status: 200 }
        );
      }
      default: {
        return NextResponse.json(
          { output: `Unknown command: ${spec.name}`, exitCode: 1 },
          { status: 200 }
        );
      }
    }
  } catch (error) {
    console.error("POST /api/cli DB Error:", error);
    return NextResponse.json(
      { output: "Error: command failed.", exitCode: 1 },
      { status: 200 }
    );
  }
}
