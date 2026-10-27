import { auth } from "@/app/(auth)/auth";
import { getUserSettings, getUserStats } from "@/lib/db/queries";
import { BillingForm } from "./billing-form";

export default async function BillingPage() {
  const session = await auth();
  const settings = await getUserSettings({ userId: session?.user?.id ?? "" });
  const stats = await getUserStats({ userId: session?.user?.id ?? "" });
  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>;

  return <BillingForm initialPreferences={prefs} stats={stats} />;
}
