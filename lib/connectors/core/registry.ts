// lib/connectors/core/registry.ts
import type { Provider, ProviderSummary } from "./types";

import { github } from "../providers/github";
import { notion } from "../providers/notion";
import { gmail } from "../providers/gmail";
import { slack } from "../providers/slack";
import { drive } from "../providers/drive";
import { figma } from "../providers/figma";
import { vercel } from "../providers/vercel";
import { supabase } from "../providers/supabase";
import { sentry } from "../providers/sentry";
import { neon } from "../providers/neon";
import { todoist } from "../providers/todoist";
import { cal } from "../providers/cal";
import { evernote } from "../providers/evernote";
import { zoom } from "../providers/zoom";
import { intercom } from "../providers/intercom";
import { stripe } from "../providers/stripe";
import { crunchbase } from "../providers/crunchbase";
import { motherduck } from "../providers/motherduck";
import { amplitude } from "../providers/amplitude";
import { snowflake } from "../providers/snowflake";
import { canva } from "../providers/canva";
import { vimeo } from "../providers/vimeo";

export const providers: Record<string, Provider> = {
  github,
  notion,
  gmail,
  slack,
  drive,
  figma,
  vercel,
  supabase,
  sentry,
  neon,
  todoist,
  cal,
  evernote,
  zoom,
  intercom,
  stripe,
  crunchbase,
  motherduck,
  amplitude,
  snowflake,
  canva,
  vimeo,
};

export function getProvider(id: string): Provider | null {
  return providers[id] ?? null;
}

export function listProviders(): ProviderSummary[] {
  return Object.values(providers).map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    descriptionKey: p.descriptionKey,
    category: p.category,
    color: p.color,
    icon: p.icon,
    permissionsKeys: p.permissionsKeys,
    configured: p.configured,
  }));
}
