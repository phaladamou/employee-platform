// app/(chat)/api/cli/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getCommand,
  helpText,
  parseCancelArgs,
  parseHireArgs,
  parseMissionsArgs,
  parseSubmitArgs,
} from "@/lib/cli/commands";
import {
  type ConfirmPayload,
  createConfirmToken,
  verifyConfirmToken,
} from "@/lib/cli/confirm";
import { parseLine } from "@/lib/cli/parser";
import {
  createMission,
  getEmployeesByAccount,
  getHiredTalentSpecs,
  getMissionById,
  getMissionsByAccount,
  getRecentMissionsByAccount,
  getTalentBySpec,
  getTalentProfiles,
  hireEmployee,
  requireAccountId,
  updateMission,
} from "@/lib/db/queries";
import type { Employee, Mission } from "@/lib/db/schema";
import { asStringList, isMissionStatus } from "@/lib/employees/catalog";

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

type ResolveResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// Resolution ownership-checkee : nom, spec ou prefixe d'id (8+)
// parmi les employes ACTIFS du compte uniquement.
async function resolveEmployeeRef(
  accountId: string,
  ref: string
): Promise<ResolveResult<Employee>> {
  const employees = await getEmployeesByAccount(accountId);
  const exact = employees.find((employee) => employee.id === ref);
  if (exact) {
    return { ok: true, value: exact };
  }
  const lowered = ref.toLowerCase();
  const matches = employees.filter(
    (employee) =>
      employee.name.toLowerCase() === lowered ||
      (employee.talentSpec !== null &&
        employee.talentSpec.toLowerCase() === lowered) ||
      (ref.length >= 8 && employee.id.startsWith(ref))
  );
  if (matches.length === 1) {
    return { ok: true, value: matches[0] };
  }
  if (matches.length > 1) {
    const options = matches
      .map((employee) => `${employee.id.slice(0, 8)} ${employee.name}`)
      .join(", ");
    return { ok: false, error: `Ambiguous employee "${ref}": ${options}` };
  }
  return {
    ok: false,
    error: `Unknown employee: ${ref}\nType "employees" to list yours.`,
  };
}

// Resolution ownership-checkee : uuid complet ou prefixe unique (8+)
// parmi les missions du compte uniquement.
async function resolveMissionRef(
  accountId: string,
  ref: string
): Promise<ResolveResult<Mission>> {
  if (/^[0-9a-f-]{36}$/i.test(ref)) {
    const mission = await getMissionById(accountId, ref);
    if (mission) {
      return { ok: true, value: mission };
    }
    return { ok: false, error: `Unknown mission: ${ref}` };
  }
  if (ref.length < 8) {
    return {
      ok: false,
      error: `Mission ref too short (min 8 chars): ${ref}`,
    };
  }
  const missions = await getMissionsByAccount(accountId);
  const matches = missions.filter((mission) => mission.id.startsWith(ref));
  if (matches.length === 1) {
    return { ok: true, value: matches[0] };
  }
  if (matches.length > 1) {
    const options = matches
      .map((mission) => mission.id.slice(0, 8))
      .join(", ");
    return { ok: false, error: `Ambiguous mission "${ref}": ${options}` };
  }
  return {
    ok: false,
    error: `Unknown mission: ${ref}\nType "missions" to list yours.`,
  };
}

function confirmPrompt(summary: string, token: string): string {
  return [
    summary,
    "",
    "Run to confirm (expires in 2 minutes):",
    `confirm ${token}`,
  ].join("\n");
}

interface CliResult {
  output: string;
  exitCode: number;
}

async function executeHire(
  accountId: string,
  params: Record<string, string | boolean>
): Promise<CliResult> {
  const spec = params["spec"];
  if (typeof spec !== "string" || !spec) {
    return { output: "Error: invalid confirmation.", exitCode: 1 };
  }
  const talent = await getTalentBySpec(spec);
  if (!talent) {
    return { output: `Unknown talent: ${spec}`, exitCode: 1 };
  }
  const hired = await getHiredTalentSpecs(accountId);
  if (hired.includes(talent.spec)) {
    return {
      output: `Already hired: ${talent.name} (${talent.spec})`,
      exitCode: 1,
    };
  }
  const [created] = await hireEmployee({
    accountId,
    talent: {
      spec: talent.spec,
      version: talent.version,
      name: talent.name,
      role: talent.role,
      departmentId: talent.departmentId,
      background: talent.background,
      allowedTools: asStringList(talent.allowedTools),
      technologies: asStringList(talent.technologies),
      createdBy: talent.createdBy,
      richProfile: null,
    },
  });
  if (!created) {
    return { output: "Error: hire failed.", exitCode: 1 };
  }
  return {
    output: `Hired ${created.name} (${talent.spec}).`,
    exitCode: 0,
  };
}

