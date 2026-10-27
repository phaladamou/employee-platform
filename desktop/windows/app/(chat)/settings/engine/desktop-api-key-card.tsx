// app/(chat)/settings/engine/desktop-api-key-card.tsx
"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card } from "@/components/workspace/settings/shared/card";

interface DesktopSettingsStatus {
  configured: boolean;
  llmApiKey: string | null;
  llmBaseUrl: string;
  tavilyApiKey: string | null;
}

export function DesktopApiKeyCard() {
  const t = useTranslations("settings");

  const [status, setStatus] = useState<DesktopSettingsStatus | null>(null);
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [tavilyApiKey, setTavilyApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    fetch("/api/desktop/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DesktopSettingsStatus | null) => {
        if (data) {
          setStatus(data);
          setLlmBaseUrl(data.llmBaseUrl);
        }
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/desktop/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llmApiKey, llmBaseUrl, tavilyApiKey }),
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
      const data = (await fetch("/api/desktop/settings").then((r) =>
        r.json()
      )) as DesktopSettingsStatus;
      setStatus(data);
      setLlmApiKey("");
      setTavilyApiKey("");
      setFeedback("saved");
    } catch {
      setFeedback("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-neutral-400" />
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("desktopApiTitle")}
          </h3>
          {status && (
            <span
              className={`ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                status.configured
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              {status.configured
                ? t("desktopApiKeyConfigured")
                : t("desktopApiKeyMissing")}
            </span>
          )}
        </div>
        <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
          {t("desktopApiDescription")}
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label
            className="mb-1.5 block text-[14px] font-medium text-neutral-600 dark:text-neutral-400"
            htmlFor="desktop-llm-key"
          >
            {t("desktopApiKeyLabel")}
            {status?.llmApiKey && (
              <span className="ml-2 font-normal text-neutral-400 tabular-nums">
                {t("desktopCurrentKey", { key: status.llmApiKey })}
              </span>
            )}
          </label>
          <input
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            id="desktop-llm-key"
            onChange={(e) => setLlmApiKey(e.target.value)}
            placeholder={t("desktopApiKeyPlaceholder")}
            spellCheck={false}
            type="password"
            value={llmApiKey}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-[14px] font-medium text-neutral-600 dark:text-neutral-400"
            htmlFor="desktop-base-url"
          >
            {t("desktopBaseUrlLabel")}
          </label>
          <input
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            id="desktop-base-url"
            onChange={(e) => setLlmBaseUrl(e.target.value)}
            spellCheck={false}
            type="text"
            value={llmBaseUrl}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-[14px] font-medium text-neutral-600 dark:text-neutral-400"
            htmlFor="desktop-tavily-key"
          >
            {t("desktopTavilyLabel")}
            {status?.tavilyApiKey && (
              <span className="ml-2 font-normal text-neutral-400 tabular-nums">
                {t("desktopCurrentKey", { key: status.tavilyApiKey })}
              </span>
            )}
          </label>
          <input
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
            id="desktop-tavily-key"
            onChange={(e) => setTavilyApiKey(e.target.value)}
            placeholder={t("desktopTavilyPlaceholder")}
            spellCheck={false}
            type="password"
            value={tavilyApiKey}
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            className="rounded-lg bg-neutral-900 px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            disabled={saving}
            onClick={save}
            type="button"
          >
            {t("desktopSave")}
          </button>
          {feedback === "saved" && (
            <span className="text-[13px] text-emerald-600 dark:text-emerald-400">
              {t("desktopSaved")}
            </span>
          )}
          {feedback === "error" && (
            <span className="text-[13px] text-red-600 dark:text-red-400">
              {t("desktopSaveError")}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
