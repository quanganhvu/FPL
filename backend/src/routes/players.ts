import type { FastifyInstance } from "fastify";
import type { Player, Position } from "@fpl/shared";
import { loadPlatformData } from "../domain/dataService.js";

interface PlayersQuery {
  position?: Position;
  team?: string;
  maxPrice?: string;
  search?: string;
  sort?: "predictedPoints" | "form" | "price";
}

export default async function playersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: PlayersQuery }>("/api/players", async (request) => {
    const { position, team, maxPrice, search, sort } = request.query;
    const { players } = await loadPlatformData();

    let filtered: Player[] = players;
    if (position) filtered = filtered.filter((p) => p.position === position);
    if (team) filtered = filtered.filter((p) => p.clubId === Number(team));
    if (maxPrice) filtered = filtered.filter((p) => p.nowCost <= Number(maxPrice) * 10);
    if (search) {
      const needle = search.toLowerCase();
      filtered = filtered.filter(
        (p) => p.webName.toLowerCase().includes(needle) || p.fullName.toLowerCase().includes(needle)
      );
    }

    const sortKey = sort ?? "predictedPoints";
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "form") return b.form - a.form;
      if (sortKey === "price") return b.nowCost - a.nowCost;
      return b.predictedOverHorizon - a.predictedOverHorizon;
    });

    return sorted;
  });
}
