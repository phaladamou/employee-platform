import type { Provider } from "../../core/types";
import { motherduckConfig } from "./config";

export const motherduck: Provider = {
  id: "motherduck",
  name: "MotherDuck",
  displayName: "MotherDuck",
  descriptionKey: "connectors.providers.motherduck.description",
  category: "data",
  color: "#FFD700",
  icon: "motherduck",
  permissionsKeys: [
    "connectors.providers.motherduck.permissions.readData",
  ],
  configured:
    Boolean(motherduckConfig.clientId) && Boolean(motherduckConfig.clientSecret),
  oauth: {
    ...motherduckConfig,
    scopes: [...motherduckConfig.scopes],
  },
  actions: [],
};
