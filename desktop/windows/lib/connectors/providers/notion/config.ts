export const notionConfig = {
  authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
  tokenUrl: "https://api.notion.com/v1/oauth/token",
  clientId: process.env.NOTION_CLIENT_ID ?? "",
  clientSecret: process.env.NOTION_CLIENT_SECRET ?? "",
  redirectUri: process.env.NOTION_REDIRECT_URI ?? "",
  scopes: [] as string[],
  extraAuthParams: {
    owner: "user",
    response_type: "code",
  },
  extraTokenHeaders: {
    "Notion-Version": "2022-06-28",
  },
  tokenAuthStyle: "basic" as const,
} as const;
