import type { Player } from "@fpl/shared";
import type { RawFixture } from "../fpl-client/fixtures.js";
import { getClubFixturesInGw } from "../domain/fdr.js";
import type { BasePlayer } from "../domain/mappers.js";

const HORIZON_DECAY = 0.9;

export function underlyingPPG(player: BasePlayer): number {
  return 0.7 * player.form + 0.3 * player.pointsPerGame;
}

export function availabilityMultiplier(player: BasePlayer): number {
  if (player.chanceOfPlayingNextRound !== null) {
    return player.chanceOfPlayingNextRound / 100;
  }
  switch (player.status) {
    case "a":
      return 1.0;
    case "d":
      return 0.5;
    default:
      return 0.0; // i (injured), s (suspended), u (unavailable), n (not in squad)
  }
}

export function fixtureMultiplier(fdr: number): number {
  return 1.3 - 0.15 * (fdr - 1);
}

/** Raw fixture-driven prediction for one gameweek, ignoring ep_next blending. */
function predictedFromFixtures(player: BasePlayer, fixtures: RawFixture[], gw: number): number {
  const clubFixtures = getClubFixturesInGw(fixtures, player.clubId, gw);
  if (clubFixtures.length === 0) return 0; // blank gameweek for this player's club
  const fixtureSum = clubFixtures.reduce((sum, f) => sum + fixtureMultiplier(f.difficulty), 0);
  return underlyingPPG(player) * availabilityMultiplier(player) * fixtureSum;
}

/** Predicted points for a single gameweek. Blends in FPL's own ep_next when this is the immediate next GW. */
export function predictedForGw(
  player: BasePlayer,
  fixtures: RawFixture[],
  gw: number,
  isImmediateNext: boolean
): number {
  const fromFixtures = predictedFromFixtures(player, fixtures, gw);
  if (!isImmediateNext) return fromFixtures;
  return 0.5 * player.epNext + 0.5 * fromFixtures;
}

/** Decayed sum of predicted points across a horizon of gameweeks. gws[0] is treated as the immediate next GW. */
export function predictedOverHorizon(player: BasePlayer, fixtures: RawFixture[], gws: number[]): number {
  return gws.reduce((sum, gw, index) => {
    const predicted = predictedForGw(player, fixtures, gw, index === 0);
    return sum + predicted * HORIZON_DECAY ** index;
  }, 0);
}

export function buildPlayers(basePlayers: BasePlayer[], fixtures: RawFixture[], horizonGws: number[]): Player[] {
  return basePlayers.map((base) => {
    const predictedNextGw = horizonGws.length > 0 ? predictedForGw(base, fixtures, horizonGws[0], true) : 0;
    const predictedHorizon = predictedOverHorizon(base, fixtures, horizonGws);
    return {
      ...base,
      predictedNextGw,
      predictedOverHorizon: predictedHorizon
    };
  });
}
