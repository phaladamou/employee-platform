// lib/employees/catalog.test.ts
// Contrat du catalogue employes.
// Execution : node --test lib/employees/catalog.test.ts
// (runner natif Node >= 22.18, zero dependance).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AVAILABLE_AGENTS,
  DEPARTMENTS,
  EMPLOYEES,
  countByStatus,
  filterAgents,
  getEmployeesByDepartment,
  isEmployeeStatus,
  recruitEmployee,
} from "./catalog.ts";

describe("employee catalog", () => {
  it("exposes the three departments", () => {
    assert.deepEqual(
      DEPARTMENTS.map((d) => d.id),
      ["engineering", "marketing", "research"]
    );
  });

  it("every seed employee belongs to a known department", () => {
    const ids = new Set(DEPARTMENTS.map((d) => d.id));
    for (const employee of EMPLOYEES) {
      assert.ok(ids.has(employee.departmentId), employee.id);
    }
  });

  it("groups employees by department", () => {
    const engineering = getEmployeesByDepartment(EMPLOYEES, "engineering");
    assert.equal(engineering.length, 3);
    assert.ok(engineering.every((e) => e.departmentId === "engineering"));
    assert.deepEqual(getEmployeesByDepartment(EMPLOYEES, "unknown"), []);
  });

  it("counts employees by status", () => {
    assert.deepEqual(countByStatus(EMPLOYEES), {
      idle: 2,
      working: 4,
      completed: 1,
    });
    assert.deepEqual(countByStatus([]), { idle: 0, working: 0, completed: 0 });
  });

  it("recruits an agent without mutating the input list", () => {
    const before = [...EMPLOYEES];
    const agent = AVAILABLE_AGENTS[0];
    const next = recruitEmployee(EMPLOYEES, agent, "engineering", "emp-kai");

    assert.deepEqual(EMPLOYEES, before);
    assert.equal(next.length, EMPLOYEES.length + 1);
    assert.deepEqual(next[next.length - 1], {
      id: "emp-kai",
      name: agent.name,
      role: agent.role,
      status: "idle",
      departmentId: "engineering",
    });
  });

  it("recruiting into an unknown department throws", () => {
    assert.throws(() =>
      recruitEmployee(EMPLOYEES, AVAILABLE_AGENTS[0], "unknown", "emp-x")
    );
  });

  it("validates employee statuses", () => {
    assert.equal(isEmployeeStatus("idle"), true);
    assert.equal(isEmployeeStatus("working"), true);
    assert.equal(isEmployeeStatus("completed"), true);
    assert.equal(isEmployeeStatus("flying"), false);
    assert.equal(isEmployeeStatus(null), false);
    assert.equal(isEmployeeStatus(undefined), false);
  });

  it("every listed agent has directory metadata", () => {
    assert.ok(AVAILABLE_AGENTS.length >= 8);
    for (const agent of AVAILABLE_AGENTS) {
      assert.ok(agent.category);
      assert.ok(agent.rating >= 0 && agent.rating <= 5);
      assert.ok(agent.reviewsCount > 0);
      assert.ok(agent.experience.length > 0);
      assert.ok(agent.reviews.length > 0);
      assert.ok(agent.capabilities.length > 0);
    }
  });

  it("filters agents by category", () => {
    const dev = filterAgents(AVAILABLE_AGENTS, "", "development");
    assert.equal(dev.length, 2);
    assert.ok(dev.every((a) => a.category === "development"));
    assert.equal(
      filterAgents(AVAILABLE_AGENTS, "", "all").length,
      AVAILABLE_AGENTS.length
    );
  });

  it("searches agents by name, role and capability", () => {
    assert.deepEqual(
      filterAgents(AVAILABLE_AGENTS, "mira", "all").map((a) => a.id),
      ["agent-researcher"]
    );
    assert.deepEqual(
      filterAgents(AVAILABLE_AGENTS, "dAtA eNgInEeR", "all").map((a) => a.id),
      ["agent-dataeng"]
    );
    assert.deepEqual(
      filterAgents(AVAILABLE_AGENTS, "docker", "all").map((a) => a.id),
      ["agent-devops"]
    );
    assert.deepEqual(filterAgents(AVAILABLE_AGENTS, "plumber", "all"), []);
  });

  it("combines search and category", () => {
    assert.deepEqual(
      filterAgents(AVAILABLE_AGENTS, "data", "design"),
      []
    );
    assert.equal(filterAgents(AVAILABLE_AGENTS, "data", "data").length, 2);
  });
});
