import { env } from "../config/env.js";
import { getFromFplApi } from "./httpClient.js";

export interface RawTeam {
  id: number;
  name: string;
  short_name: string;
  strength: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface RawElement {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number; // 1=GKP,2=DEF,3=MID,4=FWD
  now_cost: number;
  form: string;
  points_per_game: string;
  ep_next: string;
  ict_index: string;
  selected_by_percent: string;
  status: string;
  chance_of_playing_next_round: number | null;
  minutes: number;
  starts: number;
  event_points: number;
  total_points: number;
  expected_goal_involvements_per_90: string;
}

export interface RawEvent {
  id: number;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
}

export interface RawElementType {
  id: number;
  singular_name_short: string;
}

export interface BootstrapStatic {
  teams: RawTeam[];
  elements: RawElement[];
  events: RawEvent[];
  element_types: RawElementType[];
}

export function getBootstrapStatic(): Promise<BootstrapStatic> {
  return getFromFplApi<BootstrapStatic>("/bootstrap-static/", env.CACHE_TTL_BOOTSTRAP_MS);
}
