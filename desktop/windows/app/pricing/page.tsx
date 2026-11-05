// app/pricing/page.tsx
import { PricingTiers } from "@/components/billing/pricing-tiers";

export const metadata = {
  title: "Pricing — Employee",
};

export default function Page() {
  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      <PricingTiers />
    </div>
  );
}
