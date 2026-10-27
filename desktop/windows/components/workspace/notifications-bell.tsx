// components/workspace/notifications-bell.tsx
"use client";

import { BellIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConnectorLogo } from "@/components/computer/connector-logo";
import { getPublicProvider } from "@/lib/connectors/public";
import { relativeTime } from "@/lib/notifications/format-time";
import { cn, fetcher } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  provider: string | null;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsBell({ className }: { className?: string }) {
  const t = useTranslations("notifications");
  const router = useRouter();

  const { data } = useSWR<{
    notifications: NotificationItem[];
    unreadCount: number;
  }>("/api/notifications", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30_000,
  });

  const items = (data?.notifications ?? []).slice(0, 3);
  const unreadCount = data?.unreadCount ?? 0;

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
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          aria-label={t("title")}
          className={cn(
            "relative flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors duration-150 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
            className
          )}
          onClick={() => router.push("/notifications")}
          type="button"
        >
          <BellIcon className="size-4 shrink-0" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      </TooltipTrigger>

      <TooltipContent
        align="start"
        className="border-0 bg-transparent p-0 shadow-none [&>span]:hidden"
        side="top"
        sideOffset={8}
      >
        <div className="w-72 overflow-hidden rounded-xl border border-border/70 bg-card shadow-lg">
          <div className="border-b border-border/60 px-3.5 py-3">
            <h3 className="text-xs font-semibold text-foreground">
              {t("title")}
            </h3>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-5 text-center text-[11px] text-muted-foreground">
                {t("empty")}
              </div>
            ) : (
              <div className="p-1.5">
                {items.map((item) => {
                  const provider = item.provider
                    ? getPublicProvider(item.provider)
                    : null;
                  return (
                    <div
                      className="flex items-start gap-2 rounded-md px-2.5 py-2"
                      key={item.id}
                    >
                      {provider && (
                        <ConnectorLogo
                          className="size-3.5"
                          color={provider.color}
                          icon={provider.icon}
                          name={provider.displayName}
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="truncate text-[12px] text-foreground/90">
                          {t(item.title, {
                            provider: provider?.displayName ?? "",
                          })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {renderTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            className="block w-full border-t border-border/60 px-3.5 py-2 text-center text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            onClick={() => router.push("/notifications")}
            type="button"
          >
            {t("viewAll")}
          </button>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
