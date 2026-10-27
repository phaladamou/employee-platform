import type { Provider } from "../../core/types";
import { vercelConfig } from "./config";

export const vercel: Provider = {
  id: "vercel",
  name: "Vercel",
  displayName: "Vercel",
  descriptionKey: "connectors.providers.vercel.description",
  category: "developer",
  color: "#000000",
  icon: "vercel",
  permissionsKeys: [
    "connectors.providers.vercel.permissions.readProjects",
    "connectors.providers.vercel.permissions.deploy",
  ],
  configured:
    Boolean(vercelConfig.clientId) && Boolean(vercelConfig.clientSecret),
  oauth: {
    ...vercelConfig,
    scopes: [...vercelConfig.scopes],
  },
  actions: [],
};
