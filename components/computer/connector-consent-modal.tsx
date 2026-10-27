// components/computer/connector-consent-modal.tsx
"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ProviderSummary } from "@/lib/connectors";
import { ConnectorLogo } from "./connector-logo";

type ApiProvider = ProviderSummary & { connected: boolean };

export function ConnectorConsentModal({
  provider,
  onCancel,
  onContinue,
}: {
  provider: ApiProvider;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border/50 bg-card p-8 shadow-[var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          aria-label="Close"
          className="absolute top-5 right-5 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
          onClick={onCancel}
          type="button"
        >
          <XIcon className="size-3.5" strokeWidth={1.8} />
        </button>

        <div className="mb-8 pr-8">
          <div className="mb-4">
            <ConnectorLogo
              className="size-5"
              color={provider.color}
              icon={provider.icon}
              name={provider.displayName}
            />
          </div>
          <h2 className="text-[15px] font-medium tracking-tight text-foreground">
            {t("connectors.consent.title", {
              provider: provider.displayName,
            })}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/80">
            {t("connectors.consent.description", {
              provider: provider.displayName,
            })}
          </p>
        </div>

        <div className="mb-8">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/50">
            {t("connectors.consent.permissionsTitle")}
          </p>
          <ul className="flex flex-col gap-3">
            {provider.permissionsKeys.map((key) => (
              <li
                className="flex items-start gap-3 text-[13px] leading-relaxed text-foreground/85"
                key={key}
              >
                <CheckIcon
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50"
                  strokeWidth={2}
                />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            onClick={onCancel}
            type="button"
          >
            {t("connectors.consent.cancel")}
          </button>
          <button
            className="rounded-lg bg-foreground px-5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
            onClick={onContinue}
            type="button"
          >
            {t("connectors.consent.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
