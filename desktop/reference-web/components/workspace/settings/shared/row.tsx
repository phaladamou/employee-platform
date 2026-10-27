import type { LucideIcon } from "lucide-react";

export function Row({
  icon: Icon,
  label,
  value,
  action,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  action?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 ${
        danger
          ? "border-t border-neutral-200 dark:border-neutral-800"
          : "border-t border-neutral-100 dark:border-neutral-900 first:border-t-0"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${
          danger ? "text-red-500" : "text-neutral-300 dark:text-neutral-700"
        }`}
      />
      <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <p
            className={`text-[16px] truncate font-medium ${
              danger
                ? "text-red-600 dark:text-red-400"
                : "text-neutral-900 dark:text-neutral-100"
            }`}
          >
            {label}
          </p>
          {value && (
            <p className="text-[14px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
              {value}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
