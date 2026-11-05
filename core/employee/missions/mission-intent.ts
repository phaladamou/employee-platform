import type { MissionAcceptance } from "./mission-acceptance";

export interface MissionIntent {
  readonly wantsFileCreation: boolean;
  readonly wantsBugfix: boolean;
}

const CREATE_VERB = String.raw`(?:recreat(?:e[sd]?|ing|ion)|creat(?:e[sd]?|ing|ion)|rewrit(?:e|es|ing|ten)|writ(?:e|es|ing|ten)|rewrote|wrote|generat(?:e[sd]?|ing|ion)|recré(?:er|e|é|ée|ez|ent)|cré(?:er|e|é|ée|ez|ent)|recree(?:r|s|z|nt)?|cree(?:r|s|z|nt)?|réécri(?:t|s|re|vez|vent)|écri(?:t|s|re|vez|vent)|reecri(?:t|s|re|vez|vent)|ecri(?:t|s|re|vez|vent)|gén[èe]r(?:er|e|ez|ent)|genere(?:r|z|nt)?)`;
const FILE_OBJECT = String.raw`(?:fichiers?|files?|scripts?|[\w][\w.-]*\.[\w]{1,6})`;
const BUGFIX_WORD = String.raw`(?:bugs?|fix(?:e[sd]?|ing)?|corrig\w*|corrige\w*|debug(?:ging|ger)?|débog\w*|répar\w*|repar\w*|patch(?:e[sd]?|ing)?)`;
const GITHUB_WORD = String.raw`(?:github|forks?|repos?|issues?)`;
// Verbes d'action NON AMBIGUS (FR+EN) : employes seuls, ils
// ordonnent un acte. Bornes unicode strictes (pas de "étage"
// pour "tag", pas de "reporter" pour "repo").
const STRONG_VERB = String.raw`(?:pull(?:ed|ing|s)?|push(?:ed|ing|es)?|commit(?:ted|ting|s)?|merg(?:e[sd]?|ing)|rebase[sd]?|checkout|branch(?:es)?|tags?|releases?|deploy(?:ed|ing|s)?|d[ée]ploy(?:er|e|ez|ent)|install(?:ed|ing|s)?|install(?:er|e|ez|ent)|build(?:ing|s)?|compil(?:er|e|ez|ent)|modify|modifi(?:er|e|ez|ent)|updat(?:e[sd]?|ing)|delet(?:e[sd]?|ing)|supprim(?:er|e|ez|ent)|remov(?:e[sd]?|ing)|enlev(?:er|e|ez|ent)|renam(?:e[sd]?|ing)|renomm(?:er|e|ez|ent)|mov(?:e[sd]?|ing)|d[ée]plac(?:er|e|ez|ent)|cop(?:y|ies|ied)|copi(?:er|e|ez|ent)|fetch(?:ed|ing|es)?|sync(?:ed|ing|s)?|audit(?:ed|ing|s)?|scan(?:ned|ning|s)?)`;
const FORK_CLONE_VERB = String.raw`(?:fork(?:ed|ing|s)?|clone[sd]?|clon(?:er|e|ez|ent))`;
/**
 * Fork/clone exigent un complement ("fork le repo", "clone-moi
 * X") : "c'est quoi un fork ?" reste conversationnel. Le tiret
 * couvre l'imperatif ("clone-moi"), la ponctuation seule non.
 */
const FORK_CLONE = String.raw`${FORK_CLONE_VERB}[\s-]+[\p{L}\d]`;
/**
 * Complement INDEFINI ("cloner un projet", "clone a repo") : pas
 * de cible identifiable, donc pas d'acte possible — c'est une
 * question (capacite, hypothese), pas un ordre. Une mission
 * demarree sans cible ne ferait aucun pas (0 outil) : la parole
 * suffit, et le bouton "en faire une mission" reste le secours
 * si l'ordre etait reel.
 */
