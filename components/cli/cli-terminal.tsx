// components/cli/cli-terminal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface TerminalLine {
  id: number;
  kind: "input" | "output" | "error";
  text: string;
}

interface CliResponse {
  output: string;
  exitCode: number;
}

let nextLineId = 0;

function toLines(text: string, kind: "output" | "error"): TerminalLine[] {
  return text.split("\n").map((line) => ({ id: nextLineId++, kind, text: line }));
}

export function CliTerminal() {
  const t = useTranslations("cli");
  const [lines, setLines] = useState<TerminalLine[]>(() => [
    ...toLines(t("welcome1"), "output"),
    ...toLines(t("welcome2"), "output"),
  ]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  async function runCommand(raw: string) {
    const line = raw.trim();
    if (!line || busy) return;
    setBusy(true);
    setLines((prev) => [...prev, { id: nextLineId++, kind: "input", text: line }]);
    setHistory((prev) => [line, ...prev].slice(0, 100));
    setHistoryIndex(-1);

    if (line.toLowerCase() === "clear") {
      setLines([]);
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line }),
      });
      if (res.status === 401) {
        setLines((prev) => [...prev, ...toLines(t("sessionExpired"), "error")]);
        return;
      }
      const data = (await res.json()) as CliResponse;
      setLines((prev) => [
        ...prev,
        ...toLines(data.output, data.exitCode === 0 ? "output" : "error"),
      ]);
    } catch {
      setLines((prev) => [...prev, ...toLines(t("networkError"), "error")]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      const line = value;
      setValue("");
      void runCommand(line);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (historyIndex + 1 < history.length) {
        const next = historyIndex + 1;
        setHistoryIndex(next);
        setValue(history[next]);
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex > 0) {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setValue(history[next]);
      } else {
        setHistoryIndex(-1);
        setValue("");
      }
    }
  }

  return (
    <div
      className="flex flex-1 cursor-text flex-col overflow-hidden px-6 py-4 font-mono text-[13px] leading-relaxed"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {lines.map((line) => (
          <div
            className={
              line.kind === "input"
                ? "whitespace-pre-wrap text-foreground"
                : line.kind === "error"
                  ? "whitespace-pre-wrap text-red-500"
                  : "whitespace-pre-wrap text-muted-foreground"
            }
            key={line.id}
          >
            {line.kind === "input" ? `$ ${line.text}` : line.text || "\u00a0"}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <span className="shrink-0 text-foreground">$</span>
        <input
          aria-label={t("placeholder")}
          autoFocus
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/50"
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={value}
        />
      </div>
    </div>
  );
}
