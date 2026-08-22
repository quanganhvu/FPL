import type { Player } from "@fpl/shared";
import type { RawFixture } from "../fpl-client/fixtures.js";
import { getClubFixturesInGw, type ClubFixture } from "../domain/fdr.js";
import type { BasePlayer } from "../domain/mappers.js";
import type { TeamStrength } from "../domain/teamStrength.js";
import { predictWithModel, hasModelForPosition } from "./mlModel.js";
import { shrinkRate, type FeatureVector } from "./features.js";

const HORIZON_DECAY = 0.9;

// --- Heuristic fallback model (used only when no trained ML model covers a
// position, or team-strength data is unavailable for a fixture) ---

// Crowd-wisdom tiebreaker, bidirectional: ownership meaningfully above the
// "unremarkable" baseline nudges a player up (heavily-owned = more likely a
// known/nailed starter); ownership near zero nudges a player down. Small flat
// adjustment, applied once - NOT folded into underlyingPPG (a "small"
// per-gameweek nudge there compounds across the horizon and all 11 starters,
// which once inflated total predicted points by ~18).
const OWNERSHIP_BASELINE_PERCENT = 5;
const OWNERSHIP_CAP_PERCENT = 25;
const OWNERSHIP_WEIGHT = 0.015;

// Rotation-risk floor/ceiling: a player who starts every game gets the full
// 1.0 multiplier; a player with zero starts despite games having been played
// is discounted to ROTATION_FLOOR rather than zeroed out entirely (injury/
// suspension is already handled separately by availabilityMultiplier).
const ROTATION_FLOOR = 0.4;

export function ownershipAdjustment(player: BasePlayer): number {
  const clamped = Math.min(player.selectedByPercent, OWNERSHIP_CAP_PERCENT);
  return OWNERSHIP_WEIGHT * (clamped - OWNERSHIP_BASELINE_PERCENT);
}

// Sample-size shrinkage (see features.ts's shrinkRate for the full rationale -
// the same single-lucky-game problem applies here as it does to the ML model's
// inputs, just for the heuristic fallback's own raw form/pointsPerGame use).
export function underlyingPPG(player: BasePlayer): number {
  const shrunkForm = shrinkRate(player.form, player.starts);
  const shrunkPointsPerGame = shrinkRate(player.pointsPerGame, player.starts);
  return 0.7 * shrunkForm + 0.3 * shrunkPointsPerGame;
}