async function executeSubmit(
  accountId: string,
  params: Record<string, string | boolean>
): Promise<CliResult> {
  const employeeId = params["employeeId"];
  const title = params["title"];
  const prompt = params["prompt"];
  const expectFile = params["expectFile"];
  const expectTest = params["expectTest"];
  if (
    typeof employeeId !== "string" ||
    typeof title !== "string" ||
    typeof prompt !== "string" ||
    typeof expectFile !== "string" ||
    typeof expectTest !== "boolean" ||
    !employeeId ||
    !title ||
    !prompt
  ) {
    return { output: "Error: invalid confirmation.", exitCode: 1 };
  }
  const employee = await resolveEmployeeRef(accountId, employeeId);
  if (employee.ok === false) {
    return { output: `Error: ${employee.error}`, exitCode: 1 };
  }
  // Garde anti-rejeu : meme mission soumise il y a moins de 2 minutes.
  const recent = await getMissionsByAccount(accountId);
  const duplicate = recent.find(
    (mission) =>
      mission.employeeId === employeeId &&
      mission.title === title &&
      mission.prompt === prompt &&
      Date.now() - mission.createdAt.getTime() < 120_000
  );
  if (duplicate) {
    return {
      output: `Duplicate mission (already submitted as ${shortId(duplicate.id)}).`,
      exitCode: 1,
    };
  }
  const [created] = await createMission({
    accountId,
    employeeId,
    title,
    prompt,
    expectFile: expectFile.length > 0 ? expectFile : undefined,
    expectTest,
  });
  if (!created) {
    return { output: "Error: submit failed.", exitCode: 1 };
  }
  return {
    output: `Mission queued: ${shortId(created.id)} "${title}" for ${employee.value.name}.\nA worker will pick it up.`,
    exitCode: 0,
  };
}

async function executeCancel(
  accountId: string,
  params: Record<string, string | boolean>
): Promise<CliResult> {
  const missionId = params["missionId"];
  if (typeof missionId !== "string" || !missionId) {
    return { output: "Error: invalid confirmation.", exitCode: 1 };
  }
  const mission = await getMissionById(accountId, missionId);
  if (!mission) {
    return { output: "Error: mission not found.", exitCode: 1 };
  }
  const status = isMissionStatus(mission.status) ? mission.status : "queued";
  if (status !== "queued" && status !== "running") {
    return {
      output: `Mission ${shortId(mission.id)} is already ${status}.`,
      exitCode: 1,
    };
  }
  const updated = await updateMission({
    accountId,
    missionId,
    patch: { status: "cancelled" },
  });
  if (!updated) {
    return { output: "Error: cancel failed.", exitCode: 1 };
  }
  return {
    output: `Cancelled mission ${shortId(mission.id)} "${mission.title}".`,
    exitCode: 0,
  };
}

