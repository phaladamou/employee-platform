import type { Provider } from "../../core/types";
import { calConfig } from "./config";

export const cal: Provider = {
  id: "cal",
  name: "Cal.com",
  displayName: "Cal.com",
  descriptionKey: "connectors.providers.cal.description",
  category: "productivity",
  color: "#111827",
  icon: "caldotcom",
  permissionsKeys: [
    "connectors.providers.cal.permissions.readEvents",
  ],
  configured:
    Boolean(calConfig.clientId) && Boolean(calConfig.clientSecret),
  oauth: {
    ...calConfig,
    scopes: [...calConfig.scopes],
  },
  actions: [],
};
