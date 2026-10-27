import type { Provider } from "../../core/types";
import { intercomConfig } from "./config";

export const intercom: Provider = {
  id: "intercom",
  name: "Intercom",
  displayName: "Intercom",
  descriptionKey: "connectors.providers.intercom.description",
  category: "communication",
  color: "#1F8DED",
  icon: "intercom",
  permissionsKeys: [
    "connectors.providers.intercom.permissions.readConversations",
  ],
  configured:
    Boolean(intercomConfig.clientId) && Boolean(intercomConfig.clientSecret),
  oauth: {
    ...intercomConfig,
    scopes: [...intercomConfig.scopes],
  },
  actions: [],
};
