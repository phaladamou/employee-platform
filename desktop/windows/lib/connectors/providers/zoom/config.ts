export const zoomConfig = {
  authorizeUrl: "https://zoom.us/oauth/authorize",
  tokenUrl: "https://zoom.us/oauth/token",
  clientId: process.env.ZOOM_CLIENT_ID ?? "",
  clientSecret: process.env.ZOOM_CLIENT_SECRET ?? "",
  redirectUri: process.env.ZOOM_REDIRECT_URI ?? "",
  scopes: ["meeting:read:meeting", "user:read:user"],
  responseType: "code",
  tokenAuthStyle: "basic" as const,
  tokenBodyFormat: "form" as const,
} as const;
