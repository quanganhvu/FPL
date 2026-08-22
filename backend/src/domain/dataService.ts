import type { Club, Player } from "@fpl/shared";
import { getBootstrapStatic } from "../fpl-client/bootstrap.js";
import { getFixtures, type RawFixture } from "../fpl-client/fixtures.js";
import type { RawEvent } from "../fpl-client/bootstrap.js";
import { mapBasePlayer, mapClub } from "./mappers.js";
import { buildTeamStrengthMap } from "./teamStrength.js";
import { buildPlayers } from "../engine/expectedPoints.js";
import { getHorizonGameweeks, getNextGameweek } from "./gameweeks.js";

export interface PlatformData {
  players: Player[];
  clubs: Club[];
  events: RawEvent[];
  fixtures: RawFixture[];
  horizonGws: number[];
}

const DEFAULT_HORIZON = 5;

export async function loadPlatformData(horizon: number = DEFAULT_HORIZON): Promise<PlatformData> {
  const [bootstrap, fixtures] = await Promise.all([getBootstrapStatic(), getFixtures()]);
  const horizonGws = getHorizonGameweeks(bootstrap.events, horizon);
  const gamesElapsed = getNextGameweek(bootstrap.events) - 1;
  const clubs = bootstrap.teams.map(mapClub);
  const teamStrength = buildTeamStrengthMap(bootstrap.teams);
  const basePlayers = bootstrap.elements.map(mapBasePlayer);
  const players = buildPlayers(basePlayers, fixtures, horizonGws, teamStrength, gamesElapsed);

  return { players, clubs, events: bootstrap.events, fixtures, horizonGws };
}
