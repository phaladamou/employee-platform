// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decideRoute } from "@/lib/auth/route-policy";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Presence d'un cookie de session (lecture seule des en-tetes recus ;
  // aucun cache cote serveur : si le navigateur a supprime le cookie,
  // la requete ne le contient pas et isAuthenticated vaut false).
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token");

  const decision = decideRoute(pathname, search, Boolean(sessionCookie));

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }

  if (decision.action === "unauthorized") {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