const INDEFINITE_ARTICLE = String.raw`(?:un|une|des|a|an|some)`;
const FORK_CLONE_INDEFINITE = String.raw`${FORK_CLONE_VERB}[\s-]+${INDEFINITE_ARTICLE}\s+[\p{L}\d]`;
// Verbes AMBIGUS (FR+EN) : acte seulement devant un objet du
// perimetre ("liste les fichiers", pas "la liste des courses" ;
// "open" seul ne veto pas "open source").
const OBJECT_VERB = String.raw`(?:run(?:s)?|execut(?:e[sd]?|ing)|ex[ée]cut(?:er|e|ez|ent)|launch(?:ed|ing|es)?|lanc(?:er|e|ez|ent)|d[ée]marr(?:er|e|ez|ent)|read(?:ing|s)?|lis(?:ez|ons)?|lire|open(?:ed|ing|s)?|ouvr(?:ir|e|ez|ent)|analy[sz]e[sd]?|analys(?:er|e|ez|ent)|search(?:ed|ing|es)?|cherch(?:er|e|ez|ent)|recherch(?:er|e|ez|ent)|find(?:ing|s)?|trouv(?:er|e|ez|ent)|list(?:ed|ing|s)?|list(?:er|e|ez|ent)|show(?:ing|s)?|montr(?:er|e|ez|ent)|display(?:ed|ing|s)?|affich(?:er|e|ez|ent|age)?|inspect(?:ed|ing|s)?|inspect(?:er|e|ez|ent)|check(?:ed|ing|s)?|v[ée]rifi(?:er|e|ez|ent)|test(?:ed|ing|s)?|test(?:er|e|ez|ent)|review(?:ed|ing|s)?|relis|relire|explor(?:e[sd]?|ing)|regarde|look\s+at|expliqu(?:er|e|ez|ent)|explain(?:ed|ing|s)?)`;
/** Objets du perimetre : ce que les verbes ambigus doivent viser (memoire exclue : pas d'outil de lecture). */
const VERB_OBJECT = String.raw`(?:fichiers?|files?|scripts?|code|workspaces?|projets?|projects?|d[ée]p[ôo]ts?|repos?|dossiers?|folders?|r[ée]pertoires?|journal|tests?|bugs?|erreurs?|errors?|fonction|function|classe|class|variable)`;
/** Actions GitHub : verbe + objet GitHub sous 40 caracteres ("crée une issue", pas "c'est quoi un fork ?"). */
const GITHUB_ACTION_VERB = String.raw`(?:cr[éee](?:er|e|ez|ent)?|creat(?:e[sd]?|ing)|open(?:ed|ing|s)?|ouvr(?:ir|e|ez|ent)|clos(?:e[sd]?|ing)|ferm(?:er|e|ez|ent)|list(?:ed|ing|s)?|list(?:er|e|ez|ent)|show(?:ing|s)?|montr(?:er|e|ez|ent)|comment(?:ed|ing|s)?|merg(?:e[sd]?|ing)|fusionn(?:er|e|ez|ent)|assign(?:ed|ing|s)?|fork(?:ed|ing|s)?|clone[sd]?)`;
const GITHUB_ACTION_OBJECT = String.raw`(?:issues?|pull\s+requests?|forks?|repos?|branches?|commits?|d[ée]p[ôo]ts?)`;
/** Reference a un fichier par son nom dotted (extension lettres : pas de "3.5" ni "v1.2"). */
const FILE_REF = String.raw`(?:[\w][\w.-]*\.[a-zA-Z]{2,6})`;
const URL_REF = String.raw`(?:https?://\S+|github\.com|\.git\b)`;
/**
 * Reference POSSESSIVE au perimetre ("mon travail", "mes
 * fichiers") : MES donnees, inspection outillee, meme en
 * question. La memoire est exclue : aucun outil ne la lit a la
 * demande, la reponse directe convient mieux.
 */
