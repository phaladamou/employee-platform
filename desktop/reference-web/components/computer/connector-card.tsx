// components/computer/connector-card.tsx
"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import type { ProviderSummary } from "@/lib/connectors";
import { ConnectorConsentModal } from "./connector-consent-modal";
import { ConnectorDisconnectModal } from "./connector-disconnect-modal";
import { ConnectorLogo } from "./connector-logo";

type ApiProvider = ProviderSummary & { connected: boolean };

export function ConnectorCard({ provider }: { provider: ApiProvider }) {
  const { mutate } = useSWRConfig();
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/connectors/${provider.id}/disconnect`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Disconnect failed");
      toast.success(
        t("connectors.toast.disconnected", {
          provider: provider.displayName,
        })
      );
      setShowDisconnect(false);
      await mutate("/api/connectors");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("connectors.toast.error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    setShowConsent(false);

    if (!provider.configured) {
      toast.error(
        t("connectors.toast.notConfigured", {
          provider: provider.displayName,
        })
      );
      return;
    }

    // Ouvre la popup OAuth
    const width = 600;
    const height = 720;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `/api/connectors/${provider.id}/connect`,
      `oauth_${provider.id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      toast.error(
        "Popup blocked. Please allow popups for this site and try again."
      );
      return;
    }
  };

  return (
    <>
      <button
        className="group relative flex w-full items-center gap-4 rounded-xl border border-border/40 bg-card p-4 text-left transition-all duration-200 hover:border-border hover:bg-muted/20"
        onClick={() => {
          if (provider.connected) {
            setShowDisconnect(true);
          } else {
            setShowConsent(true);
          }
        }}
        type="button"
      >
        <ConnectorLogo
          color={provider.color}
          icon={provider.icon}
          name={provider.displayName}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-[13px] font-medium tracking-tight text-foreground">
            {provider.displayName}
          </h3>
          <p className="truncate text-[11.5px] leading-relaxed text-muted-foreground/80">
            {t(provider.descriptionKey)}
          </p>
        </div>

        <div className="flex size-6 shrink-0 items-center justify-center">
          {provider.connected ? (
            <CheckIcon
              className="size-4 text-emerald-500/90"
              strokeWidth={2.2}
            />
          ) : (
            <PlusIcon
              className="size-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/80"
              strokeWidth={2}
            />
          )}
        </div>
      </button>

      {showConsent && (
        <ConnectorConsentModal
          onCancel={() => setShowConsent(false)}
          onContinue={handleContinue}
          provider={provider}
        />
      )}

      {showDisconnect && (
        <ConnectorDisconnectModal
          loading={loading}
          onCancel={() => setShowDisconnect(false)}
          onConfirm={handleDisconnect}
          provider={provider}
        />
      )}
    </>
  );
}
