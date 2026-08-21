import { env } from "../config/env.js";
import { getFromFplApi } from "./httpClient.js";

export interface RawElementSummaryHistory {
  round: number;
  total_points: number;
  minutes: number;
}

export interface RawElementSummary {
  history: RawElementSummaryHistory[];
}

/** Per-player fixture-by-fixture history. Not used in v1 routes yet - reserved for a v2 Player Explorer drill-down. */
export function getElementSummary(playerId: number): Promise<RawElementSummary> {
  return getFromFplApi<RawElementSummary>(`/element-summary/${playerId}/`, env.CACHE_TTL_ENTRY_MS);
}
