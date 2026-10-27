function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function UsageBar({
  used,
  total,
  label,
}: {
  used: number;
  total: number;
  label: string;
}) {
  const pct = Math.min(100, Math.round((used / total) * 100));

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </span>
        <span className="text-[14px] tabular-nums text-neutral-500 dark:text-neutral-500">
          {formatNumber(used)}&nbsp;/&nbsp;{formatNumber(total)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
        <div
          className="h-full rounded-full bg-neutral-900 dark:bg-neutral-300 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
