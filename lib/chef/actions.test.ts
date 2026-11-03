// lib/chef/actions.test.ts
// Contrat des 3 cartes d'action du Chef (structure, cles i18n
// presentes dans les 3 locales, liens vers des routes existantes,
// ouvreurs compris par le moteur).
// Execution : node --test lib/chef/actions.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CHEF_ACTION_CARDS } from "./actions.ts";
import { nextChefStep } from "./onboarding.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const APP_DIR = join(ROOT, "app", "(chat)");
const LOCALES = ["en", "fr", "zh"] as const;

function chatMessages(locale: string): Record<string, string> {
  const raw = readFileSync(join(ROOT, "messages", `${locale}.json`), "utf8");
  return (JSON.parse(raw) as { chat: Record<string, string> }).chat;
}

describe("chef action cards", () => {
  it("locks the card structure", () => {
    assert.deepEqual(
      CHEF_ACTION_CARDS.map((card) => [card.id, card.href]),
      [
        ["recruit", "/employees/recruit"],
        ["mission", null],
        ["team", "/employees"],
      ]
    );
  });

  it("resolves every key in every locale", () => {
    for (const locale of LOCALES) {
      const messages = chatMessages(locale);
      for (const card of CHEF_ACTION_CARDS) {
        for (const key of [
          card.titleKey,
          card.descriptionKey,
          ...(card.openerKey ? [card.openerKey] : []),
        ]) {
          assert.equal(typeof messages[key], "string", `${locale}.${key}`);
          assert.ok(messages[key].trim().length > 0, `${locale}.${key}`);
        }
      }
    }
  });

  it("translates the chef intro in every locale", () => {
    for (const locale of LOCALES) {
      const messages = chatMessages(locale);
      for (const key of [
        "chefHelloNamed",
        "chefHello",
        "chefIntro1",
        "chefIntro2",
        "chefIntro3",
        "chefIntro4",
      ]) {
        assert.equal(typeof messages[key], "string", `${locale}.${key}`);
        assert.ok(messages[key].trim().length > 0, `${locale}.${key}`);
      }
      assert.match(messages.chefHelloNamed, /\{name\}/, locale);
    }
  });

  it("locks the manager placeholder in every locale", () => {
    assert.equal(
      chatMessages("en").askAnything,
      "Tell your Manager what you want to accomplish..."
    );
    assert.equal(
      chatMessages("fr").askAnything,
      "Dites à votre Manager ce que vous voulez accomplir..."
    );
    assert.equal(
      chatMessages("zh").askAnything,
      "告诉您的经理您想要完成什么..."
    );
    for (const locale of LOCALES) {
      assert.equal(
        chatMessages(locale).placeholder,
        chatMessages(locale).askAnything,
        locale
      );
    }
  });

  it("translates the right panel in every locale", () => {
    for (const locale of LOCALES) {
      const messages = chatMessages(locale);
      for (const key of [
        "panelTitle",
        "panelMembers",
        "panelInProgress",
        "panelReports",
        "panelViewAll",
        "panelEmptyTeam",
        "panelRecruitCta",
        "panelEmptyMissions",
        "panelEmptyReports",
      ]) {
        assert.equal(typeof messages[key], "string", `${locale}.${key}`);
        assert.ok(messages[key].trim().length > 0, `${locale}.${key}`);
      }
    }
  });

  it("links to existing routes", () => {
    for (const card of CHEF_ACTION_CARDS) {
      if (!card.href) continue;
      const page = join(APP_DIR, card.href, "page.tsx");
      assert.equal(existsSync(page), true, page);
    }
  });

  it("opens missions with a need, not a name, in every locale", () => {
    const mission = CHEF_ACTION_CARDS.find((card) => card.id === "mission");
    assert.ok(mission?.openerKey);
    for (const locale of LOCALES) {
      const opener = chatMessages(locale)[mission.openerKey];
      assert.deepEqual(nextChefStep([opener]), {
        kind: "persona",
        need: opener,
      });
    }
  });
});
