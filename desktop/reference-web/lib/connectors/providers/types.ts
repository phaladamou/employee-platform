// lib/connectors/providers/types.ts
export type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  extraTokenHeaders?: Record<string, string>;
  tokenAuthStyle?: "body" | "basic";
  responseType?: string;
};
