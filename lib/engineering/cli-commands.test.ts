// lib/engineering/cli-commands.test.ts
// Contrat du parseur mini-CLI (FR + EN).
// Execution : node --test lib/engineering/cli-commands.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseCliCommand } from "./cli-commands.ts";

describe("parseCliCommand", () => {
  it("parse recruit FR/EN", () => {
    assert.deepEqual(parseCliCommand("recruit atlas-software-engineer"), {
      kind: "recruit",
      talentSpec: "atlas-software-engineer",
    });
    assert.deepEqual(parseCliCommand("recruter nova-devops-engineer"), {
      kind: "recruit",
      talentSpec: "nova-devops-engineer",
    });
  });

  it("parse submit avec prompt quote", () => {
    assert.deepEqual(
      parseCliCommand('submit emp_1 "corrige le bug login"'),
      {
        kind: "submit",
        employeeId: "emp_1",
        prompt: "corrige le bug login",
      }
    );
    assert.deepEqual(parseCliCommand("soumettre emp_2 audit churn"), {
      kind: "submit",
      employeeId: "emp_2",
      prompt: "audit churn",
    });
  });

  it("reconnait help, employees, missions, clear, vide", () => {
    assert.deepEqual(parseCliCommand(""), { kind: "empty" });
    assert.deepEqual(parseCliCommand("help"), { kind: "help" });
    assert.deepEqual(parseCliCommand("employees"), { kind: "employees" });
    assert.deepEqual(parseCliCommand("missions"), { kind: "missions" });
    assert.deepEqual(parseCliCommand("clear"), { kind: "clear" });
  });

  it("classe l'inconnu et l'incomplet en unknown", () => {
    assert.equal(parseCliCommand("foobar").kind, "unknown");
    assert.equal(parseCliCommand("recruit").kind, "unknown");
    assert.equal(parseCliCommand("submit emp_1").kind, "unknown");
  });
});
