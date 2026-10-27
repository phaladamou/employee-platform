import type { Provider } from "../../core/types";
import { evernoteConfig } from "./config";

export const evernote: Provider = {
  id: "evernote",
  name: "Evernote",
  displayName: "Evernote",
  descriptionKey: "connectors.providers.evernote.description",
  category: "productivity",
  color: "#00A82D",
  icon: "evernote",
  permissionsKeys: [
    "connectors.providers.evernote.permissions.readNotes",
    "connectors.providers.evernote.permissions.writeNotes",
  ],
  configured:
    Boolean(evernoteConfig.clientId) && Boolean(evernoteConfig.clientSecret),
  oauth: {
    ...evernoteConfig,
    scopes: [...evernoteConfig.scopes],
  },
  actions: [],
};
