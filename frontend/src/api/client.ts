import type {
  CaptainPick,
  ChipStrategyResponse,
  Club,
  FixtureTickerClub,
  GameweekEvent,
  LiveFixture,
  OptimizerRequest,
  OptimizerResult,
  Player,
  TeamSummary,
  TransferOption
} from "@fpl/shared";

// Defaults to same-origin (relative paths) so the built app works out of the
// box in the unified single-domain Vercel deployment; local dev overrides
// this via frontend/.env to point at the standalone backend dev server.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface AvailabilityWrapped<T> {
  available: boolean;
  message?: string;
}

export function getPlayers(params?: {
  position?: string;
  team?: number;
  maxPrice?: number;
  search?: string;
  sort?: "predictedPoints" | "form" | "price";
}): Promise<Player[]> {
  const query = new URLSearchParams();
  if (params?.position) query.set("position", params.position);
  if (params?.team) query.set("team", String(params.team));
  if (params?.maxPrice) query.set("maxPrice", String(params.maxPrice));
  if (params?.search) query.set("search", params.search);
  if (params?.sort) query.set("sort", params.sort);
  const qs = query.toString();
  return getJson<Player[]>(`/api/players${qs ? `?${qs}` : ""}`);
}

export function getTeamSummary(teamId: number): Promise<TeamSummary> {
  return getJson<TeamSummary>(`/api/team/${teamId}/summary`);
}

export function getCaptainPicks(teamId: number): Promise<AvailabilityWrapped<CaptainPick[]> & { picks: CaptainPick[] }> {
  return getJson(`/api/team/${teamId}/captain-picks`);
}

export function getTransferSuggestions(
  teamId: number,
  horizon = 5,
  maxTransfers = 3
): Promise<AvailabilityWrapped<TransferOption[]> & { options: TransferOption[] }> {
  return getJson(`/api/team/${teamId}/transfer-suggestions?horizon=${horizon}&maxTransfers=${maxTransfers}`);
}

export function getChipStrategy(teamId: number): Promise<AvailabilityWrapped<ChipStrategyResponse> & ChipStrategyResponse> {
  return getJson(`/api/chip-strategy?teamId=${teamId}`);
}

export function optimizeSquad(teamId: number, request: OptimizerRequest): Promise<OptimizerResult> {
  return postJson(`/api/team/${teamId}/optimize-squad`, request);
}

export function getClubs(): Promise<Club[]> {
  return getJson<Club[]>("/api/clubs");
}

export function getGameweek(): Promise<GameweekEvent> {
  return getJson<GameweekEvent>("/api/gameweek");
}

export function getFixtureTicker(horizon = 10): Promise<FixtureTickerClub[]> {
  return getJson<FixtureTickerClub[]>(`/api/fixtures/ticker?horizon=${horizon}`);
}

export function getLeagueTable(): Promise<Club[]> {
  return getJson<Club[]>("/api/league-table");
}

export function getCurrentFixtures(): Promise<LiveFixture[]> {
  return getJson<LiveFixture[]>("/api/fixtures/current");
}
