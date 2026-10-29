// lib/auth/route-policy.ts
// Regles de routage auth PURES (aucune dependance Next) partagees par le
// middleware. Comportement verrouille par route-policy.test.ts :
// `node --test desktop/windows/lib/auth/route-policy.test.ts`.

export const PUBLIC_PATHS = [
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

export const PUBLIC_PREFIXES = [
  "/api/auth",
  "/_next",
  "/images",
  "/fonts",
  "/favicon",
  "/opengraph-image",
  "/twitter-image",
];

// Routes auth (redirigees vers /workspace si deja connecte)
export const AUTH_ROUTES = ["/login", "/register"];

export function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.includes(pathname);
}

export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api");
}

export type RouteDecision =
  | { action: "next" }
  | { action: "redirect"; location: string }
  | { action: "unauthorized" };

export function decideRoute(
  pathname: string,
  search: string,
  isAuthenticated: boolean
): RouteDecision {
  // Route publique -> laisse passer, sauf route auth avec session active.
  if (isPublic(pathname)) {
    if (isAuthenticated && isAuthRoute(pathname)) {
      return { action: "redirect", location: "/workspace" };
    }
    return { action: "next" };
  }

  // Route protegee sans session.
  if (!isAuthenticated) {
    if (isApiRoute(pathname)) {
      return { action: "unauthorized" };
    }
    const callbackUrl = `${pathname}${search}`;
    return {
      action: "redirect",
      location: `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    };
  }

  return { action: "next" };
}
