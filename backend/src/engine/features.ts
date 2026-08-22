/**
 * The single feature-vector definition used by both the offline training
 * script (backend/scripts/trainModel.ts, built from historical CSV rows) and
 * live runtime inference (built from the current FPL API data). Keeping one
 * shared shape/ordering here - rather than two hand-synced implementations -
 * is the concrete guard against train/serve skew.
 *
 * Every feature is chosen to be cheaply available in BOTH contexts without
 * extra per-player API calls at request time: FPL's own bootstrap-static
 * aggregates (form, points_per_game, expected_goal_involvements_per_90, etc.)
 * mirror what's computable as running/cumulative aggregates from historical
 * per-gameweek rows.
 */
export interface FeatureVector {
  /** Pre-shrunk (see shrinkRate below), NOT the raw FPL "form" field. */
  form: number;
  /** Pre-shrunk (see shrinkRate below), NOT the raw points_per_game field. */
  pointsPerGame: number;
  price: number; // tenths of a million, e.g. 105 = £10.5m
  isHome: number; // 1 or 0
  ownStrengthAttack: number;
  ownStrengthDefence: number;
  oppStrengthAttack: number;
  oppStrengthDefence: number;
  ownershipLog: number; // log1p of an ownership-ish measure (percent live, raw count historically)
  xgi90: number; // expected goal involvements (xG + xA) per 90 minutes
  minutesPerGame: number; // season-average minutes per gameweek appeared - a nailed-on/rotation-risk proxy
  /** Cumulative starts so far this season - see shrinkRate below for why this
   * needs to reach past a raw feature slot too, not just sit as its own input. */
  startsCount: number;
}

export const FEATURE_KEYS: (keyof FeatureVector)[] = [
  "form",
  "pointsPerGame",
  "price",
  "isHome",
  "ownStrengthAttack",
  "ownStrengthDefence",
  "oppStrengthAttack",
  "oppStrengthDefence",
  "ownershipLog",
  "xgi90",
  "minutesPerGame",
  "startsCount"
];

export function featureToVector(f: FeatureVector): number[] {
  return FEATURE_KEYS.map((k) => f[k]);
}

const FULL_CONFIDENCE_STARTS = 10;
const NEUTRAL_RATE_PRIOR = 1.0;

/**
 * Shrinks a per-gameweek rate (form or points-per-game) toward a conservative
 * neutral prior, proportionally to how few starts support it. A *linear*
 * model cannot learn this on its own even when given raw rate and startsCount
 * as separate inputs - "trust the rate more when starts is high" is a
 * multiplicative interaction, and a linear model can only add independent
 * per-feature contributions. Concretely: without this, a player who had one
 * huge game (e.g. points_per_game=11 from a single start) got a wildly
 * inflated prediction, on the same order of magnitude as an elite player's
 * entire multi-gameweek horizon total - the model had no way to discount a
 * single-game sample the way this shrinkage (already validated for the
 * heuristic formula earlier) does explicitly.
 */
export function shrinkRate(rawRate: number, starts: number): number {
  const confidence = Math.min(1, starts / FULL_CONFIDENCE_STARTS);
  return confidence * rawRate + (1 - confidence) * NEUTRAL_RATE_PRIOR;
}
