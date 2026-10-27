// lib/template-system-prompts.ts
// Mapping des noms de templates vers les clés de traduction websites

export const templateSystemPromptKeys: Record<string, string> = {
  "Curie Lab": "labWebsiteSystemPrompt",
  "Einstein Portfolio": "researcherPortfolioSystemPrompt",
  Symposium: "symposiumSystemPrompt",
  BioDocs: "labNotebookSystemPrompt",
  "Kepler Dashboard": "keplerDashboardSystemPrompt",
  "Mendel Genomix": "mendelGenomixSystemPrompt",
  "Turing Notebook": "turingNotebookSystemPrompt",
  "Newton Calcul": "newtonCalculSystemPrompt",
};

export function getTemplateSystemPrompt(
  label: string,
  tw: (key: string) => string
): string | null {
  const key = templateSystemPromptKeys[label];
  return key ? tw(key) : null;
}
