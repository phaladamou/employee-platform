// Assembleur unique de l'historique de session (Phase 0 : esprit
// unique). Les chemins conversationnel ET mission partagent les memes
// bornes et la meme semantique : le passe vu est identique des deux
// cotes, seul le prompt courant est passe separement.

/** Tours conserves : les plus recents (au-dela : oublies). */
export const SESSION_HISTORY_MAX_TURNS = 8;
/** Caracteres conserves par tour (au-dela : tronques). */
export const SESSION_HISTORY_MAX_CHARS = 2000;

export interface SessionHistoryRow {
  readonly role: string;
  readonly text: string;
}

export interface SessionHistoryTurn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

/**
 * Construit les tours d'historique a partir des lignes de session
 * (ordre chronologique). `excludeLast` retire la derniere ligne :
 * le message courant, deja sauvegarde, est passe comme prompt.
 * Pur, borne, sans acces base : la route mappe les lignes DB en
 * { role, text } avant d'appeler.
 */
export function buildSessionHistory(
  rows: ReadonlyArray<SessionHistoryRow>,
  options?: { readonly excludeLast?: boolean }
): SessionHistoryTurn[] {
  const usable =
    options?.excludeLast === true ? rows.slice(0, -1) : rows;
  const recent = usable.slice(-SESSION_HISTORY_MAX_TURNS);
  const turns: SessionHistoryTurn[] = [];

  for (const row of recent) {
    const text = row.text.trim().slice(0, SESSION_HISTORY_MAX_CHARS);
    if (!text) {
      continue;
    }
    turns.push({
      role: row.role === "user" ? "user" : "assistant",
      text,
    });
  }

  return turns;
}
