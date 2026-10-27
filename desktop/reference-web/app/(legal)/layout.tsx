// app/(legal)/layout.tsx
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { BackButton } from "@/components/workspace/back-button";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-8 sm:px-12 md:px-16">
          <BackButton />

          <span className="text-[13px] font-medium tracking-tight">
            Employee Inc
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-8 py-16 sm:px-12 md:px-16">
        {children}
      </main>

      <footer className="border-t border-border/40">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-8 py-6 text-[12px] text-muted-foreground sm:px-12 md:px-16">
          <Link className="hover:text-foreground" href="/terms">
            Terms
          </Link>
          <Link className="hover:text-foreground" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-foreground" href="/dpa">
            DPA
          </Link>
          <Link className="hover:text-foreground" href="/sub-processors">
            Sub-processors
          </Link>
          <span className="ml-auto text-muted-foreground/60">
            © {new Date().getFullYear()} Employee Inc
          </span>
        </div>
      </footer>
    </div>
  );
}
