// components/billing/checkout-form.tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  CreditCardIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  getBillingPlan,
  parsePlanId,
  recordPayment,
  saveCurrentPlan,
} from "@/lib/billing/billing";
import { TestModeBadge } from "./test-mode-badge";

function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

const inputClassName =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/40";

const labelClassName =
  "mb-1.5 block text-[12px] font-medium text-foreground";

function CheckoutInner() {
  const t = useTranslations("billing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = getBillingPlan(parsePlanId(searchParams.get("plan")) ?? "pro");

  const [card, setCard] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "done">("idle");
  const [cardError, setCardError] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) {
        clearTimeout(timer);
      }
    };
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "idle") {
      return;
    }
    if (card.replace(/\D/g, "").length !== 16) {
      setCardError(true);
      return;
    }
    setCardError(false);
    setStatus("processing");
    timers.current.push(
      setTimeout(() => {
        // Simulation : plan + historique en local, aucun vrai paiement.
        saveCurrentPlan(window.localStorage, plan.id);
        if (plan.priceUSD > 0) {
          recordPayment(window.localStorage, {
            planId: plan.id,
            amountUSD: plan.priceUSD,
          });
        }
        setStatus("done");
        timers.current.push(
          setTimeout(() => router.push("/billing"), 1500)
        );
      }, 1200)
    );
  };

  if (status === "done") {
    return (
      <div className="flex flex-col items-center rounded-xl border border-border/60 bg-card px-6 py-12 text-center">
        <CheckCircle2Icon className="size-10 text-green-600 dark:text-green-400" />
        <p className="mt-4 text-[16px] font-medium text-foreground">
          {t("paymentSuccessful")}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("redirectingToBilling")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CreditCardIcon className="size-5 text-foreground" />
          <h1 className="text-[16px] font-medium text-foreground">
            {t("checkoutTitle")}
          </h1>
        </div>
        <TestModeBadge />
      </div>

      <div className="mt-4 rounded-lg bg-muted px-4 py-3">
        <p className="text-[11px] text-muted-foreground">{t("orderSummary")}</p>
        <p className="mt-0.5 text-[14px] font-medium text-foreground">
          {t(plan.nameKey)} — {plan.priceUSD}$
          <span className="font-normal text-muted-foreground">
            {t("perMonth")}
          </span>
        </p>
      </div>

      <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
        <div>
          <label className={labelClassName} htmlFor="billing-name">
            {t("fullName")}
          </label>
          <input
            autoComplete="name"
            className={inputClassName}
            disabled={status !== "idle"}
            id="billing-name"
            name="name"
            required
            type="text"
          />
        </div>
        <div>
          <label className={labelClassName} htmlFor="billing-email">
            {t("email")}
          </label>
          <input
            autoComplete="email"
            className={inputClassName}
            disabled={status !== "idle"}
            id="billing-email"
            name="email"
            required
            type="email"
          />
        </div>
        <div>
          <label className={labelClassName} htmlFor="billing-card">
            {t("cardNumber")}
          </label>
          <input
            autoComplete="cc-number"
            className={inputClassName}
            disabled={status !== "idle"}
            id="billing-card"
            inputMode="numeric"
            name="card"
            onChange={(event) => {
              setCard(formatCardNumber(event.target.value));
              setCardError(false);
            }}
            placeholder={t("cardPlaceholder")}
            required
            type="text"
            value={card}
          />
          {cardError && (
            <p className="mt-1.5 text-[12px] text-red-600 dark:text-red-400">
              {t("invalidCard")}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClassName} htmlFor="billing-expiry">
              {t("expiry")}
            </label>
            <input
              autoComplete="cc-exp"
              className={inputClassName}
              disabled={status !== "idle"}
              id="billing-expiry"
              inputMode="numeric"
              name="expiry"
              onChange={(event) =>
                (event.target.value = formatExpiry(event.target.value))
              }
              placeholder={t("expiryPlaceholder")}
              required
              type="text"
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor="billing-cvc">
              {t("cvc")}
            </label>
            <input
              autoComplete="cc-csc"
              className={inputClassName}
              disabled={status !== "idle"}
              id="billing-cvc"
              inputMode="numeric"
              maxLength={4}
              name="cvc"
              onChange={(event) =>
                (event.target.value = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4))
              }
              placeholder={t("cvcPlaceholder")}
              required
              type="text"
            />
          </div>
        </div>

        <Button
          className="mt-1 w-full"
          disabled={status !== "idle"}
          type="submit"
          variant="brand"
        >
          {status === "processing"
            ? t("processing")
            : t("pay", { price: plan.priceUSD })}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
          <ShieldCheckIcon className="size-3.5" />
          {t("secureNote")}
        </p>
      </form>
    </div>
  );
}

export function CheckoutForm() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <Suspense>
        <CheckoutInner />
      </Suspense>
    </div>
  );
}
