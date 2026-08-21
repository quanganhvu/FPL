import type { FastifyInstance } from "fastify";
import type { OptimizerRequest } from "@fpl/shared";
import { loadPlatformData } from "../domain/dataService.js";
import { getTeamSummary } from "../domain/teamService.js";
import { solveSquadModel, toOptimizerResult } from "../engine/optimizer/solveSquad.js";

interface OptimizeParams {
  teamId: string;
}

// The standard starting budget every manager gets - used when a team has no
// locked-in squad yet (pre-season) and the caller didn't supply budgetOverride.
const DEFAULT_STARTING_BUDGET = 1000; // £100.0m in tenths

export default async function optimizeRoutes(app: FastifyInstance) {
  app.post<{ Params: OptimizeParams; Body: OptimizerRequest }>(
    "/api/team/:teamId/optimize-squad",
    async (request) => {
      const teamId = Number(request.params.teamId);
      const { horizon, budgetOverride, lockPlayers, excludePlayers, formation } = request.body ?? {};

      const { players, events } = await loadPlatformData(horizon);
      let budget = budgetOverride;
      if (budget === undefined) {
        const teamSummary = await getTeamSummary(teamId, players, events);
        budget = teamSummary.picksAvailable
          ? teamSummary.bank + teamSummary.picks.reduce((sum, p) => sum + p.sellingPrice, 0)
          : DEFAULT_STARTING_BUDGET;
      }

      const solved = await solveSquadModel({ players, budget, lockPlayers, excludePlayers, formation });
      return toOptimizerResult(solved);
    }
  );
}
