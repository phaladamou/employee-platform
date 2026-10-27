import type { Provider } from "../../core/types";
import { driveConfig } from "./config";

export const drive: Provider = {
  id: "drive",
  name: "Google Drive",
  displayName: "Google Drive",
  descriptionKey: "connectors.providers.drive.description",
  category: "popular",
  color: "#4285F4",
  icon: "googledrive",
  permissionsKeys: [
    "connectors.providers.drive.permissions.readFiles",
    "connectors.providers.drive.permissions.writeFiles",
  ],
  configured:
    Boolean(driveConfig.clientId) && Boolean(driveConfig.clientSecret),
  oauth: {
    ...driveConfig,
    scopes: [...driveConfig.scopes],
  },
  actions: [],
};
