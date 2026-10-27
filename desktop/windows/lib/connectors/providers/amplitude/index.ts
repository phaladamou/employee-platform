import type { Provider } from "../../core/types";
import { amplitudeConfig } from "./config";

export const amplitude: Provider = {
  id: "amplitude",
  name: "Amplitude",
  displayName: "Amplitude",
  descriptionKey: "connectors.providers.amplitude.description",
  category: "data",
  color: "#1E61F0",
  icon: "amplitude",
  permissionsKeys: [
    "connectors.providers.amplitude.permissions.readAnalytics",
  ],
  configured:
    Boolean(amplitudeConfig.clientId) && Boolean(amplitudeConfig.clientSecret),
  oauth: {
    ...amplitudeConfig,
    scopes: [...amplitudeConfig.scopes],
  },
  actions: [],
};
