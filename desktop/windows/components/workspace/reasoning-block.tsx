"use client";

import { useState } from "react";

interface ReasoningBlockProps {
  content: string;
}

const AtomIcon = () => (
  <svg
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 4c-4 0-6 2-6 4 0 2 2 4 6 4 4 0 6-2 6-4 0-2-2-4-6-4Z" />
    <path d="M12 20c-4 0-6-2-6-4 0-2 2-4 6-4 4 0 6 2 6 4 0 2-2 4-6 4Z" />
    <path d="M5.5 8c2 3.5 4 5 6.5 5s4.5-1.5 6.5-5" />
    <path d="M5.5 16c2-3.5 4-5 6.5-5s4.5 1.5 6.5 5" />
  </svg>
);

export function ReasoningBlock({ content }: ReasoningBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="my-2 rounded-lg border border-border/30 bg-muted/20">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <AtomIcon />
        <span>Reasoning</span>
        <span className="ml-auto text-xs">{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && (
        <div className="border-t border-border/30 px-3 py-2 text-sm text-muted-foreground">
          {content}
        </div>
      )}
    </div>
  );
}
