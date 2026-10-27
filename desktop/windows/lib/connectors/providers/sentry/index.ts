import type { Provider } from "../../core/types";
import { sentryConfig } from "./config";

export const sentry: Provider = {
  id: "sentry",
  name: "Sentry",
  displayName: "Sentry",
  descriptionKey: "connectors.providers.sentry.description",
  category: "developer",
  color: "#362D59",
  icon: "sentry",
  permissionsKeys: [
    "connectors.providers.sentry.permissions.readIssues",
    "connectors.providers.sentry.permissions.readProjects",
  ],
  configured:
    Boolean(sentryConfig.clientId) && Boolean(sentryConfig.clientSecret),
  oauth: {
    ...sentryConfig,
    scopes: [...sentryConfig.scopes],
  },
  actions: [],
};
