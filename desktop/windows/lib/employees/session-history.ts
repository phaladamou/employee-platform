// lib/employees/session-history.ts
// Mapping pur des lignes d'historique (GET chat employe) vers
// les bulles de discussion. Sans dependance React/Next, teste
// via node --test (voir session-history.test.ts).
export interface SessionHistoryRow {
  id: string;
  role: string;
  text: string;
  missionId: string | null;
}

export interface SessionHistoryMessage {
  id: string;
  role: "user" | "employee";
  text: string;
  missionId?: string;
}

// role inconnu -> "user" (jamais de bulle orpheline) ; texte
// vide -> libelle de repli (reponse de mission sans texte =
// demande de relecture, rendue cote client).
export function mapSessionHistory(
  rows: readonly SessionHistoryRow[],
  fallbacks: { emptyReply: string; needsAcceptance: string }
): SessionHistoryMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role === "employee" ? "employee" : "user",
    text:
      row.text ||
      (row.missionId ? fallbacks.needsAcceptance : fallbacks.emptyReply),
    ...(row.missionId ? { missionId: row.missionId } : {}),
  }));
}