const WORKSPACE_REF_OWN = String.raw`(?:workspaces?|(?:mes|tes|ses|nos|vos|ma|ta|sa|mon|ton|son|notre|votre|my|your)\s+(?:fichiers?|files?|projets?|projects?|d[ée]p[ôo]ts?|repos?|repositories|repository|travail|work|journal(?:\s+d[''’]activit[ée])?))`;
/**
 * Reference DEFINIE ("le projet", "les fichiers") : veto sauf
 * question ("le fork du projet date de quand ?" se discute
 * d'abord, bouton mission en secours).
 */
const WORKSPACE_REF_THE = String.raw`(?:(?:ce|cette|ces|le|la|les|du|des|this|that|the)\s+(?:fichiers?|files?|projets?|projects?|d[ée]p[ôo]ts?|repos?|repositories|repository|travail|work))`;

/**
 * Devine l'intention machine-verifiable d'un prompt (creation de
 * fichier, correction de bug). Heuristique FR+EN : verbe de
 * creation suivi d'un objet fichier (mot ou nom.dotted) sous 60
 * caracteres, ou mot de la famille bugfix. Bornes unicode strictes
 * (pas de "prefix" ni de "fixture"). Faux negatifs possibles par
 * reformulation (meme limite documentee que les claims) ; les
 * donneurs precis joignent leurs criteres dans tous les cas.
 */
export function detectMissionIntent(prompt: string): MissionIntent {
  const wantsFileCreation = new RegExp(
    `(?<![\\p{L}])${CREATE_VERB}(?![\\p{L}])[\\s\\S]{0,60}?(?<![\\p{L}])${FILE_OBJECT}(?![\\p{L}])`,
    "iu"
  ).test(prompt);
  const wantsBugfix = new RegExp(
    `(?<![\\p{L}])${BUGFIX_WORD}(?![\\p{L}])`,
    "iu"
  ).test(prompt);

  return { wantsFileCreation, wantsBugfix };
}

/**
 * Mission GitHub : la verification se fait sur GitHub (fork,
 * issue/PR + URLs retournees par les outils), pas sur le disque
 * local. Mots-cles explicites uniquement, bornes unicode strictes
 * (pas de "repository", "tissue" ni "reporter"). "PR" reste
 * sensible a la casse, comme le garde du chat web.
 */
export function isGithubMission(prompt: string): boolean {
  if (
    new RegExp(`(?<![\\p{L}])${GITHUB_WORD}(?![\\p{L}])`, "iu").test(prompt)
  ) {
    return true;
  }
  if (/(?<![\p{L}])pull request(?![\p{L}])/iu.test(prompt)) {
    return true;
  }
  return /(?<![\p{L}])PR(?![\p{L}])/u.test(prompt);
}

function boundedWord(pattern: string): RegExp {
  return new RegExp(`(?<![\\p{L}])${pattern}(?![\\p{L}])`, "iu");
}

function verbNearObject(
  verb: string,
  object: string,
  prompt: string,
  window = 40
): boolean {
  return new RegExp(
    `(?<![\\p{L}])${verb}(?![\\p{L}])[\\s\\S]{0,${window}}?(?<![\\p{L}])${object}(?![\\p{L}])`,
    "iu"
  ).test(prompt);
}

const ARTICLE_NOUN = String.raw`(?:un|une|des|le|la|les|ce|cette|ces|du|des|de|a|an|the|this|that|these|those)`;
const STRONG_OR_FORK = String.raw`(?:${STRONG_VERB}|fork(?:ed|ing|s)?|clone[sd]?|clon(?:er|e|ez|ent))`;

/**
 * Retire les noms article + mot-outil ("a pull request", "le
 * build est casse", "l'audit") avant le test des verbes forts :
 * un nom n'est jamais un ordre. Les possessifs ("mon commit")
 * restent des references d'acte.
 */
function scrubArticleNouns(prompt: string): string {
  return prompt
    .replace(
      new RegExp(
        `(?<![\\p{L}])${ARTICLE_NOUN}\\s+${STRONG_OR_FORK}(?![\\p{L}])`,
        "giu"
      ),
      " "
    )
    .replace(
      new RegExp(
        `(?<![\\p{L}])[ld][''’]${STRONG_OR_FORK}(?![\\p{L}])`,
        "giu"
      ),
      " "
    );
}

