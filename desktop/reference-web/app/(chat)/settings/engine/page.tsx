import { auth } from "@/app/(auth)/auth";
import { getUserSettings } from "@/lib/db/queries";
import { EngineForm } from "./engine-form";

export default async function EnginePage() {
  const session = await auth();
  const settings = await getUserSettings({ userId: session?.user?.id ?? "" });
  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>;

  return <EngineForm initialPreferences={prefs} />;
}
