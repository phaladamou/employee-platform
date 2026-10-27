// app/(chat)/computer/connectors/callback/page.tsx
"use client";

import { MoveHorizontalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ConnectorLogo } from "@/components/computer/connector-logo";
import type { ProviderSummary } from "@/lib/connectors/core/types";
import { fetcher } from "@/lib/utils";

type ApiProvider = ProviderSummary & { connected: boolean };

export default function CallbackPage() {
  const t = useTranslations("connectors");
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const hasSentRef = useRef(false);

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const { data } = useSWR<{ providers: ApiProvider[] }>(
    connected ? "/api/connectors" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const provider = connected
    ? ((data?.providers ?? []).find((p) => p.id === connected) ?? null)
    : null;

  useEffect(() => {
    if (!connected && !error) return;

    setStatus(error ? "error" : "success");

    if (!hasSentRef.current) {
      hasSentRef.current = true;
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "oauth-callback",
            provider: connected,
            error,
          },
          window.location.origin
        );
      }
    }

    const timer = setTimeout(() => {
      window.close();
    }, 1500);

    return () => clearTimeout(timer);
  }, [connected, error]);

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6">
      <div className="flex items-center gap-6">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-card">
          <svg
            aria-hidden="true"
            fill="none"
            height="24"
            viewBox="0 0 200 200"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="fill-black dark:fill-white"
              d="M10 10 L190 10 L100 185 Z"
            />
            <path
              className="fill-white dark:fill-black"
              d="M40 30 L170 30 L103 155 Z"
            />
          </svg>
        </div>

        <MoveHorizontalIcon
          className="size-5 text-muted-foreground/40"
          strokeWidth={1.5}
        />

        {provider ? (
          <ConnectorLogo
            className="size-6"
            color={provider.color}
            icon={provider.icon}
            name={provider.displayName}
          />
        ) : (
          <div className="size-12 shrink-0 rounded-xl border border-border/40 bg-card" />
        )}
      </div>

      <div className="text-center">
        {status === "success" && (
          <p className="text-[14px] font-medium tracking-tight text-foreground">
            {t("callback.success")}
          </p>
        )}
        {status === "error" && (
          <p className="text-[14px] font-medium tracking-tight text-destructive">
            {t("callback.error")}
          </p>
        )}
      </div>
    </div>
  );
}
