import type { FastifyInstance } from "fastify";
import type { FixtureTickerClub } from "@fpl/shared";
import { loadPlatformData } from "../domain/dataService.js";
import { getHorizonGameweeks } from "../domain/gameweeks.js";
import { getClubFixturesInGw } from "../domain/fdr.js";

interface TickerQuery {
  horizon?: string;
}

const DEFAULT_TICKER_HORIZON = 10;

export default async function fixtureTickerRoutes(app: FastifyInstance) {
  app.get<{ Querystring: TickerQuery }>("/api/fixtures/ticker", async (request) => {
    const horizon = request.query.horizon ? Number(request.query.horizon) : DEFAULT_TICKER_HORIZON;
    const { clubs, events, fixtures } = await loadPlatformData();
    const gws = getHorizonGameweeks(events, horizon);
    const clubById = new Map(clubs.map((c) => [c.id, c]));

    const result: FixtureTickerClub[] = clubs
      .map((club) => ({
        clubId: club.id,
        shortName: club.shortName,
        fixtures: gws.flatMap((gw) => {
          const clubFixtures = getClubFixturesInGw(fixtures, club.id, gw);
          return clubFixtures.map((f) => ({
            gw,
            opponentShortName: clubById.get(f.opponentClubId)?.shortName ?? "???",
            difficulty: f.difficulty,
            isHome: f.isHome
          }));
        })
      }))
      .sort((a, b) => a.shortName.localeCompare(b.shortName));

    return result;
  });
}
