export { WebSearchCapability } from "./web-search-capability";
export type {
  WebSearchInput,
  WebSearchOutput,
  WebSearchResultItem,
} from "./web-search-types";

import { WebSearchCapability } from "./web-search-capability";

export function createWebSearchCapability(): WebSearchCapability {
  return new WebSearchCapability();
}