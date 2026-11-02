// lib/employees/catalog.test.ts
// Contrat du catalogue employes (types web + helpers purs).
// Execution : node --test lib/employees/catalog.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEPARTMENTS,
  asConsumptionProfile,
  asOptionalStringList,
  asRichText,
  asStringList,
  asToolDetails,
  countByStatus,
  filterTalents,
  formatTalentProfile,
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

  it("coerces tool details", () => {
    assert.deepEqual(
      asToolDetails([{ name: "read_file", description: "Read" }]),
      [{ name: "read_file", description: "Read" }]
    );
    assert.deepEqual(asToolDetails([{ name: "x" }]), []);
    assert.deepEqual(asToolDetails("nope"), []);
  });

  it("coerces rich text (prose or list)", () => {
    assert.equal(asRichText("prose"), "prose");
    assert.deepEqual(asRichText(["a", "b"]), ["a", "b"]);
    assert.equal(asRichText("  "), null);
    assert.equal(asRichText([]), null);
    assert.equal(asRichText(null), null);
  });

  it("coerces optional string lists", () => {
    assert.equal(asOptionalStringList(null), undefined);
    assert.equal(asOptionalStringList(undefined), undefined);
    assert.equal(asOptionalStringList([]), undefined);
    assert.deepEqual(asOptionalStringList(["a", 1]), ["a"]);
  });

  it("coerces consumption profiles (valid shape or absent)", () => {
    const good = {
      estimatedTokensPerMission: 5000,
      estimatedCpuSecondsPerMission: 30,
      minMemoryMb: 512,
      minDiskMb: 100,
      networkRequired: false,
    };
    assert.deepEqual(asConsumptionProfile(good), good);
    assert.equal(asConsumptionProfile(null), null);
    assert.equal(asConsumptionProfile(undefined), null);
    assert.equal(asConsumptionProfile("cheap"), null);
    assert.equal(asConsumptionProfile([]), null);
    assert.equal(
      asConsumptionProfile({ ...good, estimatedTokensPerMission: -1 }),
      null
    );
    assert.equal(
      asConsumptionProfile({ ...good, networkRequired: "yes" }),
      null
    );
    const { minDiskMb: _dropped, ...missing } = good;
    assert.equal(asConsumptionProfile(missing), null);
  });

  it("formats a rich talent row", () => {
    const formatted = formatTalentProfile(
      {
        spec: "atlas-software-engineer",
        version: "1.0.0",
        name: "Atlas",
        role: "Software Engineer",
        departmentId: "engineering",
        background: "Builds.",
        allowedTools: ["read_file"],
        technologies: ["Python"],
        tools: [{ name: "read_file", description: "Read." }],
        overview: "Intro.",
        responsibilities: ["Ship."],
        capabilities: ["Coding"],
        executionEnvironment: "A lab.",
        boundaries: ["No prod."],
        deliverables: ["Code."],
        verification: "Done.",
        consumptionProfile: {
          estimatedTokensPerMission: 5000,
          estimatedCpuSecondsPerMission: 30,
          minMemoryMb: 512,
          minDiskMb: 100,
          networkRequired: false,
        },
        createdBy: "Cofoundator",
      },
      true
    );
    assert.equal(formatted.overview, "Intro.");
    assert.deepEqual(formatted.consumption, {
      estimatedTokensPerMission: 5000,
      estimatedCpuSecondsPerMission: 30,
      minMemoryMb: 512,
      minDiskMb: 100,
      networkRequired: false,
    });
    assert.deepEqual(formatted.tools, ["read_file"]);
    assert.deepEqual(formatted.toolDetails, [
      { name: "read_file", description: "Read." },
    ]);
    assert.equal(formatted.hired, true);
  });

  it("formats a bare talent row with fallbacks", () => {
    const formatted = formatTalentProfile(
      {
        spec: "x",
        version: "1.0.0",
        name: "X",
        role: "R",
        departmentId: "engineering",
        background: "Builds.",
        allowedTools: ["read_file", "write_file"],
        technologies: ["SQL"],
        tools: null,
        overview: null,
        responsibilities: null,
        capabilities: null,
        executionEnvironment: null,
        boundaries: null,
        deliverables: null,
        verification: null,
        createdBy: "Cofoundator",
      },
      false
    );
    assert.equal(formatted.overview, undefined);
    assert.deepEqual(formatted.tools, ["read_file", "write_file"]);
    assert.equal(formatted.toolDetails, undefined);
    assert.equal(formatted.hired, false);
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
