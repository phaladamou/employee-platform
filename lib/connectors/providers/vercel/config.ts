export const vercelConfig = {
  authorizeUrl: "https://vercel.com/oauth/authorize",
  tokenUrl: "https://api.vercel.com/v2/oauth/access_token",
  clientId: process.env.VERCEL_CLIENT_ID ?? "",
  clientSecret: process.env.VERCEL_CLIENT_SECRET ?? "",
  redirectUri: process.env.VERCEL_REDIRECT_URI ?? "",
  scopes: [] as string[],
} as const;
