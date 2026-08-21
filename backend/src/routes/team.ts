import type { FastifyInstance } from "fastify";
import type { Player } from "@fpl/shared";
import { loadPlatformData } from "../domain/dataService.js";
import { getTeamSummary } from "../domain/teamService.js";
import { getCaptainPicks } from "../engine/captaincy.js";
import { getTransferSuggestions } from "../engine/optimizer/transferSuggestions.js";

interface TeamParams {
  teamId: string;
}

interface TransferQuery {
  horizon?: string;
  maxTransfers?: string;
}

const NOT_AVAILABLE_MESSAGE =
  "This team has no locked-in squad yet - the public FPL API only exposes picks once a gameweek's deadline has passed.";

function squadBudget(teamSummary: { bank: number; picks: { sellingPrice: number }[] }): number {
  return teamSummary.bank + teamSummary.picks.reduce((sum, p) => sum + p.sellingPrice, 0);
}

export default async function teamRoutes(app: FastifyInstance) {
  app.get<{ Params: TeamParams }>("/api/team/:teamId/summary", async (request) => {
    const teamId = Number(request.params.teamId);
    const { players, events } = await loadPlatformData();
    return getTeamSummary(teamId, players, events);
  });

  app.get<{ Params: TeamParams }>("/api/team/:teamId/captain-picks", async (request) => {
    const teamId = Number(request.params.teamId);
    const { players, events, fixtures, horizonGws } = await loadPlatformData();
    const teamSummary = await getTeamSummary(teamId, players, events);
    if (!teamSummary.picksAvailable) {
      return { available: false, message: NOT_AVAILABLE_MESSAGE, picks: [] };
    }
    const picks = getCaptainPicks(teamSummary, players, fixtures, horizonGws[0]);
    return { available: true, picks };
  });

  app.get<{ Params: TeamParams; Querystring: TransferQuery }>(
    "/api/team/:teamId/transfer-suggestions",
    async (request) => {
      const teamId = Number(request.params.teamId);
      const horizon = request.query.horizon ? Number(request.query.horizon) : 5;
      const maxTransfers = request.query.maxTransfers ? Number(request.query.maxTransfers) : 3;

      const { players, events } = await loadPlatformData(horizon);
      const teamSummary = await getTeamSummary(teamId, players, events);
      if (!teamSummary.picksAvailable) {
        return { available: false, message: NOT_AVAILABLE_MESSAGE, options: [] };
      }

      const playerById = new Map(players.map((p) => [p.id, p]));
      const currentSquad = teamSummary.picks
        .map((pick) => playerById.get(pick.playerId))
        .filter((p): p is Player => p !== undefined);

      const budget = squadBudget(teamSummary);
      const options = await getTransferSuggestions(currentSquad, players, budget, teamSummary.freeTransfers, maxTransfers);
      return { available: true, options };
    }
  );
}
