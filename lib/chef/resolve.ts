// lib/chef/resolve.ts
//
// Colle serveur (DB + prompt) du mode Chef : determine si le chat
// courant est le chat d'accueil marque d'un compte qui n'a que son
// Chef, puis calcule l'etape via le moteur pur. Le branching fin
// (script vs persona) reste verrouille par onboarding.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getEmployeesByAccount,
  getFirstChatIdForUser,
  requireAccountId,
} from "../db/queries";

import {
  type ChefMessageLike,
  type ChefStep,
  hasChefGreetingMarker,
  nextChefStep,
  userTextsFromMessages,
} from "./onboarding";

let cachedSystemPrompt: string | null = null;

// Prompt systeme du profil noyau chef-manager.json (pont lecture
// seule, comme talents.ts). Charge une fois par processus.
export function loadChefSystemPrompt(
  profilesDir: string = join(
    process.cwd(),
    "core",
    "employee",
    "profiles"
  )
): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const raw = readFileSync(join(profilesDir, "chef-manager.json"), "utf8");
  const parsed = JSON.parse(raw) as { systemPrompt?: unknown };
  if (
    typeof parsed.systemPrompt !== "string" ||
    !parsed.systemPrompt.trim()
  ) {
    throw new Error("Chef profile has no usable systemPrompt");
  }
  cachedSystemPrompt = parsed.systemPrompt;
  return cachedSystemPrompt;
}

export type ResolvedChefStep = ChefStep & { systemPrompt: string };

export async function resolveChefStep(args: {
  userId: string;
  chatId: string;
  history: readonly ChefMessageLike[];
  uiMessages: readonly ChefMessageLike[];
}): Promise<ResolvedChefStep | null> {
  // Marqueur d'abord (en memoire) : les chats normaux ne coutent
  // aucune requete supplementaire.
  if (!hasChefGreetingMarker(args.history)) return null;
  const firstChatId = await getFirstChatIdForUser(args.userId);
  if (firstChatId !== args.chatId) return null;
  const accountId = await requireAccountId(args.userId);
  const employees = await getEmployeesByAccount(accountId);
  if (employees.some((employee) => employee.kind !== "chef")) return null;
  const step = nextChefStep(userTextsFromMessages(args.uiMessages));
  return { ...step, systemPrompt: loadChefSystemPrompt() };
}
