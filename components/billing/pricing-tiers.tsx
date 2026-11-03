// components/billing/pricing-tiers.tsx
"use client";

import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BILLING_PLANS } from "@/lib/billing/billing";

export function PricingTiers() {
  const t = useTranslations("billing");
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-[28px] font-medium tracking-tight text-foreground">
          {t("pricingTitle")}
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {t("pricingSubtitle")}
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <div
            className={cn(
              "flex flex-col rounded-xl border bg-card p-6",
              plan.popular === true
                ? "border-foreground/50"
                : "border-border/60"
            )}
            key={plan.id}
          >
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-medium text-foreground">
                {t(plan.nameKey)}
              </p>
              {plan.popular === true && (
                <span className="rounded-full bg-foreground px-2.5 py-0.5 text-[11px] font-medium text-background">
                  {t("popularBadge")}
                </span>
              )}
            </div>
            <p className="mt-3 text-[32px] font-medium tracking-tight text-foreground">
              {plan.priceUSD}$
              <span className="text-[14px] font-normal text-muted-foreground">
                {t("perMonth")}
              </span>
            </p>
            <ul className="mt-5 flex flex-col gap-2.5">
              {plan.featureKeys.map((key) => (
                <li
                  className="flex items-center gap-2 text-[13px] text-muted-foreground"
                  key={key}
                >
                  <CheckIcon className="size-4 shrink-0 text-foreground" />
                  {t(key)}
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 w-full"
              onClick={() => router.push(`/checkout?plan=${plan.id}`)}
              type="button"
              variant={plan.popular === true ? "brand" : "outline"}
            >
              {t("upgrade")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
