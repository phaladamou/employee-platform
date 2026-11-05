// app/(chat)/settings/github/github-form.tsx
"use client";

import { Github } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";

import { Card } from "@/components/workspace/settings/shared/card";
import { SectionLabel } from "@/components/workspace/settings/shared/section-label";
import { fetcher } from "@/lib/utils";

interface ConnectionStatus {
  connected: boolean;
  connectedAt?: string | null;
}

export function GithubForm() {
  const t = useTranslations("settings");
  const { data, error, isLoading, mutate } = useSWR<ConnectionStatus>(
    "/api/github/connection",
    fetcher,
    { revalidateOnFocus: false }
  );
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const connected = data?.connected === true;

  const connect = async () => {
    const value = token.trim();
    if (!value || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch("/api/github/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFailure(
          payload.error === "invalid_token"
            ? t("githubInvalidToken")
            : payload.error === "encryption_unavailable"
              ? t("githubUnavailable")
              : t("githubSaveFailed")
        );
        return;
      }
      setToken("");
      await mutate();
    } catch {
      setFailure(t("githubSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch("/api/github/connection", {
        method: "DELETE",
      });
      if (!response.ok) {
        setFailure(t("githubSaveFailed"));
        return;
      }
      await mutate();
    } catch {
      setFailure(t("githubSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionLabel>{t("githubTitle")}</SectionLabel>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Github className="size-4 text-neutral-900 dark:text-neutral-100" />
            <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
              {t("githubTitle")}
            </h3>
          </div>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("githubDescription")}
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {isLoading ? (
            <p className="text-[14px] text-neutral-500 dark:text-neutral-400">
              …
            </p>
          ) : error ? (
            <p className="text-[14px] text-red-600 dark:text-red-400">
              {t("githubSaveFailed")}
            </p>
          ) : connected ? (
            <>
              <p className="text-[14px] text-neutral-900 dark:text-neutral-100">
                {t("githubConnected")}
                {data?.connectedAt && (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {" "}
                    ·{" "}
                    {t("githubSince", {
                      date: new Date(data.connectedAt).toLocaleDateString(),
                    })}
                  </span>
                )}
              </p>
              <div>
                <button
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-[14px] font-medium text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void disconnect()}
                  type="button"
                >
                  {t("githubDisconnect")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label
                  className="mb-1.5 block text-[14px] font-medium text-neutral-900 dark:text-neutral-100"
                  htmlFor="github-pat"
                >
                  {t("githubPatLabel")}
                </label>
                <input
                  autoComplete="off"
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-[14px] text-neutral-900 dark:text-neutral-100 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
                  disabled={busy}
                  id="github-pat"
                  onChange={(event) => setToken(event.target.value)}
                  placeholder={t("githubPatPlaceholder")}
                  spellCheck={false}
                  type="password"
                  value={token}
                />
                <p className="mt-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                  {t("githubPatHelp")}
                </p>
              </div>
              <div>
                <button
                  className="rounded-lg bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-[14px] font-medium text-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-50"
                  disabled={busy || !token.trim()}
                  onClick={() => void connect()}
                  type="button"
                >
                  {busy ? t("githubConnecting") : t("githubConnect")}
                </button>
              </div>
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                {t("githubPublicNote")}
              </p>
            </>
          )}
          {failure && (
            <p className="text-[14px] text-red-600 dark:text-red-400">
              {failure}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
