import type { Provider } from "../../core/types";
import { snowflakeConfig } from "./config";

export const snowflake: Provider = {
  id: "snowflake",
  name: "Snowflake",
  displayName: "Snowflake",
  descriptionKey: "connectors.providers.snowflake.description",
  category: "data",
  color: "#29B5E8",
  icon: "snowflake",
  permissionsKeys: [
    "connectors.providers.snowflake.permissions.readData",
  ],
  configured:
    Boolean(snowflakeConfig.clientId) && Boolean(snowflakeConfig.clientSecret),
  oauth: {
    ...snowflakeConfig,
    scopes: [...snowflakeConfig.scopes],
  },
  actions: [],
};
