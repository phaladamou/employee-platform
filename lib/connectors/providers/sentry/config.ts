export const sentryConfig = {
  authorizeUrl: "https://sentry.io/oauth/authorize/",
  tokenUrl: "https://sentry.io/oauth/token/",
  clientId: process.env.SENTRY_CLIENT_ID ?? "",
  clientSecret: process.env.SENTRY_CLIENT_SECRET ?? "",
  redirectUri: process.env.SENTRY_REDIRECT_URI ?? "",
  scopes: ["project:read", "event:read", "org:read"],
  responseType: "code",
  tokenAuthStyle: "basic" as const,
  tokenBodyFormat: "form" as const,
} as const;
