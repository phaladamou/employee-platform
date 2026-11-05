// lib/server/github-connection.ts
// Connexion GitHub d'Atlas : PAT utilisateur stocke chiffre dans la
// table connectors (provider dedie, sans rapport avec l'OAuth login
// "github"). Jamais importe cote client.
import "server-only";

import { getConnector } from "@/lib/db/queries";

export const ATLAS_GITHUB_PROVIDER = "github-atlas";
export const ATLAS_GITHUB_SCOPE = "atlas:repo";

/**
 * Import paresseux OBLIGATOIRE : le module crypto jette au chargement
 * sans ses cles OAUTH_* — un import statique casserait toute la
 * route chat sur les serveurs sans OAuth configure.
 */
async function decryptTokenSafe(ciphertext: string): Promise<string | null> {
  try {
    const { decryptToken } = await import("@/lib/connectors/core/crypto");
    return decryptToken(ciphertext);
  } catch {
    return null;
  }
}

/** Token clair de l'utilisateur, ou null (non connecte / illisible). */
export async function loadUserGithubToken(
  userId: string
): Promise<string | null> {
  try {
    const rows = await getConnector({
      userId,
      provider: ATLAS_GITHUB_PROVIDER,
    });
    const encrypted = rows[0]?.accessToken;
    if (!encrypted) {
      return null;
    }
    return await decryptTokenSafe(encrypted);
  } catch (error) {
    console.error("loadUserGithubToken: cannot load GitHub token:", error);
    return null;
  }
}
