import { auth } from "@/app/(auth)/auth";
import { getUserSettings } from "@/lib/db/queries";
import { MemoryForm } from "./memory-form";

export default async function MemoryPage() {
  const session = await auth();
  const settings = await getUserSettings({ userId: session?.user?.id ?? "" });
  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>;

  return <MemoryForm initialPreferences={prefs} />;
}
