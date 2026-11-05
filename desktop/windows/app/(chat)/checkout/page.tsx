// app/(chat)/checkout/page.tsx
import { CheckoutForm } from "@/components/billing/checkout-form";

export const metadata = {
  title: "Checkout — Employee",
};

export default function Page() {
  return <CheckoutForm />;
}
