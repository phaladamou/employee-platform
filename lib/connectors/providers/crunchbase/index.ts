import type { Provider } from "../../core/types";
import { crunchbaseConfig } from "./config";

export const crunchbase: Provider = {
  id: "crunchbase",
  name: "Crunchbase",
  displayName: "Crunchbase",
  descriptionKey: "connectors.providers.crunchbase.description",
  category: "finance",
  color: "#146AFF",
  icon: "crunchbase",
  permissionsKeys: [
    "connectors.providers.crunchbase.permissions.readPublicData",
  ],
  configured:
    Boolean(crunchbaseConfig.clientId) && Boolean(crunchbaseConfig.clientSecret),
  oauth: {
    ...crunchbaseConfig,
    scopes: [...crunchbaseConfig.scopes],
  },
  actions: [],
};
