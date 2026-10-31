import type { MissionAcceptance } from "./mission-acceptance";

export interface MissionIntent {
  readonly wantsFileCreation: boolean;
  readonly wantsBugfix: boolean;
}

const CREATE_VERB = String.raw`(?:recreat(?:e[sd]?|ing|ion)|creat(?:e[sd]?|ing|ion)|rewrit(?:e|es|ing|ten)|writ(?:e|es|ing|ten)|rewrote|wrote|generat(?:e[sd]?|ing|ion)|recré(?:er|e|é|ée|ez|ent)|cré(?:er|e|é|ée|ez|ent)|recree(?:r|s|z|nt)?|cree(?:r|s|z|nt)?|réécri(?:t|s|re|vez|vent)|écri(?:t|s|re|vez|vent)|reecri(?:t|s|re|vez|vent)|ecri(?:t|s|re|vez|vent)|gén[èe]r(?:er|e|ez|ent)|genere(?:r|z|nt)?)`;
const FILE_OBJECT = String.raw`(?:fichiers?|files?|scripts?|[\w][\w.-]*\.[\w]{1,6})`;
const BUGFIX_WORD = String.raw`(?:bugs?|fix(?:e[sd]?|ing)?|corrig\w*|corrige\w*|debug(?:ging|ger)?|débog\w*|répar\w*|repar\w*|patch(?:e[sd]?|ing)?)`;

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
 * Exige les criteres correspondant a l'intention detectee : pas de
 * creation de fichier sans `--expect-file`, pas de bugfix sans
 * `--expect-test`. Appele a la creation de la mission (tous les
 * chemins de submit partagent ce point de passage).
 */
export function assertAcceptanceForIntent(
  prompt: string,
  acceptance: MissionAcceptance
): void {
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
