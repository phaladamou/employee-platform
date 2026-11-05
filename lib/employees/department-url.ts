// lib/employees/department-url.ts
// Adresses lisibles de l'espace employe :
// /departments/<dept>/<slug> et /departments/<dept>/<slug>/<session>.
// Fonctions pures (testables via node --test) ; le composant
// workspace les branche sur le router Next. L'ancien
// ?employee=<id> reste reconnu (compat, redirection).
export const EMPLOYEE_PARAM = "employee";

export function slugifyEmployeeName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "employee";
}

export function resolveEmployeeSlug<T extends { id: string; name: string }>(
  members: readonly T[],
  slug: string
): T | null {
  const cleaned = slug.trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  return (
    members.find(
      (member) =>
        // Identifiant brut accepté (anciens liens, robustesse).
        member.id === slug || slugifyEmployeeName(member.name) === cleaned
    ) ?? null
  );
}

export function buildEmployeeUrl(
  departmentId: string,
  slug: string,
  sessionId: string | null
): string {
  const base = `/departments/${encodeURIComponent(departmentId)}/${encodeURIComponent(slug)}`;
  if (!sessionId) {
    return base;
  }
  return `${base}/${encodeURIComponent(sessionId)}`;
}

export function parseEmployeeParam(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
