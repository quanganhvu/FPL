import type { ChipStrategyResponse, ChipWindow, Club, GameweekFixtureCount, Player, TeamSummary } from "@fpl/shared";
import type { RawFixture } from "../fpl-client/fixtures.js";
import { getGameweekFixtureCounts } from "../domain/fdr.js";
import { solveSquadModel, toOptimizerResult, scoreSquad } from "./optimizer/solveSquad.js";

const BLANK_GW_CLUB_THRESHOLD = 6;
const WILDCARD_GAP_THRESHOLD = 8;
const WILDCARD_WINDOW_SPLIT_GW = 19; // FPL's two wildcards roughly split the season here

function buildBlankDoubleRecommendations(
  gwCounts: GameweekFixtureCount[],
  squad: Player[]
): ChipWindow[] {
  const recommendations: ChipWindow[] = [];

  for (const { gw, blankClubIds, doubleClubIds } of gwCounts) {
    if (blankClubIds.length >= BLANK_GW_CLUB_THRESHOLD) {
      const affected = squad.filter((p) => blankClubIds.includes(p.clubId));
      const scoreImpact = affected.reduce((sum, p) => sum + p.predictedNextGw, 0);
      recommendations.push({
        chip: "free-hit",
        gw,
        reason: `${blankClubIds.length} clubs have no fixture - ${affected.length} of your squad affected`,
        scoreImpact
      });
    }

    if (doubleClubIds.length > 0) {
      const doubleSquadPlayers = squad.filter((p) => doubleClubIds.includes(p.clubId));
      if (doubleSquadPlayers.length === 0) continue;

      const benchBoostImpact = doubleSquadPlayers.reduce((sum, p) => sum + p.predictedNextGw, 0);
      const bestDoublePlayer = doubleSquadPlayers.reduce((best, p) =>
        p.predictedNextGw > best.predictedNextGw ? p : best
      );

      if (benchBoostImpact >= bestDoublePlayer.predictedNextGw) {
        recommendations.push({
          chip: "bench-boost",
          gw,
          reason: `${doubleSquadPlayers.length} of your squad have a double fixture`,
          scoreImpact: benchBoostImpact
        });
      } else {
        recommendations.push({
          chip: "triple-captain",
          gw,
          reason: `${bestDoublePlayer.webName} has a double fixture and the best form in your squad`,
          scoreImpact: bestDoublePlayer.predictedNextGw
        });
      }
    }
  }

  return recommendations;
}

async function buildWildcardRecommendation(
  teamSummary: TeamSummary,
  playerById: Map<number, Player>,
  pool: Player[],
  budget: number,
  nextGw: number
): Promise<ChipWindow | undefined> {
  const currentHalf: [number, number] = nextGw <= WILDCARD_WINDOW_SPLIT_GW ? [1, WILDCARD_WINDOW_SPLIT_GW] : [WILDCARD_WINDOW_SPLIT_GW + 1, 38];
  const alreadyUsedThisHalf = teamSummary.chipsUsed.some(
    (c) => c.name === "wildcard" && c.event >= currentHalf[0] && c.event <= currentHalf[1]
  );
  if (alreadyUsedThisHalf) return undefined;

  // Score the current squad with the exact same formula the optimizer is judged
  // by (full startingXI + captain bonus + discounted bench), not a flat sum of
  // all 15 - otherwise this "gap" compares two different yardsticks.
  const currentStartingXI = teamSummary.picks
    .filter((p) => p.multiplier > 0)
    .map((p) => playerById.get(p.playerId))
    .filter((p): p is Player => p !== undefined);
  const currentBench = teamSummary.picks
    .filter((p) => p.multiplier === 0)
    .map((p) => playerById.get(p.playerId))
    .filter((p): p is Player => p !== undefined);
  const currentCaptainId = teamSummary.picks.find((p) => p.isCaptain)?.playerId;
  const currentCaptain = currentCaptainId ? playerById.get(currentCaptainId) : undefined;
  if (!currentCaptain) return undefined;

  const currentPredicted = scoreSquad(currentStartingXI, currentBench, currentCaptain);

  try {
    const solved = await solveSquadModel({ players: pool, budget });
    const best = toOptimizerResult(solved);
    const gap = best.predictedPoints - currentPredicted;
    if (gap > WILDCARD_GAP_THRESHOLD) {
      return {
        chip: "wildcard",
        gw: nextGw,
        reason: `An optimal squad at your budget scores ~${gap.toFixed(1)} more points over the horizon than your current squad`,
        scoreImpact: gap
      };
    }
  } catch {
    // optimizer infeasible - skip wildcard suggestion rather than fail the whole response
  }
  return undefined;
}

export async function getChipStrategy(
  teamSummary: TeamSummary,
  players: Player[],
  clubs: Club[],
  fixtures: RawFixture[],
  upcomingGws: number[],
  budget: number
): Promise<ChipStrategyResponse> {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const squad = teamSummary.picks
    .map((pick) => playerById.get(pick.playerId))
    .filter((p): p is Player => p !== undefined);

  const clubIds = clubs.map((c) => c.id);
  const upcomingGameweeks = getGameweekFixtureCounts(fixtures, upcomingGws, clubIds);
  const recommendations = buildBlankDoubleRecommendations(upcomingGameweeks, squad);

  const nextGw = upcomingGws[0];
  if (nextGw !== undefined) {
    const wildcard = await buildWildcardRecommendation(teamSummary, playerById, players, budget, nextGw);
    if (wildcard) recommendations.push(wildcard);
  }

  return { upcomingGameweeks, recommendations };
}
