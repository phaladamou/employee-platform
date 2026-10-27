// app/(chat)/computer/connectors/callback/layout.tsx
export default function CallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background">
      {children}
    </div>
  );
}
