// components/workspace/suggested-actions-websites.tsx
"use client";

import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Microscope } from "lucide-react";
import { useTranslations } from "next-intl";

const suggestionKeys = [
  { key: "labWebsite", icone: Microscope, promptKey: "labWebsitePrompt" },
  {
    key: "researcherPortfolio",
    icone: GraduationCap,
    promptKey: "researcherPortfolioPrompt",
  },
  { key: "labNotebook", icone: BookOpen, promptKey: "labNotebookPrompt" },
];

export function SuggestedActionsWebsites({
  sendMessage,
}: {
  sendMessage: (message: {
    role: "user";
    parts: { type: "text"; text: string }[];
  }) => void;
}) {
  const t = useTranslations("websites");

  return (
    <div className="flex justify-center gap-2">
      {suggestionKeys.map((suggestion, index) => (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/20 dark:border-white/20 bg-card/20 px-3.5 py-1.5 text-[13px] text-black dark:text-white/90 transition-all hover:bg-card/40 whitespace-nowrap"
          initial={{ opacity: 0, y: 4 }}
          key={suggestion.key}
          onClick={() => {
            sendMessage({
              role: "user",
              parts: [{ type: "text", text: t(suggestion.promptKey) }],
            });
          }}
          transition={{ delay: 0.05 * index, duration: 0.3 }}
          type="button"
        >
          <suggestion.icone className="size-3.5 shrink-0 text-black/60 dark:text-white/60" />
          <span>{t(suggestion.key)}</span>
        </motion.button>
      ))}
    </div>
  );
}
