// components/workspace/onboarding-form.tsx
"use client";

import { Building2Icon, RocketIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Intent = "solo" | "startup" | "enterprise";

const INTENT_ICONS = {
  solo: UserIcon,
  startup: RocketIcon,
  enterprise: Building2Icon,
} as const;

const INTENTS: Intent[] = ["solo", "startup", "enterprise"];

export function OnboardingForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const t = useTranslations("onboarding");
  const tErr = useTranslations("auth.errors");
  const { update } = useSession();

  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (!intent) {
      setError(t("intentRequired"));
      return;
    }
    if (!terms) {
      setError(t("termsRequired"));
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          title: title.trim(),
          company: company.trim(),
          intent,
          terms,
        }),
      });
      if (!res.ok) {
        setError(tErr("network_error"));
        return;
      }
      const data = (await res.json()) as { chatId?: string | null };
      await update({ onboarded: true });
      // Atterrit sur le chat du Chef (repli : accueil du workspace).
      window.location.href =
        data.chatId && typeof data.chatId === "string"
          ? `/workspace/${data.chatId}`
          : "/workspace";
    } catch {
      setError(tErr("network_error"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="text-center">
        <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {t("subtitle")}
        </p>
        {email && (
          <p className="mt-1 text-[12px] text-muted-foreground/70">{email}</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-foreground">
            {t("nameLabel")}
          </span>
          <Input
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            value={name}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-foreground">
              {t("titleLabel")}
            </span>
            <Input
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              value={title}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-foreground">
              {t("companyLabel")}
            </span>
            <Input
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t("companyPlaceholder")}
              value={company}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-medium text-foreground">
          {t("intentLabel")}
        </span>
        {INTENTS.map((id) => {
          const Icon = INTENT_ICONS[id];
          const selected = intent === id;
          return (
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                selected
                  ? "border-indigo-600 bg-indigo-600/5"
                  : "border-border hover:border-foreground/30"
              )}
              key={id}
              onClick={() => setIntent(id)}
              type="button"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  selected
                    ? "bg-indigo-600 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-foreground">
                  {t(`${id}Title`)}
                </span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {t(`${id}Desc`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <input
          checked={terms}
          className="mt-0.5 size-4 shrink-0 accent-indigo-600"
          onChange={(e) => setTerms(e.target.checked)}
          type="checkbox"
        />
        <span>
          {t("termsPrefix")}
          <Link className="underline hover:text-foreground" href="/terms">
            {t("termsLink")}
          </Link>
          {t("termsAnd")}
          <Link className="underline hover:text-foreground" href="/privacy">
            {t("privacyLink")}
          </Link>
        </span>
      </label>

      <Button disabled={isBusy} onClick={submit} type="button" variant="brand">
        {t("submit")}
      </Button>
    </div>
  );
}
