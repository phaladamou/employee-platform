// components/workspace/use-draft-input.ts
"use client";

import { useCallback, useEffect, useState } from "react";

import { LEGACY_DRAFT_KEY, draftKeyForUser } from "@/lib/chat-draft";

// Brouillon du champ chat, scope par compte : relit le slot des que
// l'utilisateur change (connexion, changement de compte) et nettoie
// l'ancienne cle globale partagee. Meme signature que le useLocalStorage
// qu'il remplace : [valeur, setter].
export function useDraftInput(
  userId: string | undefined
): [string, (value: string) => void] {
  const key = draftKeyForUser(userId);
  // Lecture synchrone initiale (pas de flash vide au rechargement) ;
  // pas de mismatch SSR : le brouillon n'est jamais rendu directement,
  // il ne transite que par setInput dans un effet.
  const [draft, setDraftState] = useState(() => {
    try {
      if (typeof window === "undefined") {
        return "";
      }
      return window.localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      setDraftState(window.localStorage.getItem(key) ?? "");
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch {
      setDraftState("");
    }
  }, [key]);

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      try {
        if (value) {
          window.localStorage.setItem(key, value);
        } else {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Stockage indisponible : brouillon en memoire uniquement.
      }
    },
    [key]
  );

  return [draft, setDraft];
}
