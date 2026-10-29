// app/(chat)/settings/layout.tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { auth } from "@/app/(auth)/auth";
import { SettingsCloseButton } from "@/components/workspace/settings/settings-close-button";
import { SettingsNav } from "@/components/workspace/settings/settings-nav";
import { SettingsTitle } from "@/components/workspace/settings/settings-title";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex w-full max-w-7xl h-[90vh] relative">
        <SettingsCloseButton />

        <div className="w-64 shrink-0 border-r border-neutral-200 dark:border-neutral-800 p-6">
          <SettingsTitle />
          <SettingsNav />
        </div>

        <div className="flex-1 overflow-y-auto p-14">
          <div className="max-w-4xl mx-auto">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center" />
              }
            >
              {children}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}