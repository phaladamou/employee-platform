import { expect, test } from "@playwright/test";

// Garde du licenciement sans session (pas de DB requise : le
// middleware decide sur les cookies uniquement).
test.describe("Employee release guards", () => {
  test("redirects unauthenticated visitors away from /employees", async ({
    page,
  }) => {
    await page.goto("/employees");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Femployees/);
  });

  test("rejects unauthenticated release calls with 401", async ({
    request,
  }) => {
    const response = await request.post(
      "/api/employees/00000000-0000-0000-0000-000000000000/release"
    );
    expect(response.status()).toBe(401);
  });
});

// NOTE — le parcours complet connecte (bouton Release de la carte,
// dialogue "Are you sure you want to release …?", toast "… has been
// released.", carte retiree de la liste) n'a pas de harnais portable :
// l'auth est OTP sans bypass dev et aucun seed E2E n'existe. Les
// testids sont en place pour l'ecrire quand le harnais existera :
// employee-card, release-button, release-dialog, release-confirm,
// release-cancel. D'ici la, verification manuelle :
//  1. pnpm db:migrate (applique 0008_employee_release)
//  2. pnpm dev, se connecter, recruter un talent
//  3. /employees -> Release -> confirmer -> toast + carte partie
//  4. la carte du Chef n'affiche aucun bouton Release
