// components/workspace/suggested-actions.tsx
"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { suggestions } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";
import { CategoryModal } from "./category-modal";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  setActiveCategory?: (category: string | null) => void;
};

function PureSuggestedActions({
  chatId,
  sendMessage,
}: SuggestedActionsProps) {
  const t = useTranslations("chat");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const category = suggestions.find((s) => s.label === openCategory);
  const promptKeys = category
    ? [1, 2, 3, 4].map((n) => `${category.label.toLowerCase()}Prompt${n}`)
    : [];

  const titleKey = category
    ? `category${category.label}Title`
    : "";

  const handleSelectPrompt = (promptText: string) => {
    window.history.pushState(
      {},
      "",
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/workspace/${chatId}`
    );
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: promptText }],
    });
    setOpenCategory(null);
  };

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/20 dark:border-border/30 bg-card/20 px-3.5 py-1.5 text-[13px] text-black dark:text-white/90 transition-all hover:bg-card/40"
            initial={{ opacity: 0, y: 4 }}
            key={suggestion.label}
            transition={{ delay: 0.05 * index, duration: 0.3 }}
            onClick={() => setOpenCategory(suggestion.label)}
            type="button"
          >
            <suggestion.icon className="size-3.5 text-black/60 dark:text-white/60" />
            <span>{t(suggestion.label.toLowerCase())}</span>
          </motion.button>
        ))}
      </div>

      {category && (
        <CategoryModal
          label={category.label}
          onClose={() => setOpenCategory(null)}
          onSelect={handleSelectPrompt}
          promptKeys={promptKeys}
          prompts={category.prompts}
          title={t(titleKey)}
        />
      )}
    </>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prev, next) =>
    prev.chatId === next.chatId &&
    prev.selectedVisibilityType === next.selectedVisibilityType
);