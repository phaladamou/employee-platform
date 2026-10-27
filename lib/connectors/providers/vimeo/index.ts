import type { Provider } from "../../core/types";
import { vimeoConfig } from "./config";

export const vimeo: Provider = {
  id: "vimeo",
  name: "Vimeo",
  displayName: "Vimeo",
  descriptionKey: "connectors.providers.vimeo.description",
  category: "creative",
  color: "#1AB7EA",
  icon: "vimeo",
  permissionsKeys: [
    "connectors.providers.vimeo.permissions.readVideos",
  ],
  configured:
    Boolean(vimeoConfig.clientId) && Boolean(vimeoConfig.clientSecret),
  oauth: {
    ...vimeoConfig,
    scopes: [...vimeoConfig.scopes],
  },
  actions: [],
};
