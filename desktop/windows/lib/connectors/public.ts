// lib/connectors/public.ts
// Point d'entrée client-safe.
// N'expose QUE les données publiques (nom, couleur, icône).
// Aucun accès à process.env, aucun secret.

import type { ProviderCategory } from "./core/types";

export type PublicProvider = {
  id: string;
  displayName: string;
  color: string;
  icon: string;
  category: ProviderCategory;
};

export const publicProviders: Record<string, PublicProvider> = {
  github: {
    id: "github",
    displayName: "GitHub",
    color: "#181717",
    icon: "github",
    category: "popular",
  },
  notion: {
    id: "notion",
    displayName: "Notion",
    color: "#000000",
    icon: "notion",
    category: "popular",
  },
  gmail: {
    id: "gmail",
    displayName: "Gmail",
    color: "#EA4335",
    icon: "gmail",
    category: "popular",
  },
  slack: {
    id: "slack",
    displayName: "Slack",
    color: "#4A154B",
    icon: "slack",
    category: "popular",
  },
  drive: {
    id: "drive",
    displayName: "Google Drive",
    color: "#4285F4",
    icon: "googledrive",
    category: "popular",
  },
  figma: {
    id: "figma",
    displayName: "Figma",
    color: "#F24E1E",
    icon: "figma",
    category: "popular",
  },
  vercel: {
    id: "vercel",
    displayName: "Vercel",
    color: "#000000",
    icon: "vercel",
    category: "developer",
  },
  supabase: {
    id: "supabase",
    displayName: "Supabase",
    color: "#3ECF8E",
    icon: "supabase",
    category: "developer",
  },
  sentry: {
    id: "sentry",
    displayName: "Sentry",
    color: "#362D59",
    icon: "sentry",
    category: "developer",
  },
  neon: {
    id: "neon",
    displayName: "Neon",
    color: "#00E599",
    icon: "neon",
    category: "developer",
  },
  todoist: {
    id: "todoist",
    displayName: "Todoist",
    color: "#E44332",
    icon: "todoist",
    category: "productivity",
  },
  cal: {
    id: "cal",
    displayName: "Cal.com",
    color: "#111827",
    icon: "caldotcom",
    category: "productivity",
  },
  evernote: {
    id: "evernote",
    displayName: "Evernote",
    color: "#00A82D",
    icon: "evernote",
    category: "productivity",
  },
  zoom: {
    id: "zoom",
    displayName: "Zoom",
    color: "#2D8CFF",
    icon: "zoom",
    category: "communication",
  },
  intercom: {
    id: "intercom",
    displayName: "Intercom",
    color: "#1F8DED",
    icon: "intercom",
    category: "communication",
  },
  stripe: {
    id: "stripe",
    displayName: "Stripe",
    color: "#635BFF",
    icon: "stripe",
    category: "finance",
  },
  crunchbase: {
    id: "crunchbase",
    displayName: "Crunchbase",
    color: "#146AFF",
    icon: "crunchbase",
    category: "finance",
  },
  motherduck: {
    id: "motherduck",
    displayName: "MotherDuck",
    color: "#FFD700",
    icon: "motherduck",
    category: "data",
  },
  amplitude: {
    id: "amplitude",
    displayName: "Amplitude",
    color: "#1E61F0",
    icon: "amplitude",
    category: "data",
  },
  snowflake: {
    id: "snowflake",
    displayName: "Snowflake",
    color: "#29B5E8",
    icon: "snowflake",
    category: "data",
  },
  canva: {
    id: "canva",
    displayName: "Canva",
    color: "#00C4CC",
    icon: "canva",
    category: "creative",
  },
  vimeo: {
    id: "vimeo",
    displayName: "Vimeo",
    color: "#1AB7EA",
    icon: "vimeo",
    category: "creative",
  },
};

export function getPublicProvider(id: string): PublicProvider | null {
  return publicProviders[id] ?? null;
}
