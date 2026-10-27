import type { Provider } from "../../core/types";
import { supabaseConfig } from "./config";

export const supabase: Provider = {
  id: "supabase",
  name: "Supabase",
  displayName: "Supabase",
  descriptionKey: "connectors.providers.supabase.description",
  category: "developer",
  color: "#3ECF8E",
  icon: "supabase",
  permissionsKeys: [
    "connectors.providers.supabase.permissions.readDatabase",
  ],
  configured:
    Boolean(supabaseConfig.clientId) && Boolean(supabaseConfig.clientSecret),
  oauth: {
    ...supabaseConfig,
    scopes: [...supabaseConfig.scopes],
  },
  actions: [],
};
