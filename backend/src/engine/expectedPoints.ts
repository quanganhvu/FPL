import type { Player } from "@fpl/shared";
import type { RawFixture } from "../fpl-client/fixtures.js";
import { getClubFixturesInGw } from "../domain/fdr.js";
import type { BasePlayer } from "../domain/mappers.js";

const HORIZON_DECAY = 0.9;

// Soft crowd-wisdom tiebreaker: heavily-owned players are more likely to be
// known/nailed starters. This is a small FLAT nudge applied once to the final
// predicted-points figures (see buildPlayers) - NOT folded into underlyingPPG,
// because underlyingPPG gets multiplied by fixture strength and re-summed
// across every gameweek in the horizon, so even a "small" per-gameweek bonus
// there compounds into a large one (a 0.5pt/gw nudge across 11 starters over
// a 5-gameweek decayed horizon inflated total predicted points by ~18). Capped
// low so it can only break near-ties, never outweigh real observed performance.
const OWNERSHIP_BONUS_CAP_PERCENT = 25;
const OWNERSHIP_BONUS_WEIGHT = 0.01;

// Rotation-risk floor/ceiling: a player who starts every game gets the full
// 1.0 multiplier; a player with zero starts despite games having been played
// is discounted to ROTATION_FLOOR rather than zeroed out entirely (injury/
// suspension is already handled separately by availabilityMultiplier).
const ROTATION_FLOOR = 0.4;

/** Small flat tiebreaker (max 0.25 pts), added once - not per-gameweek, not fixture-scaled. */
export function ownershipBonus(player: BasePlayer): number {
  return OWNERSHIP_BONUS_WEIGHT * Math.min(player.selectedByPercent, OWNERSHIP_BONUS_CAP_PERCENT);
}

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

/**
 * Discounts players who aren't actually starting for their club - a signal
 * FPL's raw form/points_per_game don't fully capture on their own, especially
 * early in the season when sample sizes are tiny. `gamesElapsed` is how many
 * gameweeks have been played so far; with none played yet there's no rotation
 * data at all, so this is a no-op (full multiplier) until there is.
 */
export function rotationMultiplier(player: BasePlayer, gamesElapsed: number): number {
  if (gamesElapsed <= 0) return 1.0;
  const startRate = Math.min(1, player.starts / gamesElapsed);
  return ROTATION_FLOOR + (1 - ROTATION_FLOOR) * startRate;
}

export function fixtureMultiplier(fdr: number): number {
  return 1.3 - 0.15 * (fdr - 1);
}

/** Raw fixture-driven prediction for one gameweek, ignoring ep_next blending. */
function predictedFromFixtures(player: BasePlayer, fixtures: RawFixture[], gw: number, gamesElapsed: number): number {
  const clubFixtures = getClubFixturesInGw(fixtures, player.clubId, gw);
  if (clubFixtures.length === 0) return 0; // blank gameweek for this player's club
  const fixtureSum = clubFixtures.reduce((sum, f) => sum + fixtureMultiplier(f.difficulty), 0);
  return underlyingPPG(player) * availabilityMultiplier(player) * rotationMultiplier(player, gamesElapsed) * fixtureSum;
}

/** Predicted points for a single gameweek. Blends in FPL's own ep_next when this is the immediate next GW. */
export function predictedForGw(
  player: BasePlayer,
  fixtures: RawFixture[],
  gw: number,
  isImmediateNext: boolean,
  gamesElapsed: number
): number {
  const fromFixtures = predictedFromFixtures(player, fixtures, gw, gamesElapsed);
  if (!isImmediateNext) return fromFixtures;
  return 0.5 * player.epNext + 0.5 * fromFixtures;
}

/** Decayed sum of predicted points across a horizon of gameweeks. gws[0] is treated as the immediate next GW. */
export function predictedOverHorizon(
  player: BasePlayer,
  fixtures: RawFixture[],
  gws: number[],
  gamesElapsed: number
): number {
  return gws.reduce((sum, gw, index) => {
    const predicted = predictedForGw(player, fixtures, gw, index === 0, gamesElapsed);
    return sum + predicted * HORIZON_DECAY ** index;
  }, 0);
}

export function buildPlayers(
  basePlayers: BasePlayer[],
  fixtures: RawFixture[],
  horizonGws: number[],
  gamesElapsed: number
): Player[] {
  return basePlayers.map((base) => {
    const bonus = ownershipBonus(base);
    const predictedNextGw = (horizonGws.length > 0 ? predictedForGw(base, fixtures, horizonGws[0], true, gamesElapsed) : 0) + bonus;
    const predictedHorizon = predictedOverHorizon(base, fixtures, horizonGws, gamesElapsed) + bonus;
    return {
      ...base,
      predictedNextGw,
      predictedOverHorizon: predictedHorizon
    };
  });
}
