import type { Provider } from "../../core/types";
import { notionConfig } from "./config";

export const notion: Provider = {
  id: "notion",
  name: "Notion",
  displayName: "Notion",
  descriptionKey: "connectors.providers.notion.description",
  category: "popular",
  color: "#000000",
  icon: "notion",
  permissionsKeys: [
    "connectors.providers.notion.permissions.readPages",
    "connectors.providers.notion.permissions.writePages",
  ],
  configured:
    Boolean(notionConfig.clientId) && Boolean(notionConfig.clientSecret),
  oauth: {
    ...notionConfig,
    scopes: [...notionConfig.scopes],
  },
  actions: [],
};
