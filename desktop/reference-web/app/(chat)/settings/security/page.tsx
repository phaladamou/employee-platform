import { auth } from "@/app/(auth)/auth";
import { getUserSettings } from "@/lib/db/queries";
import { SecurityForm } from "./security-form";

export default async function SecurityPage() {
  const session = await auth();
  const settings = await getUserSettings({ userId: session?.user?.id ?? "" });
  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>;

  return (
    <SecurityForm initialPreferences={prefs} userId={session?.user?.id ?? ""} />
  );
}
