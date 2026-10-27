// components/computer/connector-disconnect-modal.tsx
"use client";

import { XIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ProviderSummary } from "@/lib/connectors";
import { ConnectorLogo } from "./connector-logo";

type ApiProvider = ProviderSummary & { connected: boolean };

export function ConnectorDisconnectModal({
  provider,
  onCancel,
  onConfirm,
  loading,
}: {
  provider: ApiProvider;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  const t = useTranslations();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, loading]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={() => {
        if (!loading) onCancel();
      }}
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
          className="absolute top-5 right-5 flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-muted-foreground disabled:opacity-40"
          disabled={loading}
          onClick={onCancel}
          type="button"
        >
          <XIcon className="size-3.5" strokeWidth={1.8} />
        </button>

        <div className="mb-6 pr-8">
          <div className="mb-4">
            <ConnectorLogo
              className="size-5"
              color={provider.color}
              icon={provider.icon}
              name={provider.displayName}
            />
          </div>
          <h2 className="text-[15px] font-medium tracking-tight text-foreground">
            {t("connectors.disconnect.title", {
              provider: provider.displayName,
            })}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/80">
            {t("connectors.disconnect.description", {
              provider: provider.displayName,
            })}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            {t("connectors.disconnect.cancel")}
          </button>
          <button
            className="rounded-lg bg-destructive/10 px-5 py-2 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-40"
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading
              ? t("connectors.disconnect.loading")
              : t("connectors.disconnect.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
