// lib/chef/onboarding.test.ts
// Contrat du parcours d'accueil du Chef (moteur pur).
// Execution : node --test lib/chef/onboarding.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildNameReply,
  buildRecruitGuideReply,
  CHEF_GREETING,
  decideChefMode,
  extractDisplayName,
  hasChefGreetingMarker,
  isAffirmative,
  nextChefStep,
  userTextsFromMessages,
} from "./onboarding.ts";

describe("chef onboarding", () => {
  it("locks the exact greeting script", () => {
    assert.equal(
      CHEF_GREETING,
      "Bonjour, je suis votre Manager. Je vais vous aider à constituer votre équipe. Comment puis-je vous appeler ?"
    );
  });

  it("extracts a display name (FR + EN)", () => {
    assert.equal(extractDisplayName("Phal"), "Phal");
    assert.equal(extractDisplayName("  claire  "), "Claire");
    assert.equal(extractDisplayName("Je m'appelle Phal"), "Phal");
    assert.equal(extractDisplayName("je suis Marie !"), "Marie");
    assert.equal(extractDisplayName("Moi c'est paul"), "Paul");
    assert.equal(extractDisplayName("My name is Bob"), "Bob");
    assert.equal(extractDisplayName("Call me Zoe, please"), "Zoe");
    assert.equal(extractDisplayName("Bonjour Phal"), "Phal");
    assert.equal(extractDisplayName("Marie Curie"), "Marie");
    assert.equal(extractDisplayName("!!!"), "");
    assert.equal(extractDisplayName(""), "");
  });

  it("builds the exact project question after the name", () => {
    assert.equal(
      buildNameReply("Phal"),
      "Enchanté Phal. Pour commencer, dites-moi : quel est votre premier projet ou besoin ?\n\nAvez-vous déjà une idée du type de spécialiste qu'il vous faut, ou voulez-vous que je vous guide ?"
    );
    assert.match(buildNameReply(""), /^Enchanté ! Pour commencer/);
  });

  it("guides to the recruit page", () => {
    assert.match(
      buildRecruitGuideReply(),
      /\[page de recrutement\]\(\/employees\/recruit\)/
    );
  });

  it("detects affirmative answers (FR + EN)", () => {
    for (const yes of [
      "Oui",
      "oui, je veux bien !",
      "Yes",
      "OK",
      "Vas-y",
      "D'accord",
      "Volontiers",
      "Avec plaisir",
      "Pourquoi pas",
    ]) {
      assert.equal(isAffirmative(yes), true, yes);
    }
    for (const no of [
      "Non",
      "non merci",
      "pas encore",
      "No",
      "oui, non, je ne sais pas",
      "Louis",
      "un nouveau projet",
    ]) {
      assert.equal(isAffirmative(no), false, no);
    }
  });

  it("walks the full welcome journey", () => {
    assert.deepEqual(nextChefStep([]), {
      kind: "greeting",
      text: CHEF_GREETING,
    });

    const nameStep = nextChefStep(["Phal"]);
    assert.equal(nameStep.kind, "scripted");
    assert.match(nameStep.text, /Enchanté Phal/);

    assert.deepEqual(nextChefStep(["Phal", "Je veux une application"]), {
      kind: "persona",
      need: "Je veux une application",
    });

    const yesStep = nextChefStep(["Phal", "Je veux une application", "Oui !"]);
    assert.equal(yesStep.kind, "scripted");
    assert.match(yesStep.text, /\/employees\/recruit/);

    assert.deepEqual(
      nextChefStep(["Phal", "Je veux une application", "Pas encore"]),
      { kind: "persona", need: null }
    );
    assert.deepEqual(nextChefStep(["a", "b", "c", "d"]), {
      kind: "persona",
      need: null,
    });
  });

  it("routes chef-only chats to the Chef, script only when marked", () => {
    assert.equal(
      decideChefMode({ marked: true, chefOnly: false, userTexts: ["Hi"] }),
      null
    );
    assert.deepEqual(
      decideChefMode({ marked: false, chefOnly: true, userTexts: ["Hi"] }),
      { kind: "persona", need: null }
    );
    const marked = decideChefMode({
      marked: true,
      chefOnly: true,
      userTexts: ["Phal"],
    });
    assert.equal(marked?.kind, "scripted");
  });

  it("treats a long first message as the need, not the name", () => {
    assert.deepEqual(nextChefStep(["I want to start a mission."]), {
      kind: "persona",
      need: "I want to start a mission.",
    });
    assert.deepEqual(nextChefStep(["Je veux une application mobile"]), {
      kind: "persona",
      need: "Je veux une application mobile",
    });
    const explicit = nextChefStep(["Je m'appelle Jean Paul Sartre"]);
    assert.equal(explicit.kind, "scripted");
    assert.match(explicit.text, /Enchanté Jean/);
    const polite = nextChefStep(["Bonjour Phal"]);
    assert.equal(polite.kind, "scripted");
    assert.match(polite.text, /Enchanté Phal/);
  });

  it("handles Chinese names and needs (no spaces)", () => {
    assert.equal(extractDisplayName("王芳"), "王芳");
    const name = nextChefStep(["王芳"]);
    assert.equal(name.kind, "scripted");
    assert.match(name.text, /Enchanté 王芳/);
    const explicit = nextChefStep(["我叫王芳"]);
    assert.equal(explicit.kind, "scripted");
    assert.match(explicit.text, /王芳/);
    assert.deepEqual(nextChefStep(["我想启动一个任务。"]), {
      kind: "persona",
      need: "我想启动一个任务。",
    });
  });

  it("maps messages to user texts without shifting steps", () => {
    const texts = userTextsFromMessages([
      { role: "assistant", parts: [{ type: "text", text: CHEF_GREETING }] },
      { role: "user", parts: [{ type: "text", text: "Phal" }] },
      { role: "user", parts: [{ type: "file" }] },
    ]);
    assert.deepEqual(texts, ["Phal", ""]);
  });

  it("marks only the seeded welcome chat", () => {
    const marked = [
      { role: "user", parts: [] },
      { role: "assistant", parts: [{ type: "text", text: CHEF_GREETING }] },
    ];
    assert.equal(hasChefGreetingMarker(marked), true);
    assert.equal(
      hasChefGreetingMarker([
        {
          role: "assistant",
          parts: [{ type: "text", text: `${CHEF_GREETING} !` }],
        },
      ]),
      false
    );
    assert.equal(
      hasChefGreetingMarker([{ role: "user", parts: [] }]),
      false
    );
    assert.equal(hasChefGreetingMarker([]), false);
  });
});
