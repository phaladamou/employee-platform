export const slackConfig = {
  authorizeUrl: "https://slack.com/oauth/v2/authorize",
  tokenUrl: "https://slack.com/api/oauth.v2.access",
  clientId: process.env.SLACK_CLIENT_ID ?? "",
  clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
  redirectUri: process.env.SLACK_REDIRECT_URI ?? "",
  scopes: [
    "channels:read",
    "chat:write",
    "users:read",
    "users:read.email",
  ],
  tokenBodyFormat: "form" as const,
} as const;
