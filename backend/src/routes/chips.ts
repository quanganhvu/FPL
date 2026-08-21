import type { FastifyInstance } from "fastify";
import { loadPlatformData } from "../domain/dataService.js";
import { getTeamSummary } from "../domain/teamService.js";
import { getChipStrategy } from "../engine/chipStrategy.js";
import { getHorizonGameweeks } from "../domain/gameweeks.js";

interface ChipsQuery {
  teamId: string;
}

const CHIP_LOOKAHEAD_GWS = 8;

export default async function chipsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ChipsQuery }>("/api/chip-strategy", async (request, reply) => {
    const teamId = Number(request.query.teamId);
    if (!teamId) {
      reply.code(400);
      return { error: "teamId query parameter is required" };
    }

    const { players, clubs, events, fixtures } = await loadPlatformData();
    const teamSummary = await getTeamSummary(teamId, players, events);
    if (!teamSummary.picksAvailable) {
      return {
        available: false,
        message:
          "This team has no locked-in squad yet - the public FPL API only exposes picks once a gameweek's deadline has passed.",
        upcomingGameweeks: [],
        recommendations: []
      };
    }

    const upcomingGws = getHorizonGameweeks(events, CHIP_LOOKAHEAD_GWS);
    const budget = teamSummary.bank + teamSummary.picks.reduce((sum, p) => sum + p.sellingPrice, 0);

    const strategy = await getChipStrategy(teamSummary, players, clubs, fixtures, upcomingGws, budget);
    return { available: true, ...strategy };
  });
}
