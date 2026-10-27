export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500">
      {children}
    </p>
  );
}
