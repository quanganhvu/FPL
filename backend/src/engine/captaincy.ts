import type { CaptainPick, Player, TeamSummary } from "@fpl/shared";
import type { RawFixture } from "../fpl-client/fixtures.js";
import { getClubFixturesInGw } from "../domain/fdr.js";

function buildRationale(player: Player, fixtures: RawFixture[], nextGw: number): string {
  const clubFixtures = getClubFixturesInGw(fixtures, player.clubId, nextGw);
  if (clubFixtures.length === 0) {
    return `No fixture this gameweek - form ${player.form.toFixed(1)}, but consider benching the armband.`;
  }
  const fixtureDescriptions = clubFixtures.map(
    (f) => `${f.isHome ? "Home" : "Away"} (FDR ${f.difficulty})`
  );
  return `${fixtureDescriptions.join(", ")} - form ${player.form.toFixed(1)} pts/gw.`;
}

export function getCaptainPicks(
  teamSummary: TeamSummary,
  players: Player[],
  fixtures: RawFixture[],
  nextGw: number,
  topN = 3
): CaptainPick[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const squad = teamSummary.picks
    .map((pick) => playerById.get(pick.playerId))
    .filter((p): p is Player => p !== undefined);

  return [...squad]
    .sort((a, b) => b.predictedNextGw - a.predictedNextGw)
    .slice(0, topN)
    .map((player) => ({
      player,
      predictedPoints: player.predictedNextGw,
      rationale: buildRationale(player, fixtures, nextGw)
    }));
}
