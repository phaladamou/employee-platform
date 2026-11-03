// lib/chef/actions.test.ts
// Contrat des 3 cartes d'action du Chef (copie exact, liens vers des
// routes existantes, ouverture mission comprise par le moteur).
// Execution : node --test lib/chef/actions.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { CHEF_ACTION_CARDS } from "./actions.ts";
import { nextChefStep } from "./onboarding.ts";

const APP_DIR = join(import.meta.dirname, "..", "..", "app", "(chat)");

describe("chef action cards", () => {
  it("locks the exact card copy", () => {
    assert.deepEqual(
      CHEF_ACTION_CARDS.map((card) => [card.id, card.title]),
      [
        ["recruit", "Recruit Talent"],
        ["mission", "Start a Mission"],
        ["team", "View Team"],
      ]
    );
    assert.deepEqual(
      CHEF_ACTION_CARDS.map((card) => card.description),
      [
        "Discover specialized AI employees and build your team.",
        "Give a task to one of your employees and get a report.",
        "Check the status of your employees and their history.",
      ]
    );
  });

  it("links to existing routes", () => {
    const hrefs = CHEF_ACTION_CARDS.map((card) => card.href);
    assert.deepEqual(hrefs, ["/employees/recruit", null, "/employees"]);
    for (const href of hrefs) {
      if (!href) continue;
      const page = join(APP_DIR, href, "page.tsx");
      assert.equal(existsSync(page), true, page);
    }
  });

  it("opens missions with a need, not a name", () => {
    const mission = CHEF_ACTION_CARDS.find((card) => card.id === "mission");
    assert.ok(mission?.missionOpener);
    assert.deepEqual(nextChefStep([mission.missionOpener]), {
      kind: "persona",
      need: mission.missionOpener,
    });
  });
});
