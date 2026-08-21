import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../backend/src/app.js";

// One Fastify instance per warm lambda - reused across invocations while the
// container stays alive, rebuilt on a cold start.
let appPromise: Promise<FastifyInstance> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = buildApp();
  const app = await appPromise;
  await app.ready();
  app.server.emit("request", req, res);
}
