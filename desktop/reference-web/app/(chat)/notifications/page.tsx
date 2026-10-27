// app/(chat)/notifications/page.tsx
"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR, { useSWRConfig } from "swr";
import { ChatHeader } from "@/components/workspace/workspace-header";
import { ConnectorLogo } from "@/components/computer/connector-logo";
import { ActiveChatProvider, useActiveChat } from "@/hooks/use-active-chat";
import { getPublicProvider } from "@/lib/connectors/public";
import { relativeTime } from "@/lib/notifications/format-time";
import { fetcher } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  provider: string | null;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  return (
    <ActiveChatProvider>
      <NotificationsPageContent />
    </ActiveChatProvider>
  );
}

function NotificationsPageContent() {
  const { chatId, isReadonly, visibilityType } = useActiveChat();
  const t = useTranslations("notifications");
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const { data } = useSWR<{
    notifications: NotificationItem[];
    unreadCount: number;
  }>("/api/notifications", fetcher, { revalidateOnFocus: false });

  const items = data?.notifications ?? [];

  useEffect(() => {
    fetch("/api/notifications/read", { method: "POST" }).then(() => {
      mutate("/api/notifications");
    });
  }, [mutate]);

  const renderTime = (iso: string) => {
    const time = relativeTime(new Date(iso));
    if (time.key === "justNow") return t("time.justNow");
    if (time.key === "minutesAgo")
      return t("time.minutesAgo", { count: time.count });
    if (time.key === "hoursAgo")
      return t("time.hoursAgo", { count: time.count });
    if (time.key === "yesterday") return t("time.yesterday");
    return t("time.daysAgo", { count: time.count });
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-background">
      <ChatHeader
        chatId={chatId}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />

      <div className="mx-auto w-full max-w-3xl shrink-0 px-6 pt-8 pb-6">
        <button
          className="mb-4 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 pb-10">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-[13px] text-muted-foreground">
                {t("empty")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const provider = item.provider
                  ? getPublicProvider(item.provider)
                  : null;
                return (
                  <div
                    className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/30"
                    key={item.id}
                  >
                    {provider && (
                      <ConnectorLogo
                        className="size-4"
                        color={provider.color}
                        icon={provider.icon}
                        name={provider.displayName}
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-[13px] text-foreground/90">
                        {t(item.title, {
                          provider: provider?.displayName ?? "",
                        })}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {renderTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
