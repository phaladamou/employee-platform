// lib/server/employee-conversation-mapping.ts
// Correspondances pures pour la persistance des conversations
// employe (sans dependance runtime : testable via node --test).
// Stockage : table Chat (une ligne par couple user/employe via
// employeeId) + table Message_v2 (role user/assistant, contenu
// texte dans parts, lien mission optionnel).

export type StoredChatRole = "user" | "assistant";
export type DisplayChatRole = "user" | "employee";

export function toStoredRole(role: DisplayChatRole): StoredChatRole {
  return role === "employee" ? "assistant" : "user";
}

export function toDisplayRole(role: string): DisplayChatRole {
  return role === "assistant" ? "employee" : "user";
}

export function textToParts(text: string): Array<{
  type: "text";
  text: string;
}> {
  return [{ type: "text", text }];
}

export function partsToText(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .map((part) => {
      if (
        typeof part !== "object" ||
        part === null ||
        (part as { type?: unknown }).type !== "text"
      ) {
        return "";
      }
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

export interface ToolCallRecord {
  tool: string;
  ok: boolean;
}

// Normalise les appels du noyau en objets simples stockables
// dans la colonne JSON Mission.toolCalls.
export function toStoredToolCalls(
  calls: ReadonlyArray<{ tool: string; ok: boolean }>
): ToolCallRecord[] {
  return calls.map((call) => ({ tool: call.tool, ok: call.ok === true }));
}

// Revalide le JSON stocke (lignes anciennes ou ecrites a la
// main : entrees malformees ignorees, jamais d'exception).
export function toToolCallRecords(value: unknown): ToolCallRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const records: ToolCallRecord[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const tool = (entry as { tool?: unknown }).tool;
    const ok = (entry as { ok?: unknown }).ok;
    if (typeof tool !== "string" || !tool || typeof ok !== "boolean") {
      continue;
    }
    records.push({ tool, ok });
  }
  return records;
}
