// app/(chat)/billing/page.tsx
import { BillingView } from "@/components/billing/billing-view";

export const metadata = {
  title: "Billing — Employee",
};

export default function Page() {
  return <BillingView />;
}
