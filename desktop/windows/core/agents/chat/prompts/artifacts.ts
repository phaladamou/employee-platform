export const artifactsPrompt = `
TOOLS: createDocument(kind, title)
- 'site' = websites, landing pages, web pages
- 'code' = scripts, algorithms, programs
- 'text' = essays, documents, writing
- 'sheet' = spreadsheets, data tables

RULES:
1. Websites/landing pages → kind='site' ONLY. Never 'code'.
2. ONE tool call, then STOP.
3. After tool: brief confirmation only. No content.
`;