/**
 * Action sur une PR : "PR" sensible a la casse (convention
 * isGithubMission), verbe insensible, fenetre de 40 caracteres
 * avant le sigle ("Ouvre une PR", pas "il est à peu près là").
 */
function githubPrAction(prompt: string): boolean {
  const pr = /(?<![\p{L}])PR(?![\p{L}])/u.exec(prompt);
  if (!pr || pr.index === undefined) {
    return false;
  }
  const before = prompt.slice(Math.max(0, pr.index - 40), pr.index);
  return boundedWord(GITHUB_ACTION_VERB).test(before);
}

/**
 * Le prompt demande-t-il un ACTE outille (mission) ? Veto
 * explicites : creation/bugfix existants, action GitHub
 * (verbe + objet), verbe fort seul, verbe ambigu + objet du
 * perimetre, reference fichier/URL/workspace. Tout le reste
 * (salutations, questions, avis, phrases vagues) releve de la
 * parole, pas de la boucle.
 */
export function looksLikeMission(prompt: string): boolean {
  const intent = detectMissionIntent(prompt);
  if (intent.wantsFileCreation || intent.wantsBugfix) {
    return true;
  }
  const words = scrubArticleNouns(prompt);
  if (boundedWord(STRONG_VERB).test(words)) {
    return true;
  }
  if (
    new RegExp(`(?<![\\p{L}])${FORK_CLONE}`, "iu").test(words) &&
    !new RegExp(`(?<![\\p{L}])${FORK_CLONE_INDEFINITE}`, "iu").test(words)
  ) {
    return true;
  }
  if (
    verbNearObject(GITHUB_ACTION_VERB, GITHUB_ACTION_OBJECT, prompt) ||
    githubPrAction(prompt)
  ) {
    return true;
  }
  if (verbNearObject(OBJECT_VERB, VERB_OBJECT, prompt)) {
    return true;
  }
  if (
    boundedWord(FILE_REF).test(prompt) ||
    new RegExp(URL_REF, "i").test(prompt) ||
    boundedWord(WORKSPACE_REF_OWN).test(prompt)
  ) {
    return true;
  }
  if (
    !/\?\s*$/.test(prompt) &&
    boundedWord(WORKSPACE_REF_THE).test(prompt)
  ) {
    return true;
  }
  return false;
}

/**
 * Le prompt releve-t-il de la conversation (reponse directe, sans
 * outils) ? Par defaut OUI sauf veto mission : une question
 * simple ne doit jamais declencher clone/lecture, et un ordre
 * manque se recupere (bouton "en faire une mission", reformulation
 * avec un verbe d'action). Les mots GitHub nus ("c'est quoi un
 * fork ?") restent conversationnels : seule une ACTION GitHub
 * (verbe + objet) part en mission.
 */
export function isConversationalPrompt(prompt: string): boolean {
  if (!prompt.trim()) {
    return false;
  }
  return !looksLikeMission(prompt);
}

/**
 * Exige les criteres correspondant a l'intention detectee : pas de
 * creation de fichier sans `--expect-file`, pas de bugfix sans
 * `--expect-test`. Appele a la creation de la mission (tous les
 * chemins de submit partagent ce point de passage). Exception :
 * les missions GitHub se verifient sur GitHub, pas sur le disque
 * local (voir isGithubMission).
 */
export function assertAcceptanceForIntent(
  prompt: string,
  acceptance: MissionAcceptance
): void {
  if (isGithubMission(prompt)) {
    return;
  }
  const intent = detectMissionIntent(prompt);
  if (intent.wantsFileCreation && acceptance.files.length === 0) {
    throw new Error(
      "Mission looks like file creation: attach file acceptance (CLI: --expect-file <path>)"
    );
  }
  if (intent.wantsBugfix && (acceptance.tests?.length ?? 0) === 0) {
    throw new Error(
      'Mission looks like a bugfix: attach test acceptance (CLI: --expect-test "<command>")'
    );
  }
}
