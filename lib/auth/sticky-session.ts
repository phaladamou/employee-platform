// lib/auth/sticky-session.ts
// Session "sticky" PURE (aucune dependance React/Next) pour l'affichage
// sidebar : quand le serveur est injoignable, next-auth bascule a
// "unauthenticated" exactement comme apres un vrai logout — la sidebar
// ne doit pas suivre cette bascule (icone compte + historique gardent
// le dernier etat connu). Seuls le serveur (session vide confirmee)
// ou un logout explicite font basculer vers "non connecte".
// Comportement verrouille par sticky-session.test.ts :
// `node --test lib/auth/sticky-session.test.ts`.
// Le hook React (sonde reseau, effets) vit dans
// components/workspace/use-sticky-session.ts.

export type LiveSessionStatus = "authenticated" | "unauthenticated" | "loading";

// Sous-ensemble minimal affiche par la sidebar (avatar, nom, cles SWR).
// `type` est requis pour rester assignable a next-auth User (augmente
// dans app/(auth)/auth.ts) ; l'app ne connait que "regular".
export interface StickyUser {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  type: "regular";
}

export interface StickyInput {
  liveStatus: LiveSessionStatus;
  liveUser?: StickyUser | null;
  storedUser: StickyUser | null;
  logoutConfirmed: boolean;
}

export interface StickyOutput {
  user: StickyUser | undefined;
  status: LiveSessionStatus;
  /** Reference a memoriser (persistant) suite a cette decision. */
  persistUser: StickyUser | null;
}

export function resolveStickySession(input: StickyInput): StickyOutput {
  const { liveStatus, liveUser, storedUser, logoutConfirmed } = input;

  // Session live authentifiee : gagne toujours (y compris changement
  // de compte) et devient la reference memorisee.
  if (liveStatus === "authenticated") {
    if (liveUser) {
      return { user: liveUser, status: "authenticated", persistUser: liveUser };
    }
    if (storedUser && !logoutConfirmed) {
      return {
        user: storedUser,
        status: "authenticated",
        persistUser: storedUser,
      };
    }
    return { user: undefined, status: "loading", persistUser: null };
  }

  // Bascule suspecte vers "non authentifie" (ou chargement) : on garde
  // l'affichage connecte tant que le logout n'est pas confirme.
  if (!logoutConfirmed && storedUser) {
    return {
      user: storedUser,
      status: liveStatus === "loading" ? "loading" : "authenticated",
      persistUser: storedUser,
    };
  }

  // Vrai logout (confirme) ou jamais connecte.
  return {
    user: liveUser ?? undefined,
    status: liveStatus,
    persistUser: null,
  };
}

export type SessionProbeOutcome = "logout-confirmed" | "inconclusive";

// Tranche la reponse de la sonde /api/auth/session. Seul un 200 avec
// session vide prouve le logout (c'est ce que renvoie Auth.js sans
// session). Tout le reste — 502/503 du proxy quand le serveur est
// coupe, 500, page HTML non-JSON, session encore presente (provider
// en retard) — est une panne ou un faux positif : on reste sticky.
export function classifySessionProbe(input: {
  ok: boolean;
  body: unknown;
  parseFailed: boolean;
}): SessionProbeOutcome {
  if (!input.ok || input.parseFailed) {
    return "inconclusive";
  }
  const body = input.body as { user?: unknown } | null | undefined;
  if (body && typeof body === "object" && body.user) {
    return "inconclusive";
  }
  return "logout-confirmed";
}

const STORAGE_KEY = "employee:last-known-user";

// Memoire module : survit aux remontages React dans le meme contexte JS,
// meme si localStorage est bloque. Le rechargement complet repart du
// stockage persistant.
let memoryUser: StickyUser | null = null;

export function readMemoryUser(): StickyUser | null {
  return memoryUser;
}

export function writeMemoryUser(user: StickyUser | null): void {
  memoryUser = user ? pickStoredFields(user) : null;
}

function pickStoredFields(user: Partial<StickyUser>): StickyUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    type: "regular",
  };
}

function storage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredUser(): StickyUser | null {
  const store = storage();
  if (!store) {
    return null;
  }
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StickyUser>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return pickStoredFields(parsed);
  } catch {
    return null;
  }
}

export function writeStoredUser(user: StickyUser | null): void {
  const store = storage();
  if (!store) {
    return;
  }
  try {
    if (!user) {
      store.removeItem(STORAGE_KEY);
      return;
    }
    store.setItem(STORAGE_KEY, JSON.stringify(pickStoredFields(user)));
  } catch {
    // Stockage indisponible : la session sticky reste en memoire.
  }
}

export function clearStickyUser(): void {
  memoryUser = null;
  writeStoredUser(null);
}
