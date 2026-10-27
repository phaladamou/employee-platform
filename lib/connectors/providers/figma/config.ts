export const figmaConfig = {
  authorizeUrl: "https://www.figma.com/oauth",
  tokenUrl: "https://api.figma.com/v1/oauth/token",
  clientId: process.env.FIGMA_CLIENT_ID ?? "",
  clientSecret: process.env.FIGMA_CLIENT_SECRET ?? "",
  redirectUri: process.env.FIGMA_REDIRECT_URI ?? "",
  scopes: ["current_user:read", "file_content:read"],
  extraAuthParams: {
    response_type: "code",
  },
  tokenAuthStyle: "basic" as const,
} as const;
