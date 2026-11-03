// components/workspace/chef-action-cards.tsx
"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import Link from "next/link";
import { RocketIcon, UserPlusIcon, UsersRoundIcon } from "lucide-react";
import { CHEF_ACTION_CARDS } from "@/lib/chef/actions";
import type { ChatMessage } from "@/lib/types";

const ICONS = {
  recruit: UserPlusIcon,
  mission: RocketIcon,
  team: UsersRoundIcon,
} as const;

export function ChefActionCards({
  sendMessage,
}: {
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
      {CHEF_ACTION_CARDS.map((card) => {
        const Icon = ICONS[card.id];
        const body = (
          <>
            <Icon className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">
                {card.title}
              </span>
              <span className="block text-xs leading-snug text-muted-foreground">
                {card.description}
              </span>
            </span>
          </>
        );
        const className =
          "flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3 text-left transition-colors hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20";

        return card.href ? (
          <Link className={className} href={card.href} key={card.id}>
            {body}
          </Link>
        ) : (
          <button
            className={`${className} cursor-pointer`}
            key={card.id}
            onClick={() =>
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: card.missionOpener ?? "" }],
              })
            }
            type="button"
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