export function fixtureMultiplier(fdr: number): number {
  return 1.3 - 0.15 * (fdr - 1);
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

// --- ML model integration ---
// The trained model (backend/scripts/trainModel.ts) predicts a 5-gameweek
// forward-looking AVERAGE rate, given one reference fixture's context. That
// makes it fundamentally different from the old per-gameweek heuristic: it
// must be computed ONCE per player (from their next fixture) and reused as a
// flat rate across the whole horizon - calling it again per future gameweek
// and summing the results would sum several overlapping 5-week-average
// estimates on top of each other (this exact bug inflated total predicted
// points from ~95 to ~150 before being caught in verification). Blank/double
// gameweeks still scale the total via fixture COUNT for that specific week,
// not by re-deriving the rate.

function isValidStrength(s: TeamStrength): boolean {
  // Real Premier League teams all carry strength ratings in the ~1000-1400 range.
  // Very early in a season FPL hasn't populated these yet (all teams read 0), and a
  // club that isn't actually in the PL this season reads 0 permanently - either way,
  // standardizing that extreme an outlier makes the linear model extrapolate to
  // nonsense (one such case scored 3-4x higher than an elite proven alternative),
  // so treat it as invalid and fall back to the heuristic, which has no dependency
  // on team strength at all.
  return s.attackHome > 0 && s.attackAway > 0 && s.defenceHome > 0 && s.defenceAway > 0;
}

function buildLiveFeatures(
  player: BasePlayer,
  fixture: ClubFixture,
  ownStrength: TeamStrength,
  oppStrength: TeamStrength,
  gamesElapsed: number
): FeatureVector {
  return {
    form: shrinkRate(player.form, player.starts),
    pointsPerGame: shrinkRate(player.pointsPerGame, player.starts),
    price: player.nowCost,
    isHome: fixture.isHome ? 1 : 0,
    ownStrengthAttack: fixture.isHome ? ownStrength.attackHome : ownStrength.attackAway,
    ownStrengthDefence: fixture.isHome ? ownStrength.defenceHome : ownStrength.defenceAway,
    oppStrengthAttack: fixture.isHome ? oppStrength.attackAway : oppStrength.attackHome,
    oppStrengthDefence: fixture.isHome ? oppStrength.defenceAway : oppStrength.defenceHome,
    ownershipLog: Math.log1p(player.selectedByPercent),
    xgi90: player.xgi90,
    minutesPerGame: gamesElapsed > 0 ? player.minutes / gamesElapsed : 0,
    startsCount: player.starts
  };
}

interface UnderlyingRate {
  rate: number; // expected points per gameweek, fixture-difficulty-aware but NOT yet fixture-count-scaled
  fromModel: boolean;
}

/**
 * The player's single "going rate" per gameweek, computed once from their
 * next fixture(s). Averages across fixtures for a double gameweek (each
 * independently estimates the same going rate, so this isn't a leak the way
 * summing per-gameweek-loop calls would be) and falls back to the
 * fixture-independent heuristic rate when no model/valid team-strength data
 * is available.
 */
function computeUnderlyingRate(
  player: BasePlayer,
  nextFixtures: ClubFixture[],
  teamStrength: Map<number, TeamStrength>,
  gamesElapsed: number
): UnderlyingRate {
  const modelPredictions: number[] = [];
  for (const fixture of nextFixtures) {
    const ownStrength = teamStrength.get(player.clubId);
    const oppStrength = teamStrength.get(fixture.opponentClubId);
    if (!ownStrength || !oppStrength || !isValidStrength(ownStrength) || !isValidStrength(oppStrength)) continue;
    const features = buildLiveFeatures(player, fixture, ownStrength, oppStrength, gamesElapsed);
    const prediction = predictWithModel(player.position, features);
    if (prediction !== undefined) modelPredictions.push(Math.max(0, prediction));
  }

  if (modelPredictions.length > 0) {
    const rate = modelPredictions.reduce((a, b) => a + b, 0) / modelPredictions.length;
    return { rate, fromModel: true };
  }

  // Heuristic fallback: blend the player's fixture-independent quality with this
  // week's fixture difficulty (or a neutral difficulty if there's no reference
  // fixture at all, e.g. a blank gameweek next).
  const avgDifficulty =
    nextFixtures.length > 0 ? nextFixtures.reduce((sum, f) => sum + f.difficulty, 0) / nextFixtures.length : 3;
  return { rate: underlyingPPG(player) * fixtureMultiplier(avgDifficulty), fromModel: false };
}

/** Points for one gameweek, given an already-computed going rate: rate x fixture count that week. */
function predictedFromFixtures(
  player: BasePlayer,
  fixtures: RawFixture[],
  gw: number,
  rate: number,
  gamesElapsed: number
): number {
  const clubFixtures = getClubFixturesInGw(fixtures, player.clubId, gw);
  if (clubFixtures.length === 0) return 0; // blank gameweek for this player's club
  return availabilityMultiplier(player) * rotationMultiplier(player, gamesElapsed) * rate * clubFixtures.length;
}

export function buildPlayers(
  basePlayers: BasePlayer[],
  fixtures: RawFixture[],
  horizonGws: number[],
  teamStrength: Map<number, TeamStrength>,
  gamesElapsed: number
): Player[] {
  return basePlayers.map((base) => {
    const nextGw = horizonGws[0];
    const nextFixtures = nextGw !== undefined ? getClubFixturesInGw(fixtures, base.clubId, nextGw) : [];
    const { rate, fromModel } = computeUnderlyingRate(base, nextFixtures, teamStrength, gamesElapsed);

    // The ownership tiebreaker/skepticism nudge is already one of the ML model's own
    // learned features - only add it manually when the heuristic fallback was used,
    // to avoid double-counting the same signal.
    const bonus = fromModel ? 0 : ownershipAdjustment(base);

    const fromFixturesNextGw = nextGw !== undefined ? predictedFromFixtures(base, fixtures, nextGw, rate, gamesElapsed) : 0;
    const predictedNextGw = 0.5 * base.epNext + 0.5 * fromFixturesNextGw + bonus;

    const predictedHorizon =
      horizonGws.reduce((sum, gw, index) => {
        const points = index === 0 ? fromFixturesNextGw : predictedFromFixtures(base, fixtures, gw, rate, gamesElapsed);
        return sum + points * HORIZON_DECAY ** index;
      }, 0) + bonus;

    return {
      ...base,
      predictedNextGw,
      predictedOverHorizon: predictedHorizon
    };
  });
}
