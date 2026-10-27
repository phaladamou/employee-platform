// app/(chat)/simulations/layout.tsx
import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { SimulationSidebar } from "@/components/simulations/simulation-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function SimulationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
        <SimulationsShell>{children}</SimulationsShell>
      </Suspense>
    </>
  );
}

async function SimulationsShell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <SimulationSidebar user={session?.user} />
      <SidebarInset>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
          }}
        />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
