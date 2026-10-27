import type { Provider } from "../../core/types";
import { todoistConfig } from "./config";

export const todoist: Provider = {
  id: "todoist",
  name: "Todoist",
  displayName: "Todoist",
  descriptionKey: "connectors.providers.todoist.description",
  category: "productivity",
  color: "#E44332",
  icon: "todoist",
  permissionsKeys: [
    "connectors.providers.todoist.permissions.readTasks",
    "connectors.providers.todoist.permissions.writeTasks",
  ],
  configured:
    Boolean(todoistConfig.clientId) && Boolean(todoistConfig.clientSecret),
  oauth: {
    ...todoistConfig,
    scopes: [...todoistConfig.scopes],
  },
  actions: [],
};
