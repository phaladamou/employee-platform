import { auth } from "@/app/(auth)/auth";
import { getUserSettings } from "@/lib/db/queries";
import { ToolsForm } from "./tools-form";

export default async function ToolsPage() {
  const session = await auth();
  const settings = await getUserSettings({ userId: session?.user?.id ?? "" });
  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>;

  return <ToolsForm initialPreferences={prefs} />;
}
