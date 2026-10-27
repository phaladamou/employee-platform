import type { Provider } from "../../core/types";
import { figmaConfig } from "./config";

export const figma: Provider = {
  id: "figma",
  name: "Figma",
  displayName: "Figma",
  descriptionKey: "connectors.providers.figma.description",
  category: "popular",
  color: "#F24E1E",
  icon: "figma",
  permissionsKeys: [
    "connectors.providers.figma.permissions.readFiles",
    "connectors.providers.figma.permissions.comment",
  ],
  configured:
    Boolean(figmaConfig.clientId) && Boolean(figmaConfig.clientSecret),
  oauth: {
    ...figmaConfig,
    scopes: [...figmaConfig.scopes],
  },
  actions: [],
};
