// lib/billing/billing.ts
// Socle facturation : plans tarifaires + store SIMULE (demo jury).
// Module unique sans import relatif de valeur (testable via
// node --test) ; les libelles passent par i18n, jamais en dur.
// Le store persiste plan + historique en localStorage via un
// adaptateur injecte : aucun appel reseau, aucun vrai paiement.
export type PlanId = "starter" | "pro" | "enterprise";

export interface BillingPlan {
  id: PlanId;
  nameKey: string;
  priceUSD: number;
  seats: number;
  featureKeys: readonly [string, string];
  popular?: boolean;
}

export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    id: "starter",
    nameKey: "planStarter",
    priceUSD: 0,
    seats: 1,
    featureKeys: ["feat1Employee", "featUnlimitedMissions"],
  },
  {
    id: "pro",
    nameKey: "planPro",
    priceUSD: 49,
    seats: 5,
    featureKeys: ["feat5Employees", "featPriorityMissions"],
    popular: true,
  },
  {
    id: "enterprise",
    nameKey: "planEnterprise",
    priceUSD: 199,
    seats: 20,
    featureKeys: ["feat20Employees", "featDedicatedSupport"],
  },
];

export function parsePlanId(value: unknown): PlanId | null {
  if (value === "starter" || value === "pro" || value === "enterprise") {
    return value;
  }
  return null;
}

export function getBillingPlan(id: PlanId): BillingPlan {
  return BILLING_PLANS.find((plan) => plan.id === id) ?? BILLING_PLANS[0];
}

export interface BillingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PaymentRecord {
  id: string;
  dateISO: string;
  planId: PlanId;
  amountUSD: number;
}

const PLAN_KEY = "emp.billing.plan.v1";
const HISTORY_KEY = "emp.billing.history.v1";

function safeGet(store: BillingStorage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function isPaymentRecord(value: unknown): value is PaymentRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.dateISO === "string" &&
    parsePlanId(record.planId) !== null &&
    typeof record.amountUSD === "number" &&
    Number.isFinite(record.amountUSD)
  );
}

export function loadCurrentPlan(store: BillingStorage): PlanId {
  return parsePlanId(safeGet(store, PLAN_KEY)) ?? "starter";
}

export function saveCurrentPlan(
  store: BillingStorage,
  planId: PlanId
): void {
  store.setItem(PLAN_KEY, planId);
}

export function loadPaymentHistory(
  store: BillingStorage
): PaymentRecord[] {
  try {
    const raw = store.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.filter(isPaymentRecord);
  } catch {
    return [];
  }
}

export function recordPayment(
  store: BillingStorage,
  input: { planId: PlanId; amountUSD: number; dateISO?: string }
): PaymentRecord {
  const record: PaymentRecord = {
    id: `pay_${Date.now().toString(36)}`,
    dateISO: input.dateISO ?? new Date().toISOString(),
    planId: input.planId,
    amountUSD: input.amountUSD,
  };
  const history = loadPaymentHistory(store);
  store.setItem(HISTORY_KEY, JSON.stringify([record, ...history]));
  return record;
}
