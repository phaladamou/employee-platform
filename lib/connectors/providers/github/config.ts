export const githubConfig = {
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  clientId: process.env.GITHUB_CLIENT_ID ?? "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  redirectUri: process.env.GITHUB_REDIRECT_URI ?? "",
  scopes: ["read:user", "user:email", "public_repo", "read:org"],
} as const;
