import type { Provider } from "../../core/types";
import { githubConfig } from "./config";

export const github: Provider = {
  id: "github",
  name: "GitHub",
  displayName: "GitHub",
  descriptionKey: "connectors.providers.github.description",
  category: "popular",
  color: "#181717",
  icon: "github",
  permissionsKeys: [
    "connectors.providers.github.permissions.readProfile",
    "connectors.providers.github.permissions.readEmail",
    "connectors.providers.github.permissions.seePublicRepos",
    "connectors.providers.github.permissions.seeOrgs",
  ],
  configured:
    Boolean(githubConfig.clientId) && Boolean(githubConfig.clientSecret),
  oauth: {
    ...githubConfig,
    scopes: [...githubConfig.scopes],
  },
  actions: [],
};
