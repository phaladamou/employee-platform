// components/billing/billing-view.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  getBillingPlan,
  loadCurrentPlan,
  loadPaymentHistory,
  type PaymentRecord,
  type PlanId,
} from "@/lib/billing/billing";
import { TestModeBadge } from "./test-mode-badge";

export function BillingView() {
  const t = useTranslations("billing");
  const locale = useLocale();
  const router = useRouter();
  const [planId, setPlanId] = useState<PlanId>("starter");
  const [history, setHistory] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    setPlanId(loadCurrentPlan(window.localStorage));
    setHistory(loadPaymentHistory(window.localStorage));
  }, []);

  const plan = getBillingPlan(planId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[20px] font-medium tracking-tight text-foreground">
          {t("billingTitle")}
        </h1>
        <TestModeBadge />
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-[12px] text-muted-foreground">{t("currentPlan")}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[20px] font-medium text-foreground">
            {t(plan.nameKey)}{" "}
            <span className="text-[14px] font-normal text-muted-foreground">
              {plan.priceUSD}$
              {t("perMonth")}
            </span>
          </p>
          <Button
            onClick={() => router.push("/pricing")}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("manageSubscription")}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-[14px] font-medium text-foreground">
          {t("historyTitle")}
        </p>
        {history.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            {t("historyEmpty")}
          </p>
        ) : (
          <div className="mt-3 flex flex-col">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 border-b border-border/60 pb-2 text-[11px] font-medium text-muted-foreground">
              <span>{t("colDate")}</span>
              <span>{t("colDescription")}</span>
              <span className="text-right">{t("colAmount")}</span>
              <span className="text-right">{t("colStatus")}</span>
            </div>
            {history.map((record) => (
              <div
                className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 border-b border-border/40 py-2.5 text-[13px] last:border-0"
                key={record.id}
              >
                <span className="text-muted-foreground">
                  {new Date(record.dateISO).toLocaleDateString(locale)}
                </span>
                <span className="truncate text-foreground">
                  {t(getBillingPlan(record.planId).nameKey)}
                </span>
                <span className="text-right text-foreground">
                  {record.amountUSD}$
                </span>
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-right text-[11px] font-medium text-green-700 dark:text-green-400">
                  {t("paidBadge")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
