import type {
  CaptainPick,
  ChipStrategyResponse,
  OptimizerRequest,
  OptimizerResult,
  Player,
  TeamSummary,
  TransferOption
} from "@fpl/shared";

const API_BASE = import.meta.env.VITE_API_BASE;

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
