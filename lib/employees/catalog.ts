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
  | "needs_review"
  | "cancelled";

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
  consumption?: ConsumptionProfile;
}

// Cout estime d'une mission (miroir UI de la colonne
// TalentProfile.consumptionProfile, defini ici pour garder ce module
// importable cote client).
export interface ConsumptionProfile {
  estimatedTokensPerMission: number;
  estimatedElapsedSecondsPerMission: number;
  minMemoryMb: number;
  minDiskMb: number;
  networkRequired: boolean;
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
  "cancelled",
];

export function isMissionStatus(value: unknown): value is MissionStatus {
  return MISSION_STATUSES.some((status) => status === value);
}

// Profils declares avec des outils github_* (onglet GitHub de
// l'espace employe). Miroir de la verite noyau (allowedTools des
// JSON de profils) : ajouter un profil ici quand il gagne les
// outils GitHub.
const GITHUB_CAPABLE_SPECS: readonly string[] = ["atlas-software-engineer"];

export function isGithubCapable(spec: unknown): boolean {
  return GITHUB_CAPABLE_SPECS.some((name) => name === spec);
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

// Garde-fou pour le JSON lu en base (colonne libre) : forme
// invalide -> absent, l'UI masque la section.
export function asConsumptionProfile(
  value: unknown
): ConsumptionProfile | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const profile = value as Record<string, unknown>;
  for (const key of [
    "estimatedTokensPerMission",
    "estimatedElapsedSecondsPerMission",
    "minMemoryMb",
    "minDiskMb",
  ]) {
    const candidate = profile[key];
    if (
      typeof candidate !== "number" ||
      !Number.isFinite(candidate) ||
      candidate < 0
    ) {
      return null;
    }
  }
  if (typeof profile.networkRequired !== "boolean") {
    return null;
  }
  return {
    estimatedTokensPerMission: profile.estimatedTokensPerMission as number,
    estimatedElapsedSecondsPerMission: profile.estimatedElapsedSecondsPerMission as number,
    minMemoryMb: profile.minMemoryMb as number,
    minDiskMb: profile.minDiskMb as number,
    networkRequired: profile.networkRequired,
  };
}

// Ligne TalentProfile minimale (structurelle : pas d'import du schema
// DB, ce module reste importable cote client).
export interface TalentProfileRow {
  spec: string;
  version: string;
  name: string;
  role: string;
  departmentId: string;
  background: string;
  allowedTools: unknown;
  technologies: unknown;
  tools: unknown;
  overview: string | null;
  responsibilities: unknown;
  capabilities: unknown;
  executionEnvironment: unknown;
  boundaries: unknown;
  deliverables: unknown;
  verification: string | null;
  consumptionProfile?: unknown;
  createdBy: string;
}

function optionalList(
  key: "responsibilities" | "capabilities" | "boundaries" | "deliverables",
  value: unknown
): Partial<TalentProfile> {
  const items = asOptionalStringList(value);
  return items ? { [key]: items } : {};
}

// Projection unique DB -> API (GET et PUT partagent le meme format).
export function formatTalentProfile(
  row: TalentProfileRow,
  hired: boolean
): TalentProfile {
  const toolDetails = asToolDetails(row.tools);
  const environment = asRichText(row.executionEnvironment);
  const consumption = asConsumptionProfile(row.consumptionProfile);
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
    hired,
    ...(row.overview ? { overview: row.overview } : {}),
    ...optionalList("responsibilities", row.responsibilities),
    ...optionalList("capabilities", row.capabilities),
    ...(toolDetails.length > 0 ? { toolDetails } : {}),
    ...(environment ? { executionEnvironment: environment } : {}),
    ...optionalList("boundaries", row.boundaries),
    ...optionalList("deliverables", row.deliverables),
    ...(row.verification ? { verification: row.verification } : {}),
    ...(consumption ? { consumption } : {}),
  };
}

// Fiche compacte renvoyee par l'outil searchEmployees du Chef :
// juste assez pour afficher une carte de recommandation dans le
// chat (la fiche complete vit sur /employees/recruit?talent=<spec>).
export interface EmployeeSearchResult {
  spec: string;
  name: string;
  role: string;
  departmentId: string;
  pitch: string;
  skills: string[];
  hired: boolean;
}

export const SEARCH_PITCH_MAX_LENGTH = 180;
export const SEARCH_SKILLS_MAX_COUNT = 4;

// Le background brut est un prompt systeme (long) : condense en une
// accroche d'une phrase, sans couper un mot.
export function truncatePitch(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, " ");
  if (collapsed.length <= SEARCH_PITCH_MAX_LENGTH) return collapsed;
  const cut = collapsed.slice(0, SEARCH_PITCH_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

// Projection TalentProfile -> carte de recommandation du Chef.
export function toEmployeeSearchResult(
  profile: TalentProfile
): EmployeeSearchResult {
  const pitchSource =
    profile.overview?.trim() || profile.background;
  const skillsSource =
    profile.capabilities?.length ? profile.capabilities : profile.technologies;
  return {
    spec: profile.spec,
    name: profile.name,
    role: profile.role,
    departmentId: profile.departmentId,
    pitch: truncatePitch(pitchSource),
    skills: skillsSource.slice(0, SEARCH_SKILLS_MAX_COUNT),
    hired: profile.hired === true,
  };
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
