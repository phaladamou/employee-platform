// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes publiques (accessibles sans connexion)
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/dpa",
  "/sub-processors",
  "/help",
  "/docs",
  "/faq",
];

// Routes publiques par préfixe
const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/guest",
  "/_next",
  "/images",
  "/fonts",
  "/favicon",
  "/opengraph-image",
  "/twitter-image",
];

// Routes auth (redirigées vers /workspace si déjà connecté)
const AUTH_ROUTES = ["/login", "/register"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Vérifie la présence d'un cookie de session
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token");

  const isAuthenticated = Boolean(sessionCookie);

  // Route publique → laisse passer
  if (isPublic(pathname)) {
    // Si déjà connecté et sur une route auth → redirige vers /workspace
    if (isAuthenticated && isAuthRoute(pathname)) {
      return NextResponse.redirect(new URL("/workspace", request.url));
    }
    return NextResponse.next();
  }

  // Route protégée + pas de session
  if (!isAuthenticated) {
    // API → 401 JSON
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Page → redirige vers /login avec callbackUrl
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
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
