// components/workspace/use-sticky-session.ts
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import {
  classifySessionProbe,
  readMemoryUser,
  readStoredUser,
  resolveStickySession,
  writeMemoryUser,
  writeStoredUser,
  type LiveSessionStatus,
  type StickyUser,
} from "@/lib/auth/sticky-session";

const SESSION_PROBE_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth/session`;

// Session "sticky" pour l'affichage sidebar : garde le dernier etat
// connecte connu quand le serveur est injoignable (coupure reseau,
// serveur dev coupe), au lieu d'afficher "non connecte" et de vider
// l'historique. La decision est deleguee au resolveur pur teste
// (lib/auth/sticky-session.ts) ; ce hook ne fait que le cablage
// (stockage local + sonde de confirmation).
export function useStickySession(): {
  user: StickyUser | undefined;
  status: LiveSessionStatus;
} {
  const { data: live, status: liveStatus } = useSession();
  const liveUser = (live?.user ?? null) as StickyUser | null;
  const [storedUser, setStoredUser] = useState<StickyUser | null>(null);
  const [logoutConfirmed, setLogoutConfirmed] = useState(false);
  const probingRef = useRef(false);

  // Hydrate la reference memorisee (apres montage : pas de mismatch SSR).
  useEffect(() => {
    setStoredUser(readMemoryUser() ?? readStoredUser());
  }, []);

  // Session live authentifiee : memorise toujours (suit aussi les
  // changements de compte) et leve toute confirmation de logout.
  useEffect(() => {
    if (liveStatus === "authenticated" && liveUser) {
      setStoredUser(liveUser);
      writeMemoryUser(liveUser);
      writeStoredUser(liveUser);
      setLogoutConfirmed(false);
    }
  }, [liveStatus, liveUser]);

  // Bascule suspecte vers "non authentifie" : une seule sonde tranche
  // entre vrai logout (serveur joignable, session vide) et coupure
  // (sonde en echec -> on reste sticky, rien a faire).
  useEffect(() => {
    if (
      liveStatus !== "unauthenticated" ||
      !storedUser ||
      logoutConfirmed ||
      probingRef.current
    ) {
      return;
    }
    probingRef.current = true;
    fetch(SESSION_PROBE_URL, { cache: "no-store" })
      .then(async (response) => {
        let body: unknown;
        let parseFailed = false;
        try {
          body = await response.json();
        } catch {
          parseFailed = true;
        }
        return classifySessionProbe({
          ok: response.ok,
          body,
          parseFailed,
        });
      })
      .then((outcome) => {
        // Seul "logout-confirmed" (200 + session vide) fait basculer.
        // Tout le reste (panne, proxy, retard provider) reste sticky.
        if (outcome === "logout-confirmed") {
          setLogoutConfirmed(true);
          setStoredUser(null);
          writeMemoryUser(null);
          writeStoredUser(null);
        }
      })
      .catch(() => {
        // Reseau mort (connexion refusee, DNS...) : on reste sticky.
      })
      .finally(() => {
        probingRef.current = false;
      });
  }, [liveStatus, storedUser, logoutConfirmed]);

  const decision = resolveStickySession({
    liveStatus,
    liveUser,
    storedUser,
    logoutConfirmed,
  });
  return { user: decision.user, status: decision.status };
}
