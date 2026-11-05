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
      className="flex flex-1 cursor-text flex-col overflow-hidden"
      onClick={() => inputRef.current?.focus()}
    >
      <div
        className="flex flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-10"
        ref={scrollRef}
      >
        <div className="mx-auto mt-[20dvh] w-full max-w-3xl">
          <div className="space-y-1 font-mono text-[13px] leading-[1.9]">
            {lines.map((line) =>
              line.kind === "input" ? (
                <div
                  className="whitespace-pre-wrap text-secondary-foreground"
                  key={line.id}
                >
                  <span className="mr-2 text-muted-foreground">›</span>
                  {line.text}
                </div>
              ) : (
                <div
                  className={
                    line.kind === "error"
                      ? "whitespace-pre-wrap text-destructive"
                      : "whitespace-pre-wrap text-muted-foreground"
                  }
                  key={line.id}
                >
                  {line.text || " "}
                </div>
              )
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/50 px-4 py-3 font-mono text-[13px]">
            <span className="shrink-0 text-muted-foreground">›</span>
            <input
              aria-label={t("placeholder")}
              autoFocus
              className="flex-1 bg-transparent text-secondary-foreground outline-none placeholder:text-muted-foreground/60"
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
      </div>
    </div>
  );
}
