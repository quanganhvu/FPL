import type { Player } from "@fpl/shared";
import type { RawFixture } from "../fpl-client/fixtures.js";
import { getClubFixturesInGw } from "../domain/fdr.js";
import type { BasePlayer } from "../domain/mappers.js";

const HORIZON_DECAY = 0.9;

// Crowd-wisdom tiebreaker, bidirectional: ownership meaningfully above the
// "unremarkable" baseline nudges a player up (heavily-owned = more likely a
// known/nailed starter); ownership near zero nudges a player down (the wider
// FPL base is quietly skeptical, often for reasons - competition for a
// place, a new signing settling in - that raw box-score numbers don't show).
// This is a small FLAT adjustment applied once to the final predicted-points
// figures (see buildPlayers) - NOT folded into underlyingPPG, because
// underlyingPPG gets multiplied by fixture strength and re-summed across
// every gameweek in the horizon, so even a "small" per-gameweek nudge there
// compounds into a large one (a 0.5pt/gw nudge across 11 starters over a
// 5-gameweek decayed horizon once inflated total predicted points by ~18).
// Kept small so it can only break near-ties, never outweigh real observed
// performance.
const OWNERSHIP_BASELINE_PERCENT = 5;
const OWNERSHIP_CAP_PERCENT = 25;
const OWNERSHIP_WEIGHT = 0.015;

// Rotation-risk floor/ceiling: a player who starts every game gets the full
// 1.0 multiplier; a player with zero starts despite games having been played
// is discounted to ROTATION_FLOOR rather than zeroed out entirely (injury/
// suspension is already handled separately by availabilityMultiplier).
const ROTATION_FLOOR = 0.4;

// A single standout game is a far noisier estimate of a player's true level
// than a full season is - without this, a player with e.g. 1 start and an
// unusually good points_per_game average gets trusted exactly as much as an
// established starter with 38 starts and a lower, but far more reliable,
// average. FULL_CONFIDENCE_STARTS is the sample size at which pointsPerGame
// is trusted at face value; below that it's pulled toward a neutral baseline
// for a rostered top-flight player, proportionally to how little data exists.
const FULL_CONFIDENCE_STARTS = 10;
const NEUTRAL_PPG_PRIOR = 2.0;

/** Small flat tiebreaker/skepticism nudge (roughly -0.1 to +0.3 pts), added once. */
export function ownershipAdjustment(player: BasePlayer): number {
  const clamped = Math.min(player.selectedByPercent, OWNERSHIP_CAP_PERCENT);
  return OWNERSHIP_WEIGHT * (clamped - OWNERSHIP_BASELINE_PERCENT);
}

/** How much to trust the observed points_per_game average, based on sample size. */
export function ppgConfidence(player: BasePlayer): number {
  return Math.min(1, player.starts / FULL_CONFIDENCE_STARTS);
}

export function underlyingPPG(player: BasePlayer): number {
  const confidence = ppgConfidence(player);
  const shrunkPointsPerGame = confidence * player.pointsPerGame + (1 - confidence) * NEUTRAL_PPG_PRIOR;
  return 0.7 * player.form + 0.3 * shrunkPointsPerGame;
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
    const bonus = ownershipAdjustment(base);
    const predictedNextGw = (horizonGws.length > 0 ? predictedForGw(base, fixtures, horizonGws[0], true, gamesElapsed) : 0) + bonus;
    const predictedHorizon = predictedOverHorizon(base, fixtures, horizonGws, gamesElapsed) + bonus;
    return {
      ...base,
      predictedNextGw,
      predictedOverHorizon: predictedHorizon
    };
  });
}
