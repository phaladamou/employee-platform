// lib/chat-draft.ts
// Cles de persistance du brouillon du champ chat, PURES (aucune
// dependance React/Next). Le brouillon est lie au compte : chaque
// utilisateur a sa propre cle, sinon le texte tape sous un compte
// reapparait sous un autre compte du meme navigateur.
// Comportement verrouille par chat-draft.test.ts :
// `node --test lib/chat-draft.test.ts`.

// Ancienne cle globale partagee par tous les comptes (ne plus lire,
// a nettoyer quand on la croise).
export const LEGACY_DRAFT_KEY = "input";

// Slot des champs affiches sans utilisateur connu (jamais un compte).
export const ANONYMOUS_DRAFT_KEY = "input:anonymous";

export function draftKeyForUser(userId: string | undefined): string {
  if (!userId) {
    return ANONYMOUS_DRAFT_KEY;
  }
  return `input:${userId}`;
}
