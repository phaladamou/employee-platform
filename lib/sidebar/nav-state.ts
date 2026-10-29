// lib/sidebar/nav-state.ts
// Etat actif des entrees sidebar liees aux employes, en pur TypeScript
// (testable sans React ; la sidebar consomme ces helpers).
export function isEmployeesSection(pathname: string): boolean {
  return (
    pathname.startsWith("/employees") &&
    !pathname.startsWith("/employees/recruit")
  );
}

export function isRecruitSection(pathname: string): boolean {
  return pathname.startsWith("/employees/recruit");
}
