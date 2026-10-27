import { auth } from "@/app/(auth)/auth";
import { getUser, getUserSettings } from "@/lib/db/queries";
import { GeneralForm } from "./general-form";

export default async function GeneralPage() {
  const session = await auth();
  const userRecord = await getUser(session?.user?.email ?? "");
  const settings = await getUserSettings({ userId: session?.user?.id ?? "" });
  const currentUser = userRecord[0];
  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>;

  return (
    <GeneralForm
      initialPreferences={prefs}
      user={{
        id: session?.user?.id ?? "",
        name: currentUser?.name ?? session?.user?.name ?? "",
        email: session?.user?.email ?? "",
        image: currentUser?.image ?? null,
        bio: currentUser?.bio ?? null,
        createdAt: currentUser?.createdAt?.toISOString() ?? null,
      }}
    />
  );
}
