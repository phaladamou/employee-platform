// lib/employees/talents.ts
// Pont LECTURE SEULE entre les specs du noyau
// (core/employee/profiles/*.json) et le catalogue web. Le noyau n'est
// jamais modifie ici : on lit ses 6 specs et on les projette vers la
// table TalentProfile (departement + vitrine techno = presentation web).
// Comportement verrouille par talents.test.ts :
// `node --test lib/employees/talents.test.ts`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface KernelEmployeeSpec {
  name: string;
  version: string;
  role: string;
  systemPrompt: string;
  allowedTools: string[];
}

// Les 6 talents du catalogue initial. Le rattachement (departement,
// technologies affichees) est une decision de presentation web, pas
// une donnee du noyau (qui reste aveugle au metier).
export const TALENT_CATALOG: Record<
  string,
  { departmentId: string; technologies: string[] }
> = {
  "atlas-software-engineer": {
    departmentId: "engineering",
    technologies: ["Python", "pytest", "Git"],
  },
  "nova-devops-engineer": {
    departmentId: "engineering",
    technologies: ["Docker", "CI/CD", "Shell"],
  },
  "aria-data-analyst": {
    departmentId: "research-data",
    technologies: ["SQL", "Data analysis", "Reporting"],
  },
  "newton-researcher": {
    departmentId: "research-data",
    technologies: ["Research", "Synthesis", "Briefing"],
  },
  "milo-content-strategist": {
    departmentId: "operations",
    technologies: ["Content strategy", "Documentation", "Technical writing"],
  },
  "sana-seo-analyst": {
    departmentId: "operations",
    technologies: ["SEO audit", "Keywords", "Search intent"],
  },
};

export function isCatalogSpec(specName: string): boolean {
  return specName in TALENT_CATALOG;
}

// "atlas-software-engineer" -> "Atlas".
export function displayNameForSpec(specName: string): string {
  const first = specName.split("-")[0] ?? "";
  if (!first) return specName;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// Parse strict : une spec invalide fait echouer la synchro (jamais de
// catalogue partiellement faux en base).
export function parseKernelSpec(value: unknown): KernelEmployeeSpec {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid kernel spec: not an object");
  }
  const spec = value as Record<string, unknown>;
  for (const key of ["name", "version", "role", "systemPrompt"]) {
    if (typeof spec[key] !== "string" || !(spec[key] as string).trim()) {
      throw new Error(`Invalid kernel spec: missing ${key}`);
    }
  }
  if (
    !Array.isArray(spec.allowedTools) ||
    spec.allowedTools.length === 0 ||
    !spec.allowedTools.every((t) => typeof t === "string" && t.trim())
  ) {
    throw new Error("Invalid kernel spec: allowedTools must be non-empty");
  }
  return {
    name: spec.name as string,
    version: spec.version as string,
    role: spec.role as string,
    systemPrompt: spec.systemPrompt as string,
    allowedTools: [...(spec.allowedTools as string[])],
  };
}

export interface RichTool {
  name: string;
  description: string;
}

// Fiche riche d'un talent : copie de presentation (Talent Network).
// `tools[].name` doit rester un sous-ensemble des allowedTools du
// noyau (contrat verifie par rich-profiles.test.ts).
export interface RichTalentProfile {
  overview: string;
  responsibilities: string[];
  capabilities: string[];
  tools: RichTool[];
  executionEnvironment: string | string[];
  boundaries: string[];
  deliverables: string[];
  verification: string;
}

export interface TalentSeed {
  spec: string;
  version: string;
  name: string;
  role: string;
  departmentId: string;
  background: string;
  allowedTools: string[];
  technologies: string[];
  createdBy: string;
  richProfile: RichTalentProfile | null;
}

export function toTalentSeed(spec: KernelEmployeeSpec): TalentSeed {
  const catalog = TALENT_CATALOG[spec.name];
  if (!catalog) {
    throw new Error(`Spec is not in the web catalog: ${spec.name}`);
  }
  return {
    spec: spec.name,
    version: spec.version,
    name: displayNameForSpec(spec.name),
    role: spec.role,
    departmentId: catalog.departmentId,
    background: spec.systemPrompt,
    allowedTools: [...spec.allowedTools],
    technologies: [...catalog.technologies],
    createdBy: "Cofoundator",
    // Enrichi par talent-sync depuis rich-profiles.ts (NULL = fiche
    // standard : background + technologies + allowedTools).
    richProfile: null,
  };
}

// Charge les specs du catalogue depuis le dossier des profils noyau.
// Ignore le reste (lockfile, specs generiques hors catalogue).
export function loadCatalogSpecs(profilesDir: string): KernelEmployeeSpec[] {
  const files = readdirSync(profilesDir)
    .filter((f) => f.endsWith(".json") && f !== "profiles.lock.json")
    .sort();
  const specs: KernelEmployeeSpec[] = [];
  for (const file of files) {
    const raw = readFileSync(join(profilesDir, file), "utf8");
    const parsed = parseKernelSpec(JSON.parse(raw) as unknown);
    if (isCatalogSpec(parsed.name)) {
      specs.push(parsed);
    }
  }
  return specs;
}
