// lib/employees/session-message-cache.ts
// Memoire d'affichage des discussions (sans dependance React :
// importable cote client). Le premier envoi d'une vue neuve cree
// la session PUIS navigue vers sa route (remontage complet du
// chat) : sans ce cache, la discussion disparait (salutation +
// "chargement") puis reapparait apres le GET. Ici : la vue
// remontee affiche instantanement les messages connus, la base
// revalide en silence derriere (stale-while-revalidate).
// Borne : les 10 dernieres sessions vues (eviction des anciennes).

import type { SessionHistoryMessage } from "./session-history";

const MAX_CACHED_SESSIONS = 10;

const cache = new Map<string, SessionHistoryMessage[]>();

function cacheKey(employeeId: string, sessionId: string): string {
  return `${employeeId}:${sessionId}`;
}

/**
 * Memorise les messages visibles d'une session. Listes vides
 * ignorees (rien a afficher instantanement : la salutation par
 * defaut convient). Copie defensive : l'appelant garde sa liste.
 */
export function cacheSessionMessages(
  employeeId: string,
  sessionId: string,
  messages: ReadonlyArray<SessionHistoryMessage>
): void {
  if (messages.length === 0) {
    return;
  }
  cache.delete(cacheKey(employeeId, sessionId));
  cache.set(
    cacheKey(employeeId, sessionId),
    messages.map((message) => ({ ...message }))
  );
  while (cache.size > MAX_CACHED_SESSIONS) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) {
      break;
    }
    cache.delete(oldest);
  }
}

/**
 * Relit les messages memorises, ou null (rechargement classique
 * avec temoin). Copie defensive : muter le resultat ne touche
 * pas le cache.
 */
export function readSessionMessages(
  employeeId: string,
  sessionId: string
): SessionHistoryMessage[] | null {
  const cached = cache.get(cacheKey(employeeId, sessionId));
  if (!cached) {
    return null;
  }
  return cached.map((message) => ({ ...message }));
}
