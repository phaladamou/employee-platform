/**
 * Affirmations de succes vs faits observes.
 *
 * Quand une mission n'a AUCUN critere d'acceptation, le runtime fait
 * confiance au Final par defaut (missions de connaissance : le rapport
 * EST le livrable). Ce module detecte le cas suspect : le rapport
 * affirme des effets concrets (fichier, message, commande) qu'aucun
 * appel d'outil reussi n'etaye.
 *
 * Heuristique ASSUMEE (motifs FR+EN stricts : verbe de succes a la
 * 1re personne ou declaration en debut de phrase, conjugue a un
 * artefact concret) — fail-soft : elle ne produit que du doute
 * (needs_review), jamais un echec. Le chemin robuste reste de
 * declarer des criteres d'acceptation (voir mission-acceptance.ts).
 *
 * Limite CONNUE (contournement par reformulation) : les nominalisations
 * ("J'ai procédé à la création du fichier"), les synonymes hors liste
 * ("generated", "delivered") et les affirmations vagues ("all files are
 * in place", "notes.md ready") ne matchent pas et restent en confiance
 * par defaut. Couvrir toutes les paraphrases est hors de portee des
 * motifs ; la parade est contractuelle (criteres declares), pas
 * linguistique. Ne pas elargir les motifs sans ajouter les garde-fous
 * faux-positifs correspondants dans mission-claims.test.ts.
 *
 * Maintenance : quand un outil capable d'un effet est ajoute au
 * noyau (ex. send_email), etendre SUPPORTING_TOOLS, sinon ses
 * affirmations resteront systematiquement suspectes.
 */

export type SuccessClaimCategory = "file" | "message" | "command";

export interface UnsupportedClaim {
  readonly category: SuccessClaimCategory;
  /** Extrait du rapport (motive le reviewReason, borne a 120 car.). */
  readonly excerpt: string;
}

/**
 * Outils dont UN appel reussi etaye chaque categorie. `message` est
 * vide : aucun outil d'envoi n'existe dans le noyau, une affirmation
 * d'envoi n'est donc jamais verifiable automatiquement.
 */
const SUPPORTING_TOOLS: Readonly<
  Record<SuccessClaimCategory, readonly string[]>
> = {
  file: ["write_file"],
  message: [],
  command: ["run_shell"],
};

/** Noms de lecteurs affichables dans les motifs de revue. */
export const CLAIM_SUPPORT_LABEL: Readonly<
  Record<SuccessClaimCategory, string>
> = {
  file: "write_file call",
  message: "messaging tool (none exists)",
  command: "run_shell call",
};

const FILENAME = String.raw`\b[\w][\w.-]*\.(txt|md|markdown|json|jsonl|csv|tsv|log|html?|pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|svg|py|js|mjs|cjs|ts|tsx|jsx|java|go|rs|rb|php|sh|bash|yaml|yml|toml|xml|sql|css)\b`;
const EMAIL = String.raw`\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b`;
const SENTENCE = String.raw`(?:^|[.!?]\s+)`;

