// app/(chat)/api/talents/route.ts
//
// Talent Network : le catalogue recrutable (table TalentProfile,
// miroir des specs noyau), enrichi de l'etat de recrutement pour le
// compte courant. Le catalogue est global, l'etat est scope.
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getHiredTalentSpecs,
  getTalentProfiles,
  requireAccountId,
} from "@/lib/db/queries";
import {
  asOptionalStringList,
  asRichText,
  asStringList,
  asToolDetails,
  type TalentProfile,
} from "@/lib/employees/catalog";

function optionalList(
  key: "responsibilities" | "capabilities" | "boundaries" | "deliverables",
  value: unknown
): Partial<TalentProfile> {
  const items = asOptionalStringList(value);
  return items ? { [key]: items } : {};
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accountId = await requireAccountId(session.user.id);
    const [rows, hiredSpecs] = await Promise.all([
      getTalentProfiles(),
      getHiredTalentSpecs(accountId),
    ]);
    const hired = new Set(hiredSpecs);
    const talents: TalentProfile[] = rows.map((row) => {
      const toolDetails = asToolDetails(row.tools);
      const environment = asRichText(row.executionEnvironment);
      return {
        spec: row.spec,
        version: row.version,
        name: row.name,
        role: row.role,
        departmentId: row.departmentId,
        background: row.background,
        technologies: asStringList(row.technologies),
        tools:
          toolDetails.length > 0
            ? toolDetails.map((tool) => tool.name)
            : asStringList(row.allowedTools),
        createdBy: row.createdBy,
        hired: hired.has(row.spec),
        ...(row.overview ? { overview: row.overview } : {}),
        ...optionalList("responsibilities", row.responsibilities),
        ...optionalList("capabilities", row.capabilities),
        ...(toolDetails.length > 0 ? { toolDetails } : {}),
        ...(environment ? { executionEnvironment: environment } : {}),
        ...optionalList("boundaries", row.boundaries),
        ...optionalList("deliverables", row.deliverables),
        ...(row.verification ? { verification: row.verification } : {}),
      };
    });
    return NextResponse.json({ talents });
  } catch (error) {
    console.error("GET /api/talents DB Error:", error);
    return NextResponse.json(
      { error: "Failed to load talents" },
      { status: 500 }
    );
  }
}
