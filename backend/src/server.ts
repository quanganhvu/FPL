import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.js";
import playersRoutes from "./routes/players.js";
import teamRoutes from "./routes/team.js";
import chipsRoutes from "./routes/chips.js";
import optimizeRoutes from "./routes/optimize.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.FRONTEND_ORIGIN });

await app.register(healthRoutes);
await app.register(playersRoutes);
await app.register(teamRoutes);
await app.register(chipsRoutes);
await app.register(optimizeRoutes);

app.listen({ port: env.PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`FPL backend listening at ${address}`);
});
