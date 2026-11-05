// components/cli/cli-shell.tsx
"use client";

import { useActiveChat } from "@/hooks/use-active-chat";
import { ChatHeader } from "@/components/workspace/workspace-header";
import { CliTerminal } from "@/components/cli/cli-terminal";

export function CliShell() {
  const { chatId, isReadonly, visibilityType } = useActiveChat();

  return (
    <div className="theme-light flex h-dvh w-full flex-col overflow-hidden bg-background">
      <ChatHeader
        chatId={chatId}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
      <CliTerminal />
    </div>
  );
}
