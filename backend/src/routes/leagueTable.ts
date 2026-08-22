import type { FastifyInstance } from "fastify";
import type { Club } from "@fpl/shared";
import { loadPlatformData } from "../domain/dataService.js";

export default async function leagueTableRoutes(app: FastifyInstance) {
  app.get("/api/league-table", async (): Promise<Club[]> => {
    const { clubs } = await loadPlatformData();
    return [...clubs].sort(
      (a, b) => (a.position || 999) - (b.position || 999) || b.points - a.points || a.name.localeCompare(b.name)
    );
  });
}
