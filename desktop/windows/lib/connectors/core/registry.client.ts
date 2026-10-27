// lib/connectors/core/registry.client.ts
// Registre minimal, exposable au client.
// Ne contient que les données publiques, pas les secrets, pas de server-only.

import type { ProviderSummary, ProviderCategory } from "./types";

export const publicProviders: ProviderSummary[] = [
  {
    id: "github",
    name: "GitHub",
    displayName: "GitHub",
    descriptionKey: "connectors.providers.github.description",
    category: "popular",
    color: "#181717",
    icon: "github",
    permissionsKeys: [
      "connectors.providers.github.permissions.readProfile",
      "connectors.providers.github.permissions.readEmail",
      "connectors.providers.github.permissions.seePublicRepos",
      "connectors.providers.github.permissions.seeOrgs",
    ],
    configured: true,
  },
  {
    id: "notion",
    name: "Notion",
    displayName: "Notion",
    descriptionKey: "connectors.providers.notion.description",
    category: "popular",
    color: "#000000",
    icon: "notion",
    permissionsKeys: [
      "connectors.providers.notion.permissions.readPages",
      "connectors.providers.notion.permissions.writePages",
    ],
    configured: true,
  },
  // ... tous les autres providers
];

export function getPublicProvider(id: string): ProviderSummary | null {
  return publicProviders.find((p) => p.id === id) ?? null;
}
