// components/workspace/workspace-header.tsx
"use client";

import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { DesktopDownload } from "./desktop-download";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  onToggleRightPanel,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  onToggleRightPanel?: () => void;
}) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 flex h-14 shrink-0 items-center justify-between gap-2 bg-white dark:bg-background px-3">
      {/* Partie gauche : Nom */}
      <div className="flex items-center gap-2.5">
        <Button
          className="md:hidden"
          onClick={toggleSidebar}
          size="icon-sm"
          variant="ghost"
        >
          <PanelLeftIcon className="size-4" />
        </Button>
        <Link
          className="text-xl font-semibold text-foreground tracking-tight"
          href="/"
        >
          Employee
        </Link>
      </div>

      {/* Partie droite : telechargement + panneau droit */}
      <div className="flex items-center gap-2">
        <DesktopDownload />
        {onToggleRightPanel && (
          <Button
            onClick={onToggleRightPanel}
            size="icon-sm"
            title="Toggle panel"
            variant="ghost"
          >
            <PanelRightIcon className="size-4" />
          </Button>
        )}
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.onToggleRightPanel === nextProps.onToggleRightPanel
  );
});