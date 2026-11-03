// lib/billing/billing.test.ts
// Contrat des plans + du store de facturation simulee.
// Execution : node --test lib/billing/billing.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { BillingStorage } from "./billing.ts";
import {
  BILLING_PLANS,
  getBillingPlan,
  loadCurrentPlan,
  loadPaymentHistory,
  parsePlanId,
  recordPayment,
  saveCurrentPlan,
} from "./billing.ts";

function memoryStore(seed: Record<string, string> = {}): BillingStorage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("BILLING_PLANS", () => {
  it("ships starter, pro and enterprise tiers", () => {
    assert.deepEqual(
      BILLING_PLANS.map((plan) => plan.id),
      ["starter", "pro", "enterprise"]
    );
    assert.deepEqual(
      BILLING_PLANS.map((plan) => plan.priceUSD),
      [0, 49, 199]
    );
  });

  it("marks exactly one popular plan", () => {
    assert.deepEqual(
      BILLING_PLANS.filter((plan) => plan.popular === true).map(
        (plan) => plan.id
      ),
      ["pro"]
    );
  });
});

describe("parsePlanId", () => {
  it("accepts known ids and rejects the rest", () => {
    assert.equal(parsePlanId("pro"), "pro");
    assert.equal(parsePlanId("starter"), "starter");
    assert.equal(parsePlanId("enterprise"), "enterprise");
    assert.equal(parsePlanId("gold"), null);
    assert.equal(parsePlanId(null), null);
    assert.equal(parsePlanId(undefined), null);
  });
});

describe("getBillingPlan", () => {
  it("returns the matching plan", () => {
    assert.equal(getBillingPlan("pro").priceUSD, 49);
    assert.equal(getBillingPlan("starter").seats, 1);
  });
});

describe("current plan", () => {
  it("defaults to starter", () => {
    assert.equal(loadCurrentPlan(memoryStore()), "starter");
  });

  it("round-trips a saved plan and rejects garbage", () => {
    const store = memoryStore();
    saveCurrentPlan(store, "pro");
    assert.equal(loadCurrentPlan(store), "pro");
    assert.equal(
      loadCurrentPlan(memoryStore({ "emp.billing.plan.v1": "gold" })),
      "starter"
    );
  });
});

describe("payment history", () => {
  it("starts empty and survives corrupted data", () => {
    assert.deepEqual(loadPaymentHistory(memoryStore()), []);
    assert.deepEqual(
      loadPaymentHistory(
        memoryStore({ "emp.billing.history.v1": "not-json{{" })
      ),
      []
    );
  });

  it("prepends recorded payments", () => {
    const store = memoryStore();
    recordPayment(store, {
      planId: "pro",
      amountUSD: 49,
      dateISO: "2026-01-01T00:00:00.000Z",
    });
    recordPayment(store, {
      planId: "enterprise",
      amountUSD: 199,
      dateISO: "2026-02-01T00:00:00.000Z",
    });
    const history = loadPaymentHistory(store);
    assert.equal(history.length, 2);
    assert.equal(history[0].planId, "enterprise");
    assert.equal(history[1].amountUSD, 49);
  });
});
