export type Position = "GKP" | "DEF" | "MID" | "FWD";

export type PlayerStatus = "a" | "d" | "i" | "s" | "u" | "n";

export interface Club {
  id: number;
  name: string;
  shortName: string;
  strength: number;
}

export interface Player {
  id: number;
  webName: string;
  fullName: string;
  position: Position;
  clubId: number;
  nowCost: number; // tenths of a million, e.g. 105 = £10.5m
  form: number;
  pointsPerGame: number;
  epNext: number;
  ictIndex: number;
  selectedByPercent: number;
  status: PlayerStatus;
  chanceOfPlayingNextRound: number | null;
  predictedNextGw: number;
  predictedOverHorizon: number;
}

export interface Fixture {
  id: number;
  event: number | null; // gameweek number, null if unscheduled
  homeClubId: number;
  awayClubId: number;
  homeDifficulty: number;
  awayDifficulty: number;
  finished: boolean;
}

export interface GameweekEvent {
  id: number;
  deadlineTime: string;
  isCurrent: boolean;
  isNext: boolean;
  finished: boolean;
}

export interface Pick {
  playerId: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  multiplier: number;
  sellingPrice: number;
}

export interface ChipUsage {
  name: string;
  event: number;
}

export interface TeamSummary {
  teamId: number;
  managerName: string;
  bank: number;
  teamValue: number;
  overallRank: number | null;
  picks: Pick[];
  chipsUsed: ChipUsage[];
  freeTransfers: number;
  /**
   * False before a gameweek's deadline has passed for this team (e.g. pre-season,
   * or a brand-new entry that hasn't set a squad yet) - the public FPL API only
   * exposes a team's picks once they're locked in. `picks`/`bank`/`teamValue` are
   * best-effort zero/empty in that case, not real data.
   */
  picksAvailable: boolean;
}

export interface TransferSwap {
  out: Player;
  in: Player;
}

export interface TransferOption {
  transfersUsed: number;
  netPredictedPoints: number;
  hitCost: number;
  swaps: TransferSwap[];
}

export interface CaptainPick {
  player: Player;
  predictedPoints: number;
  rationale: string;
}

export interface GameweekFixtureCount {
  gw: number;
  blankClubIds: number[];
  doubleClubIds: number[];
}

export interface ChipWindow {
  chip: "wildcard" | "free-hit" | "bench-boost" | "triple-captain";
  gw: number;
  reason: string;
  scoreImpact: number;
}

export interface ChipStrategyResponse {
  upcomingGameweeks: GameweekFixtureCount[];
  recommendations: ChipWindow[];
}

export interface OptimizerRequest {
  horizon?: number;
  budgetOverride?: number;
  lockPlayers?: number[];
  excludePlayers?: number[];
}

export interface OptimizerResult {
  squad: Player[];
  startingXI: Player[];
  bench: Player[];
  formation: string;
  captain: Player;
  totalCost: number;
  predictedPoints: number;
}
