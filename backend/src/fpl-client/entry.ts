import { env } from "../config/env.js";
import { getFromFplApi } from "./httpClient.js";

export interface RawEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_rank: number | null;
  current_event: number | null;
  // Both are null before this entry has a locked-in squad for the season (pre-deadline / brand new team).
  last_deadline_bank: number | null;
  last_deadline_value: number | null;
  last_deadline_total_transfers: number;
}

export interface RawChip {
  name: string;
  event: number;
}

export interface RawHistoryEvent {
  event: number;
  event_transfers: number;
}

export interface RawEntryHistory {
  current: RawHistoryEvent[];
  chips: RawChip[];
}

export interface RawPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface RawPicksResponse {
  active_chip: string | null;
  entry_history: {
    event: number;
    bank: number;
    value: number;
  };
  picks: RawPick[];
}

export function getEntry(teamId: number): Promise<RawEntry> {
  return getFromFplApi<RawEntry>(`/entry/${teamId}/`, env.CACHE_TTL_ENTRY_MS);
}

export function getEntryHistory(teamId: number): Promise<RawEntryHistory> {
  return getFromFplApi<RawEntryHistory>(`/entry/${teamId}/history/`, env.CACHE_TTL_ENTRY_MS);
}

export function getEntryPicks(teamId: number, gw: number): Promise<RawPicksResponse> {
  return getFromFplApi<RawPicksResponse>(`/entry/${teamId}/event/${gw}/picks/`, env.CACHE_TTL_ENTRY_MS);
}
