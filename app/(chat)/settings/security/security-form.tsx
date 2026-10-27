// app/(chat)/settings/security/security-form.tsx
"use client";

import {
  Clock,
  Eye,
  EyeOff,
  Key,
  MapPin,
  Monitor,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card } from "@/components/workspace/settings/shared/card";
import { Row } from "@/components/workspace/settings/shared/row";
import { SectionLabel } from "@/components/workspace/settings/shared/section-label";
import { Toggle } from "@/components/workspace/settings/shared/toggle";

const MOCK_SESSIONS = [
  {
    id: "1",
    device: "Chrome — Windows",
    ip: "192.168.1.42",
    location: "Paris, France",
    current: true,
    date: "Active now",
  },
  {
    id: "2",
    device: "Safari — iPhone",
    ip: "10.0.0.15",
    location: "Paris, France",
    current: false,
    date: "May 24, 2026",
  },
  {
    id: "3",
    device: "Firefox — MacOS",
    ip: "172.16.0.8",
    location: "Lyon, France",
    current: false,
    date: "May 22, 2026",
  },
];

const MOCK_AUDIT_LOGS = [
  {
    id: "1",
    action: "Settings updated",
    category: "Security",
    date: "May 25, 2026 — 14:32",
    ip: "192.168.1.42",
  },
  {
    id: "2",
    action: "API key created",
    category: "API",
    date: "May 24, 2026 — 09:15",
    ip: "192.168.1.42",
  },
  {
    id: "3",
    action: "Session revoked",
    category: "Security",
    date: "May 23, 2026 — 18:47",
    ip: "172.16.0.8",
  },
  {
    id: "4",
    action: "Memory cleared",
    category: "Memory",
    date: "May 22, 2026 — 11:03",
    ip: "10.0.0.15",
  },
];

const MOCK_API_KEYS = [
  {
    id: "1",
    name: "Production key",
    prefix: "sk_prod_",
    lastUsed: "May 25, 2026",
    created: "Apr 10, 2026",
  },
  {
    id: "2",
    name: "Development key",
    prefix: "sk_dev_",
    lastUsed: "May 20, 2026",
    created: "Mar 5, 2026",
  },
];

export function SecurityForm({
  userId: _userId,
  initialPreferences,
}: {
  userId: string;
  initialPreferences: Record<string, unknown>;
}) {
  const router = useRouter();
  const t = useTranslations("settings");

  const [twoFactor, setTwoFactor] = useState(
    (initialPreferences.twoFactor as boolean) ?? false
  );
  const [ipRestriction, setIpRestriction] = useState(
    (initialPreferences.ipRestriction as boolean) ?? false
  );
  const [allowedIps, setAllowedIps] = useState<string[]>(
    (initialPreferences.allowedIps as string[]) ?? []
  );
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newIp, setNewIp] = useState("");

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

  function addIp() {
    if (!newIp.trim()) {
      return;
    }
    const updated = [...allowedIps, newIp.trim()];
    setAllowedIps(updated);
    setNewIp("");
    save({ twoFactor, ipRestriction, allowedIps: updated });
  }

  function removeIp(ip: string) {
    const updated = allowedIps.filter((i) => i !== ip);
    setAllowedIps(updated);
    save({ twoFactor, ipRestriction, allowedIps: updated });
  }

  function toggleKeyVisibility(keyId: string) {
    setShowKeys((prev) => {
      const next = { ...prev };
      if (next[keyId]) {
        delete next[keyId];
      } else {
        next[keyId] = true;
      }
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <SectionLabel>{t("security")}</SectionLabel>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("authentication")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("authenticationDescription")}
          </p>
        </div>
        <Row
          action={
            <Toggle
              checked={twoFactor}
              label="2FA"
              onChange={(v) => {
                setTwoFactor(v);
                save({ twoFactor: v, ipRestriction, allowedIps });
              }}
            />
          }
          icon={Shield}
          label={t("twoFactorAuth")}
          value={
            twoFactor
              ? t("twoFactorEnabled")
              : t("twoFactorDisabled")
          }
        />
        <Row
          action={
            <Toggle
              checked={ipRestriction}
              label={t("ipRestriction")}
              onChange={(v) => {
                setIpRestriction(v);
                save({ twoFactor, ipRestriction: v, allowedIps });
              }}
            />
          }
          icon={Monitor}
          label={t("ipRestriction")}
          value={
            ipRestriction
              ? `${t("accessLimitedTo")} ${allowedIps.length} IP(s)`
              : t("allowAnyIp")
          }
        />
        {ipRestriction && (
          <div className="px-5 pb-4 space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                onChange={(e) => setNewIp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addIp();
                  }
                }}
                placeholder={t("addIpAddress")}
                value={newIp}
              />
              <button
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[14px] font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors"
                onClick={addIp}
                type="button"
              >
                <Plus className="size-4" />
              </button>
            </div>
            {allowedIps.map((ip) => (
              <div
                className="flex items-center gap-2 text-[14px] text-neutral-600 dark:text-neutral-400"
                key={ip}
              >
                <span className="flex-1">{ip}</span>
                <button
                  className="text-red-500 hover:text-red-400 transition-colors"
                  onClick={() => removeIp(ip)}
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("activeSessions")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("activeSessionsDescription")}
          </p>
        </div>
        {MOCK_SESSIONS.map((session) => (
          <Row
            action={
              session.current ? (
                <span className="text-[12px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {t("current")}
                </span>
              ) : (
                <button
                  className="text-[14px] font-medium text-red-500 hover:text-red-400 transition-colors"
                  type="button"
                >
                  {t("revoke")}
                </button>
              )
            }
            icon={Monitor}
            key={session.id}
            label={session.device}
            value={
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {session.location}
                </span>
                <span className="text-neutral-400">{session.ip}</span>
                <span className="text-neutral-400">{session.date}</span>
              </span>
            }
          />
        ))}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
                {t("apiKeys")}
              </h3>
              <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t("apiKeysDescription")}
              </p>
            </div>
            <button
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[14px] font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors"
              type="button"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {MOCK_API_KEYS.map((key) => (
          <Row
            action={
              <div className="flex items-center gap-1">
                <button
                  className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
                  onClick={() => toggleKeyVisibility(key.id)}
                  type="button"
                >
                  {showKeys[key.id] ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
                <button
                  className="p-1 rounded text-red-500 hover:text-red-400 transition-colors"
                  type="button"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            }
            icon={Key}
            key={key.id}
            label={key.name}
            value={
              <span className="flex items-center gap-3">
                <span>
                  {showKeys[key.id]
                    ? `${key.prefix}••••••••••`
                    : `${key.prefix}${"•".repeat(12)}`}
                </span>
                <span className="text-neutral-400">
                  {t("lastUsed")}: {key.lastUsed}
                </span>
              </span>
            }
          />
        ))}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("auditLogs")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("auditLogsDescription")}
          </p>
        </div>
        {MOCK_AUDIT_LOGS.map((log) => (
          <Row
            icon={Clock}
            key={log.id}
            label={log.action}
            value={
              <span className="flex items-center gap-3">
                <span className="text-[12px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                  {log.category}
                </span>
                <span className="text-neutral-400">{log.date}</span>
                <span className="text-neutral-400">IP: {log.ip}</span>
              </span>
            }
          />
        ))}
      </Card>
    </div>
  );
}