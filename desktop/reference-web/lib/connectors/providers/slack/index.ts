import type { Provider } from "../../core/types";
import { slackConfig } from "./config";

export const slack: Provider = {
  id: "slack",
  name: "Slack",
  displayName: "Slack",
  descriptionKey: "connectors.providers.slack.description",
  category: "popular",
  color: "#4A154B",
  icon: "slack",
  permissionsKeys: [
    "connectors.providers.slack.permissions.readMessages",
    "connectors.providers.slack.permissions.sendMessages",
  ],
  configured:
    Boolean(slackConfig.clientId) && Boolean(slackConfig.clientSecret),
  oauth: {
    ...slackConfig,
    scopes: [...slackConfig.scopes],
  },
  actions: [],
};
