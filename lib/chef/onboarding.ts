// lib/chef/onboarding.ts
//
// Moteur PUR du parcours d'accueil du Chef (aucun import DB, Next ou
// LLM) : etant donnes les messages utilisateur du chat d'accueil,
// designe la prochaine reponse. Script exact impose par le produit
// pour les etapes 1-2, persona LLM (prompt systeme du profil
// chef-manager.json) pour la recommandation et la suite.
// Comportement verrouille par onboarding.test.ts :
// `node --test lib/chef/onboarding.test.ts`.

// Message de presentation, pose a la creation du compte (graine du
// chat d'accueil) et marqueur du mode Chef. Ne pas modifier sans
// mettre a jour la graine et les tests.
export const CHEF_GREETING =
  "Bonjour, je suis votre Manager. Je vais vous aider à constituer votre équipe. Comment puis-je vous appeler ?";

const NAME_PREFIXES = [
  "je m'appelle ",
  "je m appelle ",
  "je suis ",
  "moi c'est ",
  "moi c est ",
  "c'est ",
  "c est ",
  "my name is ",
  "i'm ",
  "i am ",
  "call me ",
  "this is ",
];

// "Je m'appelle Phal" -> "Phal". Heuristique sobre : un seul token,
// vide si rien d'exploitable (le message de suite s'en passe).
export function extractDisplayName(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, " ");
  const lower = collapsed.toLowerCase();
  let rest = collapsed;
  for (const prefix of NAME_PREFIXES) {
    if (lower.startsWith(prefix)) {
      rest = collapsed.slice(prefix.length).trim();
      break;
    }
  }
  const first = rest.split(" ")[0] ?? "";
  const cleaned = first.replace(
    /^[^A-Za-zÀ-ÿ'-]+|[^A-Za-zÀ-ÿ'-]+$/g,
    ""
  );
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function buildNameReply(name: string): string {
  const hello = name ? `Enchanté ${name}.` : "Enchanté !";
  return (
    `${hello} Pour commencer, dites-moi : quel est votre premier projet ou besoin ?\n\n` +
    "Avez-vous déjà une idée du type de spécialiste qu'il vous faut, ou voulez-vous que je vous guide ?"
  );
}

export function buildRecruitGuideReply(): string {
  return "Parfait ! Rendez-vous sur la [page de recrutement](/employees/recruit) pour découvrir les spécialistes disponibles et cliquer sur « Recruter ». Dites-moi quand c'est fait, je vous aiderai pour la suite.";
}

function normalizeAnswer(text: string): string {
  const inner = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ` ${inner} `;
}

// Formes deja normalisees (minuscules, sans accents, espaces).
const AFFIRMATIVE_FORMS = [
  "oui",
  "ouais",
  "yes",
  "yeah",
  "yep",
  "ok",
  "d accord",
  "vas y",
  "allons y",
  "allez",
  "volontiers",
  "avec plaisir",
  "je veux bien",
  "pourquoi pas",
  "bien sur",
  "tout a fait",
];

const NEGATIVE_FORMS = [
  "non",
  "no",
  "nope",
  "pas",
  "jamais",
  "plus tard",
  "pas encore",
  "ne veux pas",
  "veux pas",
  "laisse tomber",
  "stop",
  "arrete",
];

// "Oui, je veux bien !" -> true. Les formules affirmatives
// multi-mots passent d'abord ("pourquoi pas" contient "pas" mais
// reste un oui) ; sinon la negation gagne sur l'affirmation
// ("oui, non, je ne sais pas" -> false).
export function isAffirmative(text: string): boolean {
  const normalized = normalizeAnswer(text);
  const contains = (form: string) => normalized.includes(` ${form} `);
  if (
    AFFIRMATIVE_FORMS.filter((form) => form.includes(" ")).some(contains)
  ) {
    return true;
  }
  if (NEGATIVE_FORMS.some(contains)) {
    return false;
  }
  return AFFIRMATIVE_FORMS.filter(
    (form) => !form.includes(" ")
  ).some(contains);
}

export type ChefStep =
  | { kind: "greeting"; text: string }
  | { kind: "scripted"; text: string }
  | { kind: "persona"; need: string | null };

// Derive l'etape du seul historique utilisateur : 0 -> presentation,
// 1 (le nom) -> question projet, 2 (le besoin) -> recommandation via
// le prompt systeme, 3 ("oui ?") -> guide recrutement ou persona,
// 4+ -> conversation libre en persona.
export function nextChefStep(userTexts: string[]): ChefStep {
  if (userTexts.length === 0) {
    return { kind: "greeting", text: CHEF_GREETING };
  }
  if (userTexts.length === 1) {
    return {
      kind: "scripted",
      text: buildNameReply(extractDisplayName(userTexts[0] ?? "")),
    };
  }
  if (userTexts.length === 2) {
    return { kind: "persona", need: userTexts[1] ?? "" };
  }
  if (userTexts.length === 3) {
    return isAffirmative(userTexts[2] ?? "")
      ? { kind: "scripted", text: buildRecruitGuideReply() }
      : { kind: "persona", need: null };
  }
  return { kind: "persona", need: null };
}

// Forme structurelle minimale (compatible DBMessage, dont les parts
// sont du JSON brut, et ChatMessage) : le moteur ne depend ni du
// schema ni des types UI.
export interface ChefMessageLike {
  role: string;
  parts?: unknown;
}

function textParts(parts: unknown): string[] {
  if (!Array.isArray(parts)) return [];
  return parts
    .filter(
      (part): part is { type?: unknown; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
    )
    .map((part) => part.text);
}

function textOf(message: ChefMessageLike): string {
  return textParts(message.parts).join(" ").trim();
}

// Un element par message utilisateur, meme sans texte (piece jointe
// seule) : l'alignement des etapes ne doit pas glisser.
export function userTextsFromMessages(
  messages: readonly ChefMessageLike[]
): string[] {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => textOf(message));
}

// Le mode Chef ne s'enclenche que sur le chat d'accueil marque (le
// premier message assistant est exactement la presentation posee a
// la creation du compte) : les conversations existantes gardent le
// comportement generique.
export function hasChefGreetingMarker(
  messages: readonly ChefMessageLike[]
): boolean {
  const firstAssistant = messages.find(
    (message) => message.role === "assistant"
  );
  if (!firstAssistant) return false;
  return textOf(firstAssistant) === CHEF_GREETING;
}
