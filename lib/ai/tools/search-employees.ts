// lib/ai/tools/search-employees.ts
//
// Outil de lecture du Chef : cherche des employes IA dans le
// catalogue recrutable (Talent Network). Le Chef l'appelle des qu'il
// comprend ce que l'utilisateur veut lancer ; le frontend rend
// chaque resultat en carte avec un bouton "Voir la fiche" via le
// template partage (components/workspace/recruit/
// employee-recommendation-card.tsx). Le Chef choisit qui afficher
// via query + limit : chaque resultat = une carte.
import { tool } from "ai";
import { z } from "zod";

import { getHiredTalentSpecs, getTalentProfiles } from "@/lib/db/queries";
import {
  filterTalents,
  formatTalentProfile,
  toEmployeeSearchResult,
} from "@/lib/employees/catalog";

export const searchEmployeesInputSchema = z.object({
  query: z
    .string()
    .describe(
      "Mots-cles du besoin : role, competences ou projet ('application mobile', 'analyse de donnees', 'strategie de contenu'...)."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(6)
    .optional()
    .describe("Nombre max de resultats (defaut 3)."),
});

export function searchEmployees({
  accountId,
}: {
  accountId: string | null;
}) {
  return tool({
    description:
      "Search the company's AI employee catalog (Talent Network) for specialists matching the user's need. Each returned result is rendered automatically as a recommendation card (avatar, name, role, department, pitch, skills, 'View profile' button linking to /employees/recruit?talent=<spec>). You choose which cards appear via query and limit (1 to 3 recommended). Call this as soon as you understand what the user wants to launch, before recommending anyone.",
    inputSchema: searchEmployeesInputSchema,
    execute: async ({ query, limit }) => {
      try {
        const [rows, hiredSpecs] = await Promise.all([
          getTalentProfiles(),
          accountId ? getHiredTalentSpecs(accountId) : Promise.resolve([]),
        ]);
        const hired = new Set(hiredSpecs);
        const talents = rows.map((row) =>
          formatTalentProfile(row, hired.has(row.spec))
        );
        const results = filterTalents(talents, query, "all")
          .slice(0, limit ?? 3)
          .map(toEmployeeSearchResult);
        return { query, results, resultCount: results.length };
      } catch {
        return { error: "Search failed", query, results: [] };
      }
    },
  });
}