const PATTERNS: ReadonlyArray<{
  category: SuccessClaimCategory;
  pattern: RegExp;
}> = [
  // --- Fichier : exige un nom de fichier (pas "a summary") ---
  {
    category: "file",
    pattern: new RegExp(
      String.raw`\bi(?:['’]ve\s+|\s+)(have\s+)?(created|wrote|written|saved|updated|deleted|touched)\b[^.\n]{0,60}?` +
        FILENAME,
      "imu"
    ),
  },
  {
    category: "file",
    pattern: new RegExp(
      SENTENCE +
        String.raw`(created|wrote)\b[^.\n]{0,60}?` +
        FILENAME,
      "imu"
    ),
  },
  {
    category: "file",
    pattern: new RegExp(
      SENTENCE +
        String.raw`(the\s+)?files?\s+(has\s+been\s+|have\s+been\s+|was\s+|were\s+)?(created|written|saved|updated|deleted)\b` +
        String.raw`(?!\s+by\s+(the\s+user|you|the\s+client)\b)`,
      "imu"
    ),
  },
  {
    category: "file",
    pattern: new RegExp(
      String.raw`\bj['’]?\s*ai\b\s+(créé|crée|écrit|ecrit|enregistré|sauvegardé|supprimé|touché)(?![\p{L}])[^.\n]{0,60}?` +
        FILENAME,
      "imu"
    ),
  },
  {
    category: "file",
    pattern: new RegExp(
      SENTENCE +
        String.raw`(le\s+|la\s+|les\s+|un\s+|une\s+)?fichiers?\s+(a\s+été\s+|ont\s+été\s+|est\s+)?(créé|crée|écrit|ecrit|enregistré|sauvegardé|supprimé)s?(?![\p{L}])` +
          String.raw`(?!\s+par\s+(l['’]utilisateur|vous|le\s+client)\b)`,
      "imu"
    ),
  },
  // --- Message : exige un canal (adresse, email/message explicite) ---
  {
    category: "message",
    pattern: new RegExp(
      String.raw`\bi(?:['’]ve\s+|\s+)(have\s+)?sent\b[^.\n]{0,60}?` +
        `(?:${EMAIL}|the\\s+(email|message)s?\\b|an?\\s+(email|message)s?\\b)`,
      "imu"
    ),
  },
  {
    category: "message",
    pattern: new RegExp(
      SENTENCE + String.raw`(email|e-mail|message)s?\s+sent\b`,
      "imu"
    ),
  },
  {
    category: "message",
    pattern: new RegExp(
      String.raw`\bi(?:['’]ve\s+|\s+)(have\s+)?(emailed|notified|contacted)\b`,
      "im"
    ),
  },
  {
    category: "message",
    pattern: new RegExp(
      String.raw`\bj['’]?\s*ai\b\s+envoyé(?![\p{L}])[^.\n]{0,60}?` +
        `(?:${EMAIL}|l['\u2019]?(email|e-mail|message)s?\\b|un\\s+(email|message)s?\\b|le\\s+(email|message)s?\\b)`,
      "imu"
    ),
  },
  {
    category: "message",
    pattern: new RegExp(
      SENTENCE + String.raw`(email|e-mail|message|courriel)s?\s+envoyé(?![\p{L}])`,
      "imu"
    ),
  },
  {
    category: "message",
    pattern: new RegExp(
      String.raw`\bj['’]?\s*ai\b\s+(prévenu|notifié|contacté)(?![\p{L}])`,
      "imu"
    ),
  },
  // --- Commande : exige le mot commande (pas "analysis"/"plan") ---
  {
    category: "command",
    pattern: new RegExp(
      String.raw`\bi(?:['’]ve\s+|\s+)(have\s+|just\s+)?(ran|executed)\b[^.\n]{0,40}?(the\s+)?(commands?|scripts?)\b`,
      "imu"
    ),
  },
  {
    category: "command",
    pattern: new RegExp(
      SENTENCE + String.raw`(the\s+)?commands?\s+(executed|ran)\s+successfully\b`,
      "imu"
    ),
  },
  {
    category: "command",
    pattern: new RegExp(
      String.raw`\bj['’]?\s*ai\b\s+exécuté(?![\p{L}])[^.\n]{0,40}?la\s+commandes?\b`,
      "imu"
    ),
  },
  {
    category: "command",
    pattern: new RegExp(
      SENTENCE + String.raw`(la\s+)?commandes?\s+exécutée?s?\s+avec\s+succès\b`,
      "imu"
    ),
  },
];

