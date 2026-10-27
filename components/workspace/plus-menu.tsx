// components/workspace/plus-menu.tsx
"use client";

import {
  BookOpenIcon,
  BrainIcon,
  BugIcon,
  Code2Icon,
  FlaskConicalIcon,
  GlobeIcon,
  PaperclipIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Wand2Icon,
} from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ModeType = "file" | "research" | "reasoning" | "course" | "search" | "frontend" | "backend" | "fullstack" | "debug" | "optimize" | "deploy";

type PlusMenuProps = {
  onModeSelect?: (mode: ModeType) => void;
  activeMode?: ModeType | null;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  isWebsites?: boolean;
};

export function PlusMenu({
  onModeSelect,
  activeMode,
  fileInputRef,
  isWebsites,
}: PlusMenuProps) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);

  const chatMenuItems = [
    { id: "file" as const, label: t("chooseFile"), icon: PaperclipIcon },
    { id: "research" as const, label: t("deepResearch"), icon: FlaskConicalIcon },
    { id: "reasoning" as const, label: t("reasoning"), icon: BrainIcon },
    { id: "course" as const, label: t("course"), icon: BookOpenIcon },
    { id: "search" as const, label: t("search"), icon: SearchIcon },
  ];

  const websiteMenuItems = [
    { id: "file" as const, label: t("chooseFile"), icon: PaperclipIcon },
    { id: "frontend" as const, label: t("frontend"), icon: Code2Icon },
    { id: "backend" as const, label: t("backend"), icon: GlobeIcon },
    { id: "fullstack" as const, label: t("fullstack"), icon: PencilIcon },
    { id: "debug" as const, label: t("debug"), icon: BugIcon },
    { id: "optimize" as const, label: t("optimize"), icon: Wand2Icon },
    { id: "deploy" as const, label: t("deploy"), icon: SearchIcon },
  ];

  const items = isWebsites ? websiteMenuItems : chatMenuItems;

  const handleSelect = (id: ModeType) => {
    if (id === "file") {
      fileInputRef?.current?.click();
    } else {
      onModeSelect?.(id);
    }
    setOpen(false);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="h-7 w-7 rounded-full border border-black/20 dark:border-white/20 p-1 text-black dark:text-white transition-colors hover:border-black/40 dark:hover:border-white/40 hover:text-foreground"
          data-testid="plus-menu"
          variant="ghost"
        >
          <PlusIcon size={14} style={{ width: 14, height: 14 }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 rounded-xl border border-black/20 dark:border-white/20 bg-card p-1.5 shadow-[var(--shadow-float)]"
        side="top"
        sideOffset={8}
      >
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors hover:bg-muted/60 ${
                activeMode === item.id
                  ? "text-foreground bg-muted/40"
                  : "text-black dark:text-white"
              }`}
              key={item.id}
              onClick={() => handleSelect(item.id)}
              type="button"
            >
              <item.icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function getModeLabel(mode: ModeType | null): string {
  if (!mode) return "Agent";
  // Fallback statique pour getModeLabel (pas de hook ici)
  const labels: Record<ModeType, string> = {
    file: "Choose a file",
    research: "Agent · Research",
    reasoning: "Agent · Reasoning",
    course: "Agent · Course",
    search: "Agent · Search",
    frontend: "Agent · Frontend",
    backend: "Agent · Backend",
    fullstack: "Agent · Full Stack",
    debug: "Agent · Debug",
    optimize: "Agent · Optimize",
    deploy: "Agent · Deploy",
  };
  return labels[mode];
}