import type { FastifyInstance } from "fastify";
import { loadPlatformData } from "../domain/dataService.js";

export default async function clubsRoutes(app: FastifyInstance) {
  app.get("/api/clubs", async () => {
    const { clubs } = await loadPlatformData();
    return clubs;
  });
}
