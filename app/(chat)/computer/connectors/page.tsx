// app/(chat)/computer/connectors/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { ConnectorCard } from "@/components/computer/connector-card";
import { ChatHeader } from "@/components/workspace/workspace-header";
import { ActiveChatProvider, useActiveChat } from "@/hooks/use-active-chat";
import type { ProviderSummary } from "@/lib/connectors";
import { fetcher } from "@/lib/utils";

type ApiProvider = ProviderSummary & { connected: boolean };

const categories = [
  "popular",
  "productivity",
  "developer",
  "communication",
  "finance",
  "data",
  "creative",
] as const;

export default function ConnectorsPage() {
  return (
    <ActiveChatProvider>
      <ConnectorsPageContent />
    </ActiveChatProvider>
  );
}

function ConnectorsPageContent() {
  const { chatId, isReadonly, visibilityType } = useActiveChat();
  const t = useTranslations();
  const { mutate } = useSWRConfig();
  const [search, setSearch] = useState("");
  const seenCallbacksRef = useRef<Set<string>>(new Set());

  const { data } = useSWR<{ providers: ApiProvider[] }>(
    "/api/connectors",
    fetcher,
    { revalidateOnFocus: false }
  );

  const providers = data?.providers ?? [];

  // Refs stables pour le listener
  const providersRef = useRef(providers);
  const tRef = useRef(t);

  useEffect(() => {
    providersRef.current = providers;
  }, [providers]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Écouteur attaché UNE SEULE FOIS
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth-callback") return;

      const connectedId = event.data.provider as string | null;
      const error = event.data.error as string | null;

      const key = `${connectedId ?? "error"}::${error ?? ""}`;
      if (seenCallbacksRef.current.has(key)) return;
      seenCallbacksRef.current.add(key);

      if (error) {
        toast.error(tRef.current("connectors.toast.error"));
      } else if (connectedId) {
        const name =
          providersRef.current.find((p) => p.id === connectedId)
            ?.displayName ?? connectedId;
        toast.success(
          tRef.current("connectors.toast.connected", { provider: name })
        );
      }

      mutate("/api/connectors");
      mutate("/api/notifications");
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return providers;
    const q = search.toLowerCase();
    return providers.filter((p) => {
      const name = p.displayName.toLowerCase();
      const desc = t(p.descriptionKey).toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [providers, search, t]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-background">
      <ChatHeader
        chatId={chatId}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />

      <div className="mx-auto w-full max-w-5xl shrink-0 px-6 pt-10 pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("connectors.title")}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("connectors.subtitle")}
          </p>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            className="w-full rounded-xl border border-border/60 bg-card px-10 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-border"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("connectors.searchPlaceholder")}
            type="text"
            value={search}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 pb-10">
          {categories.map((category) => {
            const items = filtered.filter((p) => p.category === category);
            if (items.length === 0) return null;

            return (
              <div className="mb-12" key={category}>
                <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                  {t(`connectors.categories.${category}`)}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((provider) => (
                    <ConnectorCard key={provider.id} provider={provider} />
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-[13px] text-muted-foreground">
                {t("connectors.empty")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
