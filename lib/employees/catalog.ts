// lib/employees/catalog.ts
// Vision "Employee" : types + helpers purs (sans dependance Next/React).
// Source de verite runtime = tables Department, TalentProfile et
// Employee (migration 0006). Le catalogue recrutable vient de la base
// (miroir des specs noyau), plus aucune donnee fictive ici.
// Comportement verrouille par catalog.test.ts :
// `node --test lib/employees/catalog.test.ts`.

export type EmployeeStatus = "idle" | "working" | "completed";

export type EmployeeKind = "chef" | "hired";

export type MissionStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "needs_review";

export interface Department {
  id: string;
}

// Fiche employe telle qu'exposee par GET /api/employees (compte courant).
export interface Employee {
  id: string;
  name: string;
  role: string;
  status: EmployeeStatus;
  departmentId: string;
  currentTask?: string;
  kind?: EmployeeKind;
  background?: string;
  technologies?: string[];
  hiredAt?: string;
  talentSpec?: string;
  specVersion?: string;
  createdBy?: string;
}

// Profil recrutable tel qu'expose par GET /api/talents.
// Les champs riches sont absents tant que le talent n'est pas enrichi
// (l'UI retombe sur background / technologies / tools).
export interface ToolDetail {
  name: string;
  description: string;
}

export interface TalentProfile {
  spec: string;
  version: string;
  name: string;
  role: string;
  departmentId: string;
  background: string;
  technologies: string[];
  tools: string[];
  createdBy: string;
  hired?: boolean;
  overview?: string;
  responsibilities?: string[];
  capabilities?: string[];
  toolDetails?: ToolDetail[];
  executionEnvironment?: string | string[];
  boundaries?: string[];
  deliverables?: string[];
  verification?: string;
}

export const DEPARTMENTS: Department[] = [
  { id: "engineering" },
  { id: "research-data" },
  { id: "operations" },
];

export function getEmployeesByDepartment(
  employees: Employee[],
  departmentId: string
): Employee[] {
  return employees.filter((e) => e.departmentId === departmentId);
}

export function countByStatus(
  employees: Employee[]
): Record<EmployeeStatus, number> {
  const counts: Record<EmployeeStatus, number> = {
    idle: 0,
    working: 0,
    completed: 0,
  };
  for (const employee of employees) {
    counts[employee.status] += 1;
  }
  return counts;
}

export function isKnownDepartment(departmentId: string): boolean {
  return DEPARTMENTS.some((d) => d.id === departmentId);
}

const EMPLOYEE_STATUSES: EmployeeStatus[] = ["idle", "working", "completed"];

// Garde-fou pour les statuts lus en base (colonne varchar libre).
export function isEmployeeStatus(value: unknown): value is EmployeeStatus {
  return EMPLOYEE_STATUSES.some((status) => status === value);
}

const EMPLOYEE_KINDS: EmployeeKind[] = ["chef", "hired"];

export function isEmployeeKind(value: unknown): value is EmployeeKind {
  return EMPLOYEE_KINDS.some((kind) => kind === value);
}

const MISSION_STATUSES: MissionStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "needs_review",
];

export function isMissionStatus(value: unknown): value is MissionStatus {
  return MISSION_STATUSES.some((status) => status === value);
}

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function asToolDetails(value: unknown): ToolDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
    .filter(
      (item) =>
        typeof item.name === "string" &&
        typeof item.description === "string"
    )
    .map((item) => ({
      name: item.name as string,
      description: item.description as string,
    }));
}

// Texte riche : prose (string) ou liste (string[]), sinon absent.
export function asRichText(value: unknown): string | string[] | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const items = asStringList(value);
    return items.length > 0 ? items : null;
  }
  return null;
}

export function asOptionalStringList(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  const items = asStringList(value);
  return items.length > 0 ? items : undefined;
}

// Filtre du Talent Network : departement exact + recherche plein texte
// insensible a la casse (chaque mot doit matcher quelque part).
export function filterTalents(
  talents: TalentProfile[],
  query: string,
  departmentId: string | "all"
): TalentProfile[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return talents.filter((talent) => {
    if (departmentId !== "all" && talent.departmentId !== departmentId) {
      return false;
    }
    if (tokens.length === 0) {
      return true;
    }
    const haystack =
      `${talent.name} ${talent.role} ${talent.background} ${talent.technologies.join(" ")} ${talent.tools.join(" ")}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
