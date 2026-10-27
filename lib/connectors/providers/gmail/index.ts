import type { Provider } from "../../core/types";
import { gmailConfig } from "./config";

export const gmail: Provider = {
  id: "gmail",
  name: "Gmail",
  displayName: "Gmail",
  descriptionKey: "connectors.providers.gmail.description",
  category: "popular",
  color: "#EA4335",
  icon: "gmail",
  permissionsKeys: [
    "connectors.providers.gmail.permissions.readEmails",
    "connectors.providers.gmail.permissions.sendEmails",
  ],
  configured:
    Boolean(gmailConfig.clientId) && Boolean(gmailConfig.clientSecret),
  oauth: {
    ...gmailConfig,
    scopes: [...gmailConfig.scopes],
  },
  actions: [],
};
