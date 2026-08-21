import { env } from "../config/env.js";
import { getFromFplApi } from "./httpClient.js";

export interface RawFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  finished: boolean;
}

export function getFixtures(): Promise<RawFixture[]> {
  return getFromFplApi<RawFixture[]>("/fixtures/", env.CACHE_TTL_FIXTURES_MS);
}
