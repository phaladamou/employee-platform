// app/(chat)/settings/memory/memory-form.tsx
"use client";

import {
  Brain,
  Clock,
  HardDrive,
  Layers,
  RefreshCw,
  Shrink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card } from "@/components/workspace/settings/shared/card";
import { Row } from "@/components/workspace/settings/shared/row";
import { SectionLabel } from "@/components/workspace/settings/shared/section-label";
import { Toggle } from "@/components/workspace/settings/shared/toggle";
import { UsageBar } from "@/components/workspace/settings/shared/usage-bar";

export function MemoryForm({
  initialPreferences,
}: {
  initialPreferences: Record<string, unknown>;
}) {
  const router = useRouter();
  const t = useTranslations("settings");

  const [shortTerm, setShortTerm] = useState(
    (initialPreferences.shortTerm as boolean) ?? true
  );
  const [shortTermLimit, setShortTermLimit] = useState(
    (initialPreferences.shortTermLimit as number) ?? 50
  );
  const [longTerm, setLongTerm] = useState(
    (initialPreferences.longTerm as boolean) ?? true
  );
  const [autoSummary, setAutoSummary] = useState(
    (initialPreferences.autoSummary as boolean) ?? true
  );
  const [compression, setCompression] = useState(
    (initialPreferences.compression as boolean) ?? false
  );
  const [compressionLevel, setCompressionLevel] = useState(
    (initialPreferences.compressionLevel as number) ?? 50
  );
  const [memoryExpiration, setMemoryExpiration] = useState(
    (initialPreferences.memoryExpiration as string) ?? "never"
  );
  const [syncMemory, setSyncMemory] = useState(
    (initialPreferences.syncMemory as boolean) ?? false
  );
  const [memoryUsed] = useState(128);
  const [memoryCapacity] = useState(512);

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
    shortTerm,
    shortTermLimit,
    longTerm,
    autoSummary,
    compression,
    compressionLevel,
    memoryExpiration,
    syncMemory,
  };

  return (
    <div className="space-y-8">
      <SectionLabel>{t("memory")}</SectionLabel>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("memoryUsage")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("memoryUsageDescription")}
          </p>
        </div>
        <div className="p-5 space-y-4">
          <UsageBar
            label={t("totalMemory")}
            total={memoryCapacity}
            used={memoryUsed}
          />
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex items-center gap-2 text-[14px] text-neutral-500">
              <div className="size-2 rounded-full bg-blue-500" />
              {t("shortTermMem")}: 32 MB
            </div>
            <div className="flex items-center gap-2 text-[14px] text-neutral-500">
              <div className="size-2 rounded-full bg-emerald-500" />
              {t("longTermMem")}: 64 MB
            </div>
            <div className="flex items-center gap-2 text-[14px] text-neutral-500">
              <div className="size-2 rounded-full bg-amber-500" />
              {t("projectMem")}: 20 MB
            </div>
            <div className="flex items-center gap-2 text-[14px] text-neutral-500">
              <div className="size-2 rounded-full bg-violet-500" />
              {t("embeddingsMem")}: 12 MB
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("memoryLayers")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("memoryLayersDescription")}
          </p>
        </div>
        <Row
          action={
            <Toggle
              checked={shortTerm}
              label={t("shortTermMemory")}
              onChange={(v) => {
                setShortTerm(v);
                save({ ...prefs, shortTerm: v });
              }}
            />
          }
          icon={Brain}
          label={t("shortTermMemory")}
          value={t("shortTermMemoryDescription")}
        />
        <Row
          action={
            <Toggle
              checked={longTerm}
              label={t("longTermMemory")}
              onChange={(v) => {
                setLongTerm(v);
                save({ ...prefs, longTerm: v });
              }}
            />
          }
          icon={HardDrive}
          label={t("longTermMemory")}
          value={t("longTermMemoryDescription")}
        />
        <Row
          action={
            <Toggle
              checked={autoSummary}
              label={t("autoSummarization")}
              onChange={(v) => {
                setAutoSummary(v);
                save({ ...prefs, autoSummary: v });
              }}
            />
          }
          icon={RefreshCw}
          label={t("autoSummarization")}
          value={t("autoSummarizationDescription")}
        />
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("compressionLimits")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("compressionLimitsDescription")}
          </p>
        </div>
        <Row
          action={
            <Toggle
              checked={compression}
              label={t("memoryCompression")}
              onChange={(v) => {
                setCompression(v);
                save({ ...prefs, compression: v });
              }}
            />
          }
          icon={Shrink}
          label={t("memoryCompression")}
          value={t("memoryCompressionDescription")}
        />
        {compression && (
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] font-medium text-neutral-600 dark:text-neutral-400">
                {t("compressionLevel")}
              </span>
              <span className="text-[14px] tabular-nums text-neutral-900 dark:text-neutral-100 font-medium">
                {compressionLevel}%
              </span>
            </div>
            <input
              className="w-full h-1.5 rounded-full appearance-none bg-neutral-200 dark:bg-neutral-700 accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
              max={90}
              min={10}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                setCompressionLevel(v);
                save({ ...prefs, compressionLevel: v });
              }}
              step={10}
              type="range"
              value={compressionLevel}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[12px] text-neutral-400">{t("light")}</span>
              <span className="text-[12px] text-neutral-400">{t("aggressive")}</span>
            </div>
          </div>
        )}
        <Row
          action={
            <select
              className="rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              onChange={(e) => {
                setMemoryExpiration(e.target.value);
                save({ ...prefs, memoryExpiration: e.target.value });
              }}
              value={memoryExpiration}
            >
              <option value="7d">{t("7days")}</option>
              <option value="30d">{t("30days")}</option>
              <option value="90d">{t("90days")}</option>
              <option value="never">{t("never")}</option>
            </select>
          }
          icon={Clock}
          label={t("memoryExpiration")}
          value={t("memoryExpirationDescription")}
        />
        <Row
          action={
            <Toggle
              checked={syncMemory}
              label={t("syncMemory")}
              onChange={(v) => {
                setSyncMemory(v);
                save({ ...prefs, syncMemory: v });
              }}
            />
          }
          icon={Layers}
          label={t("syncMemory")}
          value={t("syncMemoryDescription")}
        />
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
            {t("shortTermMemoryLimit")}
          </h3>
          <p className="text-[14px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("shortTermMemoryLimitDescription")}
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-neutral-600 dark:text-neutral-400">
              {t("messages")}
            </span>
            <input
              className="w-20 rounded-lg border border-neutral-200 bg-transparent px-2.5 py-1.5 text-[14px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              max={200}
              min={10}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10) || 10;
                setShortTermLimit(v);
                save({ ...prefs, shortTermLimit: v });
              }}
              type="number"
              value={shortTermLimit}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}