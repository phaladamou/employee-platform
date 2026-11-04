// lib/chef/resolve.ts
//
// Colle serveur (DB + prompt) du mode Chef : sur un compte qui n'a
// que son Chef, chaque chat parle au Chef (script sur le chat
// d'accueil marque, persona directe ailleurs). Le branching fin
// reste verrouille par onboarding.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getAccountIdForUser,
  getEmployeesByAccount,
  getFirstChatIdForUser,
} from "../db/queries";

import {
  type ChefMessageLike,
  type ChefStep,
  decideChefMode,
  hasChefGreetingMarker,
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

export type ResolvedChefStep = ChefStep & {
  systemPrompt: string;
  accountId: string;
};

export async function resolveChefStep(args: {
  userId: string;
  chatId: string;
  history: readonly ChefMessageLike[];
  uiMessages: readonly ChefMessageLike[];
}): Promise<ResolvedChefStep | null> {
  // Compte Chef-only ? (2 requetes indexees par message : le prix
  // pour que chaque chat du workspace parle au Chef.) Sans compte,
  // flux normal.
  const accountId = await getAccountIdForUser(args.userId);
  if (!accountId) return null;
  const employees = await getEmployeesByAccount(accountId);
  const chefOnly = !employees.some(
    (employee) => employee.kind !== "chef"
  );
  if (!chefOnly) return null;
  // Chat d'accueil marque -> script ; tout autre chat -> persona
  // directe (l'accueil ne se rejoue jamais).
  const marked =
    hasChefGreetingMarker(args.history) &&
    (await getFirstChatIdForUser(args.userId)) === args.chatId;
  const step = decideChefMode({
    marked,
    chefOnly,
    userTexts: userTextsFromMessages(args.uiMessages),
  });
  if (!step) return null;
  return { ...step, systemPrompt: loadChefSystemPrompt(), accountId };
}
