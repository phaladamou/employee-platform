// lib/employees/departments.ts
// Socle pur des departements affiches (ordre stable, testable sans React).

export const KNOWN_DEPARTMENTS: readonly string[] = [
  "engineering",
  "research-data",
  "operations",
];

// Les 3 departements connus d'abord (toujours affiches, meme vides),
// puis les eventuels nouveaux venus par ordre alphabetique.
export function visibleDepartments(ids: string[]): string[] {
  const extra = [...new Set(ids)]
    .filter((id) => !KNOWN_DEPARTMENTS.includes(id))
    .sort();
  return [...KNOWN_DEPARTMENTS, ...extra];
}
