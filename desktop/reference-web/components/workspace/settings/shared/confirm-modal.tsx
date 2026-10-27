export function ConfirmModal({
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 dark:bg-black/95 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
        <p className="mt-1.5 text-[16px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
          {description}
        </p>
        <div className="mt-5 flex gap-2 justify-end">
          <button
            className="rounded-lg px-3.5 py-2 text-[16px] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-red-50 px-3.5 py-2 text-[16px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-30 transition-colors dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading ? "Loading…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