function excerptOf(match: string): string {
  return match.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Aveu explicite de non-accomplissement : le Final declare que le but
 * n'est PAS atteint ("Mission not executed", "could not write...").
 * Miroir des affirmations de succes : ici le modele est honnete, mais
 * le statut ne doit pas benir un but manque. Meme fail-soft :
 * doute (needs_review), jamais echec auto.
 *
 * Frontiere assumee : seuls les verbes d'achevement comptent
 * ("could not FIND", "impossible to OVERSTATE" ne matchent pas), et
 * "cannot EXECUTE" seul ne suffit pas (decrire une incapacite
 * generale n'est pas avouer un but manque).
 */
export interface RefusalAdmission {
  readonly excerpt: string;
}

const REFUSAL_PATTERNS: ReadonlyArray<RegExp> = [
  // Mission/task explicitement non executee.
  new RegExp(
    String.raw`\b(mission|task)\s+(was\s+|has\s+been\s+)?not\s+(executed|completed|finished|done)\b`,
    "imu"
  ),
  // "could not / couldn't" + verbe d'achevement (pas "find", "see"...).
  new RegExp(
    String.raw`\b(could\s+not|couldn['’]t)\s+(complete|finish|execute|run|create|write|send|proceed|perform|do\s+it)\b`,
    "imu"
  ),
  // "unable to" + verbe d'achevement.
  new RegExp(
    String.raw`\bunable\s+to\s+(complete|finish|execute|run|create|write|send|proceed|perform)\b`,
    "imu"
  ),
  // "cannot be run/executed..." (passif, but porte sur la tache).
  new RegExp(
    String.raw`\bcannot\s+be\s+(run|executed|completed|finished|done)\b`,
    "imu"
  ),
  // "cannot complete/finish..." (actif, but porte sur la tache).
  new RegExp(String.raw`\bcannot\s+(complete|finish)\b`, "imu"),
  // "No <chose> was created/completed..." (passif sans agent).
  new RegExp(
    String.raw`\bno\s+\w+\s+was\s+(created|completed|executed|modified|sent|done)\b`,
    "imu"
  ),
  new RegExp(
    String.raw`\bno\s+\w+\s+were\s+(created|completed|executed|modified|sent|done)\b`,
    "imu"
  ),
  // Passif negatif explicite.
  new RegExp(
    String.raw`\b(was\s+not|were\s+not|has\s+not\s+been|have\s+not\s+been)\s+(completed|executed|finished|created|sent)\b`,
    "imu"
  ),
  // Echec nomme.
  new RegExp(String.raw`\b(i\s+failed\s+to|mission\s+failed|task\s+failed)\b`, "imu"),
  // "did not" + verbe d'achevement.
  new RegExp(
    String.raw`\bdid\s+not\s+(complete|finish|execute|run|create|send|manage\s+to)\b`,
    "imu"
  ),
  // "impossible to" + achevement (pas "overstate"...).
  new RegExp(
    String.raw`\bimpossible\s+to\s+(complete|finish|execute|carry\s+out)\b`,
    "imu"
  ),
  // --- Francais ---
  new RegExp(
    String.raw`\b(mission|tâche)\s+non\s+(exécutée?|terminée?|accomplie?|réalisée?|faite)\b`,
    "imu"
  ),
  new RegExp(
    String.raw`\bn['’]ai\s+pas\s+pu\s+(terminer|finir|exécuter|accomplir|créer|envoyer|le\s+faire)\b`,
    "imu"
  ),
  new RegExp(
    String.raw`\bn['’]a\s+pas\s+été\s+(exécuté|terminé|accompli|créé|envoyé|réalisé|fait)e?s?(?![\p{L}])`,
    "imu"
  ),
  new RegExp(
    String.raw`\bimpossible\s+de\s+(terminer|finir|exécuter|accomplir|réaliser)\b`,
    "imu"
  ),
  new RegExp(
    String.raw`\baucun\s+fichier\s+n['’]a\s+été\s+(créé|modifié|écrit)(?![\p{L}])`,
    "imu"
  ),
  new RegExp(String.raw`\bnon\s+exécuté(?![\p{L}])`, "imu"),
];

/**
 * Premier aveu de non-accomplissement du rapport, ou null.
 * Deterministe (ordre des motifs). L'appelant decide du verdict.
 */
export function detectRefusalAdmission(reportContent: string): RefusalAdmission | null {
  for (const pattern of REFUSAL_PATTERNS) {
    const match = pattern.exec(reportContent);
    if (match) {
      return { excerpt: excerptOf(match[0]) };
    }
  }
  return null;
}

/**
 * Affirmations d'effets du rapport qu'aucun appel reussi n'etaye.
 * `successfulTools` : noms d'outils avec >= 1 appel ok pendant le run.
 * Au plus une affirmation par categorie (la premiere), deterministe.
 */
export function detectUnsupportedClaims(
  reportContent: string,
  successfulTools: readonly string[]
): readonly UnsupportedClaim[] {
  const supported = new Set(successfulTools);
  const seen = new Set<SuccessClaimCategory>();
  const claims: UnsupportedClaim[] = [];

  for (const { category, pattern } of PATTERNS) {
    if (seen.has(category)) {
      continue;
    }
    if (
      SUPPORTING_TOOLS[category].some((tool) => supported.has(tool))
    ) {
      seen.add(category);
      continue;
    }
    const match = pattern.exec(reportContent);
    if (match) {
      seen.add(category);
      claims.push({ category, excerpt: excerptOf(match[0]) });
    }
  }

  return claims;
}
