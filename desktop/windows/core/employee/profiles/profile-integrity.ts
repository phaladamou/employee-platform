import { createHash } from "node:crypto";

/**
 * Forme canonique d'une valeur JSON : cles triees recursivement, sans
 * espace. Deux fichiers de meme contenu logique (ordre des cles ou
 * formatage differents) donnent la meme chaine, donc le meme hash.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return JSON.stringify(value) as string;
    case "object":
      break;
    default:
      throw new Error("Only JSON values can be canonicalized");
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  }

  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalizeJson((value as Record<string, unknown>)[key])}`
    );

  return `{${entries.join(",")}}`;
}

/**
 * Empreinte SHA-256 du contenu logique d'un profil (objet JSON parse).
 * Tout changement semantique (outil, permission, prompt, version...)
 * change le hash ; le reformatage seul ne le change pas.
 */
export function hashProfileContent(spec: unknown): string {
  return createHash("sha256")
    .update(canonicalizeJson(spec), "utf8")
    .digest("hex");
}
