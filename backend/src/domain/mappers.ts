import type { Club, PlayerStatus, Position } from "@fpl/shared";
import type { RawElement, RawTeam } from "../fpl-client/bootstrap.js";

export type BasePlayer = {
  id: number;
  webName: string;
  fullName: string;
  position: Position;
  clubId: number;
  nowCost: number;
  form: number;
  pointsPerGame: number;
  epNext: number;
  ictIndex: number;
  selectedByPercent: number;
  status: PlayerStatus;
  chanceOfPlayingNextRound: number | null;
  minutes: number;
  starts: number;
  eventPoints: number;
  totalPoints: number;
  xgi90: number;
};

const VALID_STATUSES: PlayerStatus[] = ["a", "d", "i", "s", "u", "n"];

function toPlayerStatus(raw: string): PlayerStatus {
  return (VALID_STATUSES as string[]).includes(raw) ? (raw as PlayerStatus) : "a";
}

const ELEMENT_TYPE_TO_POSITION: Record<number, Position> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

export function mapClub(raw: RawTeam): Club {
  return {
    id: raw.id,
    name: raw.name,
    shortName: raw.short_name,
    strength: raw.strength,
    played: raw.played,
    win: raw.win,
    draw: raw.draw,
    loss: raw.loss,
    points: raw.points,
    position: raw.position
  };
}

export function mapBasePlayer(raw: RawElement): BasePlayer {
  return {
    id: raw.id,
    webName: raw.web_name,
    fullName: `${raw.first_name} ${raw.second_name}`,
    position: ELEMENT_TYPE_TO_POSITION[raw.element_type] ?? "MID",
    clubId: raw.team,
    nowCost: raw.now_cost,
    form: parseFloat(raw.form) || 0,
    pointsPerGame: parseFloat(raw.points_per_game) || 0,
    epNext: parseFloat(raw.ep_next) || 0,
    ictIndex: parseFloat(raw.ict_index) || 0,
    selectedByPercent: parseFloat(raw.selected_by_percent) || 0,
    status: toPlayerStatus(raw.status),
    chanceOfPlayingNextRound: raw.chance_of_playing_next_round,
    minutes: raw.minutes,
    starts: raw.starts,
    eventPoints: raw.event_points,
    totalPoints: raw.total_points,
    xgi90: parseFloat(raw.expected_goal_involvements_per_90) || 0
  };
}
