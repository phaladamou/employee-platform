// lib/employees/catalog.test.ts
// Contrat du catalogue employes (types web + helpers purs).
// Execution : node --test lib/employees/catalog.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEPARTMENTS,
  asStringList,
  countByStatus,
  filterTalents,
  getEmployeesByDepartment,
  isEmployeeKind,
  isEmployeeStatus,
  isKnownDepartment,
  isMissionStatus,
  type Employee,
  type TalentProfile,
} from "./catalog.ts";

const TEAM: Employee[] = [
  {
    id: "emp-chef",
    name: "Chef",
    role: "Manager",
    status: "idle",
    departmentId: "operations",
    kind: "hired",
  },
  {
    id: "emp-atlas",
    name: "Atlas",
    role: "Software Engineer",
    status: "working",
    departmentId: "engineering",
    currentTask: "Shipping the API",
    kind: "hired",
  },
  {
    id: "emp-nova",
    name: "Nova",
    role: "DevOps Engineer",
    status: "idle",
    departmentId: "engineering",
    kind: "hired",
  },
];

const TALENTS: TalentProfile[] = [
  {
    spec: "atlas-software-engineer",
    version: "1.0.0",
    name: "Atlas",
    role: "Software Engineer",
    departmentId: "engineering",
    background: "Writes production-ready code.",
    technologies: ["Python", "pytest"],
    tools: ["read_file", "write_file", "run_shell"],
    createdBy: "Cofoundator",
  },
  {
    spec: "aria-data-analyst",
    version: "1.0.0",
    name: "Aria",
    role: "Data Analyst",
    departmentId: "research-data",
    background: "Extracts insights from datasets.",
    technologies: ["SQL", "Reporting"],
    tools: ["read_file", "write_file"],
    createdBy: "Cofoundator",
  },
];

describe("employee catalog", () => {
  it("exposes the three departments", () => {
    assert.deepEqual(
      DEPARTMENTS.map((d) => d.id),
      ["engineering", "research-data", "operations"]
    );
  });

  it("recognizes known departments only", () => {
    assert.equal(isKnownDepartment("engineering"), true);
    assert.equal(isKnownDepartment("research-data"), true);
    assert.equal(isKnownDepartment("marketing"), false);
    assert.equal(isKnownDepartment("unknown"), false);
  });

  it("groups employees by department", () => {
    const engineering = getEmployeesByDepartment(TEAM, "engineering");
    assert.equal(engineering.length, 2);
    assert.ok(engineering.every((e) => e.departmentId === "engineering"));
    assert.deepEqual(getEmployeesByDepartment(TEAM, "unknown"), []);
  });

  it("counts employees by status", () => {
    assert.deepEqual(countByStatus(TEAM), {
      idle: 2,
      working: 1,
      completed: 0,
    });
    assert.deepEqual(countByStatus([]), { idle: 0, working: 0, completed: 0 });
  });

  it("guards statuses and kinds read from the database", () => {
    assert.equal(isEmployeeStatus("working"), true);
    assert.equal(isEmployeeStatus("bogus"), false);
    assert.equal(isEmployeeKind("chef"), true);
    assert.equal(isEmployeeKind("hired"), true);
    assert.equal(isEmployeeKind("admin"), false);
    assert.equal(isMissionStatus("needs_review"), true);
    assert.equal(isMissionStatus("done"), false);
  });

  it("coerces json columns to string lists", () => {
    assert.deepEqual(asStringList(["a", "b"]), ["a", "b"]);
    assert.deepEqual(asStringList(["a", 1, null]), ["a"]);
    assert.deepEqual(asStringList(null), []);
    assert.deepEqual(asStringList("nope"), []);
  });

  it("filters talents by department", () => {
    assert.equal(filterTalents(TALENTS, "", "all").length, 2);
    const engineering = filterTalents(TALENTS, "", "engineering");
    assert.deepEqual(
      engineering.map((t) => t.spec),
      ["atlas-software-engineer"]
    );
    assert.deepEqual(filterTalents(TALENTS, "", "operations"), []);
  });

  it("filters talents by full-text query (every token must match)", () => {
    assert.deepEqual(
      filterTalents(TALENTS, "atlas python", "all").map((t) => t.spec),
      ["atlas-software-engineer"]
    );
    assert.deepEqual(
      filterTalents(TALENTS, "  ARIA sql  ", "all").map((t) => t.spec),
      ["aria-data-analyst"]
    );
    assert.deepEqual(filterTalents(TALENTS, "atlas sql", "all"), []);
    // La recherche respecte aussi le filtre departement.
    assert.deepEqual(filterTalents(TALENTS, "aria", "engineering"), []);
  });
});
