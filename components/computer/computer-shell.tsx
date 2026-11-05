// components/computer/computer-shell.tsx
"use client";

import { MonitorIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useActiveChat } from "@/hooks/use-active-chat";
import { ChatHeader } from "@/components/workspace/workspace-header";

export function ComputerShell() {
  const { chatId, isReadonly, visibilityType } = useActiveChat();
  const t = useTranslations("computer");

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-background">
      <ChatHeader
        chatId={chatId}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
      <div className="flex flex-1 justify-center px-6">
        <div className="mt-[8dvh] h-fit w-full max-w-md text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted">
            <MonitorIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[13px] font-medium text-foreground">
            {t("title")}
          </p>
          <p className="mx-auto mt-2 w-fit rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t("status")}
          </p>
          <h1 className="mt-3 text-balance text-xl font-semibold tracking-tight text-foreground">
            {t("heading")}
          </h1>
          <p className="mt-2 text-pretty text-[13px] leading-relaxed text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>
    </div>
  );
}
