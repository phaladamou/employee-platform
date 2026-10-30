// app/(auth)/onboarding/page.tsx
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/workspace/onboarding-form";
import { auth } from "../auth";

export default async function Page() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/onboarding")}`);
  }
  if (session.user.onboarded) {
    redirect("/workspace");
  }

  return (
    <OnboardingForm
      defaultName={session.user.name ?? ""}
      email={session.user.email ?? ""}
    />
  );
}
