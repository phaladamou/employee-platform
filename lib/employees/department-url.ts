// lib/employees/department-url.ts
// Selection employe portee par l'URL : /departments/<id> pour la
// liste, ?employee=<employeeId> pour l'espace d'un employe.
// Fonctions pures (testables via node --test) ; le composant
// DepartmentView les branche sur le router Next.

export const EMPLOYEE_PARAM = "employee";

export function buildDepartmentUrl(
  departmentId: string,
  employeeId: string | null
): string {
  const base = `/departments/${encodeURIComponent(departmentId)}`;
  if (!employeeId) {
    return base;
  }
  return `${base}?${EMPLOYEE_PARAM}=${encodeURIComponent(employeeId)}`;
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
