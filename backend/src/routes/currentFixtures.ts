import type { FastifyInstance } from "fastify";
import type { LiveFixture } from "@fpl/shared";
import { loadPlatformData } from "../domain/dataService.js";
import { getCurrentGameweek } from "../domain/gameweeks.js";

export default async function currentFixturesRoutes(app: FastifyInstance) {
  app.get("/api/fixtures/current", async (): Promise<LiveFixture[]> => {
    const { clubs, events, fixtures } = await loadPlatformData();
    const gw = getCurrentGameweek(events);
    const clubById = new Map(clubs.map((c) => [c.id, c]));

    return fixtures
      .filter((f) => f.event === gw)
      .map((f) => ({
        id: f.id,
        gw,
        homeClubId: f.team_h,
        homeShortName: clubById.get(f.team_h)?.shortName ?? "???",
        awayClubId: f.team_a,
        awayShortName: clubById.get(f.team_a)?.shortName ?? "???",
        homeScore: f.team_h_score,
        awayScore: f.team_a_score,
        started: f.started ?? false,
        finished: f.finished,
        finishedProvisional: f.finished_provisional,
        kickoffTime: f.kickoff_time
      }))
      .sort((a, b) => (a.kickoffTime ?? "").localeCompare(b.kickoffTime ?? ""));
  });
}
