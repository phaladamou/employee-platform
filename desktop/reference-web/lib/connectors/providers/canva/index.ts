import type { Provider } from "../../core/types";
import { canvaConfig } from "./config";

export const canva: Provider = {
  id: "canva",
  name: "Canva",
  displayName: "Canva",
  descriptionKey: "connectors.providers.canva.description",
  category: "creative",
  color: "#00C4CC",
  icon: "canva",
  permissionsKeys: [
    "connectors.providers.canva.permissions.readDesigns",
  ],
  configured:
    Boolean(canvaConfig.clientId) && Boolean(canvaConfig.clientSecret),
  oauth: {
    ...canvaConfig,
    scopes: [...canvaConfig.scopes],
  },
  actions: [],
};
