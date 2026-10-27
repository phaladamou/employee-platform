import type { ZodSchema } from "zod";

export type OAuthConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  extraTokenHeaders?: Record<string, string>;
  tokenAuthStyle?: "body" | "basic";
  tokenBodyFormat?: "json" | "form";
  responseType?: string;
};

export type ProviderAction = {
  name: string;
  description: string;
  parameters: ZodSchema;
  execute: (ctx: ActionContext, params: unknown) => Promise<unknown>;
};

export type ActionContext = {
  userId: string;
  token: string;
  provider: string;
};

export type ProviderCategory =
  | "popular"
  | "productivity"
  | "developer"
  | "communication"
  | "finance"
  | "data"
  | "creative";

export type Provider = {
  id: string;
  name: string;
  displayName: string;
  descriptionKey: string;
  category: ProviderCategory;
  color: string;
  icon: string;
  permissionsKeys: string[];
  configured: boolean;
  oauth: OAuthConfig;
  actions: ProviderAction[];
};

export type ProviderSummary = {
  id: string;
  name: string;
  displayName: string;
  descriptionKey: string;
  category: ProviderCategory;
  color: string;
  icon: string;
  permissionsKeys: string[];
  configured: boolean;
};
