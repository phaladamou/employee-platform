// components/computer/computer-shell.tsx
"use client";

import { useActiveChat } from "@/hooks/use-active-chat";
import { ChatHeader } from "@/components/workspace/workspace-header";

export function ComputerShell() {
  const { chatId, isReadonly, visibilityType } = useActiveChat();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-background">
      <ChatHeader
        chatId={chatId}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[13px] text-muted-foreground">Computer</p>
      </div>
    </div>
  );
}
