import type { Provider } from "../../core/types";
import { stripeConfig } from "./config";

export const stripe: Provider = {
  id: "stripe",
  name: "Stripe",
  displayName: "Stripe",
  descriptionKey: "connectors.providers.stripe.description",
  category: "finance",
  color: "#635BFF",
  icon: "stripe",
  permissionsKeys: [
    "connectors.providers.stripe.permissions.readPayments",
  ],
  configured:
    Boolean(stripeConfig.clientId) && Boolean(stripeConfig.clientSecret),
  oauth: {
    ...stripeConfig,
    scopes: [...stripeConfig.scopes],
  },
  actions: [],
};
