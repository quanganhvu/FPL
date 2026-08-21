import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.js";
import playersRoutes from "./routes/players.js";
import teamRoutes from "./routes/team.js";
import chipsRoutes from "./routes/chips.js";
import optimizeRoutes from "./routes/optimize.js";
import clubsRoutes from "./routes/clubs.js";
import gameweekRoutes from "./routes/gameweek.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.FRONTEND_ORIGIN });

  await app.register(healthRoutes);
  await app.register(playersRoutes);
  await app.register(teamRoutes);
  await app.register(chipsRoutes);
  await app.register(optimizeRoutes);
  await app.register(clubsRoutes);
  await app.register(gameweekRoutes);

  return app;
}
