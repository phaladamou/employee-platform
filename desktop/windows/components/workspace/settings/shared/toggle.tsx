"use client";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const activeClass = checked
    ? "bg-neutral-900 dark:bg-neutral-600"
    : "bg-neutral-200 dark:bg-neutral-800";
  const dotClass = checked ? "translate-x-[20px]" : "translate-x-[2px]";

  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${activeClass}`}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${dotClass}`}
      />
    </button>
  );
}
