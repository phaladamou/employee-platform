import type { Provider } from "../../core/types";
import { zoomConfig } from "./config";

export const zoom: Provider = {
  id: "zoom",
  name: "Zoom",
  displayName: "Zoom",
  descriptionKey: "connectors.providers.zoom.description",
  category: "communication",
  color: "#2D8CFF",
  icon: "zoom",
  permissionsKeys: [
    "connectors.providers.zoom.permissions.readMeetings",
  ],
  configured:
    Boolean(zoomConfig.clientId) && Boolean(zoomConfig.clientSecret),
  oauth: {
    ...zoomConfig,
    scopes: [...zoomConfig.scopes],
  },
  actions: [],
};
