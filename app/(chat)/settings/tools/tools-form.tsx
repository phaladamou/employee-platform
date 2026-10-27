// app/(chat)/settings/tools/tools-form.tsx
"use client";

import {
  FileText,
  Github,
  Link,
  Shield,
  Slack,
  Timer,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card } from "@/components/workspace/settings/shared/card";
import { Row } from "@/components/workspace/settings/shared/row";
import { SectionLabel } from "@/components/workspace/settings/shared/section-label";
import { Toggle } from "@/components/workspace/settings/shared/toggle";

const INTEGRATIONS = [
  {
    id: "github",
    label: "GitHub",
    icon: Github,
    description: "Repositories, issues, pull requests",
  },
  {
    id: "slack",
    label: "Slack",
    icon: Slack,
    description: "Messages, channels, notifications",
  },
  {
    id: "notion",
    label: "Notion",
    icon: FileText,
    description: "Pages, databases, wikis",
  },
  {
    id: "browser",
    label: "Web Browser",
    icon: Link,
    description: "Search, scrape, navigate",
  },
  {
    id: "api",
    label: "Custom API",
    icon: Link,
    description: "Connect any REST or GraphQL API",
  },
];

export function ToolsForm({
  initialPreferences,
}: {
  initialPreferences: Record<string, unknown>;
}) {
  const router = useRouter();
  const t = useTranslations("settings");

  const [connectedTools, setConnectedTools] = useState<string[]>(
    (initialPreferences.connectedTools as string[]) ?? []
  );
  const [toolPermissions, setToolPermissions] = useState<
    Record<string, string>
  >((initialPreferences.toolPermissions as Record<string, string>) ?? {});
  const [toolTimeout, setToolTimeout] = useState(
    (initialPreferences.toolTimeout as number) ?? 30
  );
  const [toolQuota, setToolQuota] = useState(
    (initialPreferences.toolQuota as number) ?? 100
  );
  const [toolLogs, setToolLogs] = useState(
    (initialPreferences.toolLogs as boolean) ?? true
  );
  const [sandboxMode, setSandboxMode] = useState(
    (initialPreferences.sandboxMode as boolean) ?? true
  );

  async function save(data: Record<string, unknown>) {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: data }),
      });
      router.refresh();
    } catch (err) {
      console.error("Save failed:", err);
    }
  }

  const prefs = {
    connectedTools,
    toolPermissions,
    toolTimeout,
    toolQuota,
    toolLogs,
    sandboxMode,
  };

  function toggleTool(id: string) {
    const updated = connectedTools.includes(id)
      ? connectedTools.filter((tool) => tool !== id)
      : [...connectedTools, id];
    setConnectedTools(updated);
    save({ ...prefs, connectedTools: updated });
  }

  function setPermission(toolId: string, level: string) {
    const updated = { ...toolPermissions, [toolId]: level };
    setToolPermissions(updated);
    save({ ...prefs, toolPermissions: updated });
  }

  return (
    <div className="space-y-8">
      <SectionLabel>{t("tools")}</SectionLabel>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("connectedIntegrations")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("connectedIntegrationsDescription")}
          </p>
        </div>
        {INTEGRATIONS.map((tool) => {
          const isConnected = connectedTools.includes(tool.id);
          return (
            <Row
              action={
                <button
                  className={`text-[14px] font-medium transition-colors ${
                    isConnected
                      ? "text-red-500 hover:text-red-400"
                      : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                  onClick={() => toggleTool(tool.id)}
                  type="button"
                >
                  {isConnected ? t("disconnect") : t("connect")}
                </button>
              }
              icon={tool.icon}
              key={tool.id}
              label={tool.label}
              value={isConnected ? t("connected") : t("notConnected")}
            />
          );
        })}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("toolPermissions")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("toolPermissionsDescription")}
          </p>
        </div>
        {connectedTools.map((toolId) => {
          const tool = INTEGRATIONS.find((t) => t.id === toolId);
          if (!tool) {
            return null;
          }
          return (
            <Row
              action={
                <select
                  className="rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  onChange={(e) => setPermission(toolId, e.target.value)}
                  value={toolPermissions[toolId] ?? "read"}
                >
                  <option value="read">{t("read")}</option>
                  <option value="write">{t("write")}</option>
                  <option value="admin">{t("admin")}</option>
                </select>
              }
              icon={tool.icon}
              key={toolId}
              label={tool.label}
              value={
                toolPermissions[toolId] === "admin"
                  ? t("admin")
                  : toolPermissions[toolId] === "write"
                    ? t("write")
                    : t("read")
              }
            />
          );
        })}
        {connectedTools.length === 0 && (
          <div className="px-5 py-4 text-[14px] text-neutral-400">
            {t("noToolsConnected")}
          </div>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("limitsSafety")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("limitsSafetyDescription")}
          </p>
        </div>
        <Row
          action={
            <div className="flex items-center gap-2">
              <input
                className="w-16 rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-[14px] text-neutral-900 text-right dark:border-neutral-700 dark:text-neutral-100"
                max={120}
                min={5}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10) || 5;
                  setToolTimeout(v);
                  save({ ...prefs, toolTimeout: v });
                }}
                type="number"
                value={toolTimeout}
              />
              <span className="text-[14px] text-neutral-400">{t("sec")}</span>
            </div>
          }
          icon={Timer}
          label={t("executionTimeout")}
          value={t("executionTimeoutDescription")}
        />
        <Row
          action={
            <div className="flex items-center gap-2">
              <input
                className="w-20 rounded-lg border border-neutral-200 bg-transparent px-2 py-1 text-[14px] text-neutral-900 text-right dark:border-neutral-700 dark:text-neutral-100"
                max={10_000}
                min={10}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10) || 10;
                  setToolQuota(v);
                  save({ ...prefs, toolQuota: v });
                }}
                type="number"
                value={toolQuota}
              />
              <span className="text-[14px] text-neutral-400">{t("perDay")}</span>
            </div>
          }
          icon={Wrench}
          label={t("dailyCallQuota")}
          value={t("dailyCallQuotaDescription")}
        />
        <Row
          action={
            <Toggle
              checked={sandboxMode}
              label={t("sandboxMode")}
              onChange={(v) => {
                setSandboxMode(v);
                save({ ...prefs, sandboxMode: v });
              }}
            />
          }
          icon={Shield}
          label={t("sandboxMode")}
          value={t("sandboxModeDescription")}
        />
        <Row
          action={
            <Toggle
              checked={toolLogs}
              label={t("toolExecutionLogs")}
              onChange={(v) => {
                setToolLogs(v);
                save({ ...prefs, toolLogs: v });
              }}
            />
          }
          icon={FileText}
          label={t("toolExecutionLogs")}
          value={t("toolExecutionLogsDescription")}
        />
      </Card>
    </div>
  );
}