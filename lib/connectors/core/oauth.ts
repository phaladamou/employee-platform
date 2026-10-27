// lib/connectors/core/oauth.ts
import "server-only";

import type { OAuthConfig } from "./types";

export function buildAuthorizeUrl(
  config: OAuthConfig,
  state: string
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  if (config.responseType) {
    url.searchParams.set("response_type", config.responseType);
  }

  if (config.scopes.length > 0) {
    url.searchParams.set("scope", config.scopes.join(" "));
  }

  if (config.extraAuthParams) {
    for (const [key, value] of Object.entries(config.extraAuthParams)) {
      url.searchParams.set(key, value);
    }
  }

  console.log(">>> AUTHORIZE URL:", url.toString());
  return url.toString();
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export async function exchangeCode(
  config: OAuthConfig,
  code: string
): Promise<TokenResponse> {
  const isForm = config.tokenBodyFormat === "form";

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": isForm
      ? "application/x-www-form-urlencoded"
      : "application/json; charset=utf-8",
    ...(config.extraTokenHeaders ?? {}),
  };

  const params: Record<string, string> = {
    code,
    redirect_uri: config.redirectUri,
  };

  if (config.tokenAuthStyle === "basic") {
    const basic = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");
    headers.Authorization = `Basic ${basic}`;
    params.grant_type = "authorization_code";
  } else {
    params.client_id = config.clientId;
    params.client_secret = config.clientSecret;
  }

  const body = isForm
    ? new URLSearchParams(params).toString()
    : JSON.stringify(params);

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("OAuth token exchange failed:", {
      status: res.status,
      body: text,
      redirectUri: config.redirectUri,
    });
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  let data: Partial<TokenResponse> & { access_token?: string };

  try {
    data = JSON.parse(text);
  } catch {
    const urlParams = new URLSearchParams(text);
    data = {
      access_token: urlParams.get("access_token") ?? undefined,
      refresh_token: urlParams.get("refresh_token") ?? undefined,
      expires_in: urlParams.get("expires_in")
        ? Number(urlParams.get("expires_in"))
        : undefined,
      scope: urlParams.get("scope") ?? undefined,
    };
  }

  if (!data.access_token) {
    console.error("OAuth token response missing access_token:", text);
    throw new Error("No access token in response");
  }

  return data as TokenResponse;
}
