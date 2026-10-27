import type { Provider } from "../../core/types";
import { neonConfig } from "./config";

export const neon: Provider = {
  id: "neon",
  name: "Neon",
  displayName: "Neon",
  descriptionKey: "connectors.providers.neon.description",
  category: "developer",
  color: "#00E599",
  icon: "neon",
  permissionsKeys: [
    "connectors.providers.neon.permissions.readDatabases",
  ],
  configured:
    Boolean(neonConfig.clientId) && Boolean(neonConfig.clientSecret),
  oauth: {
    ...neonConfig,
    scopes: [...neonConfig.scopes],
  },
  actions: [],
};