async function executeConfirmed(
  accountId: string,
  payload: ConfirmPayload
): Promise<CliResult> {
  switch (payload.action) {
    case "hire":
      return executeHire(accountId, payload.params);
    case "submit":
      return executeSubmit(accountId, payload.params);
    case "cancel":
      return executeCancel(accountId, payload.params);
  }
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
    const { args, flags } = parsed.command;
    const secret = process.env.AUTH_SECRET ?? "";

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
      case "hire": {
        const validated = parseHireArgs(args, flags);
        if (validated.ok === false) {
          return NextResponse.json(
            { output: `Error: ${validated.error}`, exitCode: 1 },
            { status: 200 }
          );
        }
        if (!secret) {
          return NextResponse.json(
            { output: "Error: server misconfigured.", exitCode: 1 },
            { status: 200 }
          );
        }
        const talent = await getTalentBySpec(validated.spec);
        if (!talent) {
          return NextResponse.json(
            {
              output: `Unknown talent: ${validated.spec}\nType "talents" to list the catalog.`,
              exitCode: 1,
            },
            { status: 200 }
          );
        }
        const hired = await getHiredTalentSpecs(accountId);
        if (hired.includes(talent.spec)) {
          return NextResponse.json(
            {
              output: `Already hired: ${talent.name} (${talent.spec})`,
              exitCode: 1,
            },
            { status: 200 }
          );
        }
        const token = createConfirmToken(secret, accountId, {
          action: "hire",
          params: { spec: talent.spec },
        });
        return NextResponse.json(
          {
            output: confirmPrompt(
              `Hire ${talent.name} (${talent.role})?\nSpec: ${talent.spec}`,
              token
            ),
            exitCode: 0,
          },
          { status: 200 }
        );
      }
      case "submit": {
        const validated = parseSubmitArgs(args, flags);
        if (validated.ok === false) {
          return NextResponse.json(
            { output: `Error: ${validated.error}`, exitCode: 1 },
            { status: 200 }
          );
        }
        if (!secret) {
          return NextResponse.json(
            { output: "Error: server misconfigured.", exitCode: 1 },
            { status: 200 }
          );
        }
        const resolved = await resolveEmployeeRef(
          accountId,
          validated.args.employeeRef
        );
        if (resolved.ok === false) {
          return NextResponse.json(
            { output: `Error: ${resolved.error}`, exitCode: 1 },
            { status: 200 }
          );
        }
        const token = createConfirmToken(secret, accountId, {
          action: "submit",
          params: {
            employeeId: resolved.value.id,
            title: validated.args.title,
            prompt: validated.args.prompt,
            expectFile: validated.args.expectFile ?? "",
            expectTest: validated.args.expectTest,
          },
        });
        const promptPreview =
          validated.args.prompt.length > 160
            ? `${validated.args.prompt.slice(0, 160)}…`
            : validated.args.prompt;
        const summaryLines = [
          `Submit mission to ${resolved.value.name}?`,
          `Title: ${validated.args.title}`,
          `Prompt: ${promptPreview}`,
        ];
        if (validated.args.expectFile) {
          summaryLines.push(`Expect file: ${validated.args.expectFile}`);
        }
        if (validated.args.expectTest) {
          summaryLines.push("Expect test: yes");
        }
        return NextResponse.json(
          { output: confirmPrompt(summaryLines.join("\n"), token), exitCode: 0 },
          { status: 200 }
        );
      }
      case "cancel": {
        const validated = parseCancelArgs(args, flags);
        if (validated.ok === false) {
          return NextResponse.json(
            { output: `Error: ${validated.error}`, exitCode: 1 },
            { status: 200 }
          );
        }
        if (!secret) {
          return NextResponse.json(
            { output: "Error: server misconfigured.", exitCode: 1 },
            { status: 200 }
          );
        }
        const resolved = await resolveMissionRef(
          accountId,
          validated.missionRef
        );
        if (resolved.ok === false) {
          return NextResponse.json(
            { output: `Error: ${resolved.error}`, exitCode: 1 },
            { status: 200 }
          );
        }
        const status = isMissionStatus(resolved.value.status)
          ? resolved.value.status
          : "queued";
        if (status !== "queued" && status !== "running") {
          return NextResponse.json(
            {
              output: `Mission ${shortId(resolved.value.id)} is already ${status}.`,
              exitCode: 1,
            },
            { status: 200 }
          );
        }
        const token = createConfirmToken(secret, accountId, {
          action: "cancel",
          params: { missionId: resolved.value.id },
        });
        return NextResponse.json(
          {
            output: confirmPrompt(
              `Cancel mission "${resolved.value.title}" (${shortId(resolved.value.id)}, ${status})?`,
              token
            ),
            exitCode: 0,
          },
          { status: 200 }
        );
      }
      case "confirm": {
        if (args.length !== 1 || Object.keys(flags).length > 0) {
          return NextResponse.json(
            { output: `Usage: ${spec.usage}`, exitCode: 1 },
            { status: 200 }
          );
        }
        if (!secret) {
          return NextResponse.json(
            { output: "Error: server misconfigured.", exitCode: 1 },
            { status: 200 }
          );
        }
        const payload = verifyConfirmToken(secret, args[0], accountId);
        if (!payload) {
          return NextResponse.json(
            {
              output: "Invalid or expired confirmation. Run the command again.",
              exitCode: 1,
            },
            { status: 200 }
          );
        }
        return NextResponse.json(await executeConfirmed(accountId, payload), {
          status: 200,
        });
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
