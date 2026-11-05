// app/(chat)/api/employees/recruit/route.ts
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getHiredTalentSpecs,
  getTalentBySpec,
  hireEmployee,
  requireAccountId,
} from "@/lib/db/queries";
import {
  asStringList,
  isEmployeeKind,
  isEmployeeStatus,
  type Employee,
} from "@/lib/employees/catalog";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { talentSpec } = body;
  if (typeof talentSpec !== "string" || !talentSpec) {
    return NextResponse.json({ error: "Missing talent" }, { status: 400 });
  }

  let accountId = "";
  try {
    accountId = await requireAccountId(session.user.id);
    const talent = await getTalentBySpec(talentSpec);
    if (!talent) {
      return NextResponse.json({ error: "Unknown talent" }, { status: 404 });
    }
    const hired = await getHiredTalentSpecs(accountId);
    if (hired.includes(talent.spec)) {
      return NextResponse.json({ error: "Already hired" }, { status: 409 });
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
        // La fiche d'embauche ne copie pas le contenu riche.
        richProfile: null,
      },
    });
    if (!created) {
      throw new Error("insert returned no row");
    }
    const employee: Employee = {
      id: created.id,
      name: created.name,
      role: created.role,
      status: isEmployeeStatus(created.status) ? created.status : "idle",
      departmentId: created.departmentId,
      ...(isEmployeeKind(created.kind) ? { kind: created.kind } : {}),
      ...(created.background ? { background: created.background } : {}),
      technologies: asStringList(created.technologies),
      hiredAt: created.hiredAt.toISOString(),
      ...(created.talentSpec ? { talentSpec: created.talentSpec } : {}),
      ...(created.specVersion ? { specVersion: created.specVersion } : {}),
      ...(created.createdBy ? { createdBy: created.createdBy } : {}),
    };
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error("POST /api/employees/recruit DB Error:", error);
    // Double-clic / course : la contrainte unique a peut-etre fait le
    // travail -> relecture avant de conclure a l'echec.
    if (accountId) {
      try {
        const hired = await getHiredTalentSpecs(accountId);
        if (hired.includes(talentSpec)) {
          return NextResponse.json(
            { error: "Already hired" },
            { status: 409 }
          );
        }
      } catch {
        // Conclusion d'echec ci-dessous.
      }
    }
    return NextResponse.json(
      { error: "Failed to recruit employee" },
      { status: 500 }
    );
  }
}
