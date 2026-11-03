// app/(chat)/api/employees/[id]/chat/route.ts
// Discussion Engineering : reponse LLM reelle + missions executees
// pour de vrai via le noyau (in-process, dev-first).
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  createMission,
  getEmployeeById,
  requireAccountId,
  updateMission,
} from "@/lib/db/queries";
import { isMissionStatus } from "@/lib/employees/catalog";
import { streamEmployeeReply } from "@/lib/server/employee-chat-stream";
import {
  chatWithEmployee,
  runWebMission,
} from "@/lib/server/run-web-mission";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing employee" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const asMission = body.asMission === true;
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const target = await getEmployeeById(accountId, id);
    if (!target || target.status === "terminated") {
      return NextResponse.json({ error: "Unknown employee" }, { status: 404 });
    }

    if (!asMission) {
      const url = new URL(request.url);
      if (url.searchParams.get("stream") === "1") {
        try {
          return await streamEmployeeReply({
            name: target.name,
            role: target.role,
            message,
          });
        } catch (error) {
          console.error("POST /api/employees/[id]/chat Stream Error:", error);
          return NextResponse.json(
            { error: "Chat unavailable" },
            { status: 500 }
          );
        }
      }
      try {
        const reply = await chatWithEmployee({
          employeeName: target.name,
          employeeRole: target.role,
          message,
        });
        return NextResponse.json({ reply });
      } catch (error) {
        console.error("POST /api/employees/[id]/chat LLM Error:", error);
        return NextResponse.json({ error: "Chat unavailable" }, { status: 500 });
      }
    }

    const [created] = await createMission({
      accountId,
      employeeId: id,
      title: message.slice(0, 80),
      prompt: message,
    });
    if (!created) {
      throw new Error("insert returned no row");
    }
    await updateMission({
      accountId,
      missionId: created.id,
      patch: { status: "running" },
    });

    try {
      const outcome = await runWebMission({
        employeeId: id,
        employeeName: target.name,
        employeeRole: target.role,
        talentSpec: target.talentSpec,
        specVersion: target.specVersion,
        prompt: message,
      });
      const updated = await updateMission({
        accountId,
        missionId: created.id,
        patch: { status: outcome.status, report: outcome.summary || null },
      });
      const row = updated ?? created;
      return NextResponse.json(
        {
          mission: {
            id: row.id,
            title: row.title,
            status: isMissionStatus(row.status) ? row.status : "queued",
            employeeId: row.employeeId,
          },
          summary: outcome.summary,
          needsAcceptance: outcome.needsAcceptance,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error("POST /api/employees/[id]/chat Run Error:", error);
      const detail = String(
        error instanceof Error ? error.message : error
      ).slice(0, 500);
      const failed = await updateMission({
        accountId,
        missionId: created.id,
        patch: { status: "failed", report: detail },
      });
      const row = failed ?? created;
      return NextResponse.json(
        {
          mission: {
            id: row.id,
            title: row.title,
            status: "failed",
            employeeId: row.employeeId,
          },
          summary: detail,
          needsAcceptance: false,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("POST /api/employees/[id]/chat Error:", error);
    return NextResponse.json(
      { error: "Failed to chat with employee" },
      { status: 500 }
    );
  }
}
