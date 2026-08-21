import type { FastifyInstance } from "fastify";
import type { GameweekEvent } from "@fpl/shared";
import { loadPlatformData } from "../domain/dataService.js";
import { getNextGameweek } from "../domain/gameweeks.js";

export default async function gameweekRoutes(app: FastifyInstance) {
  app.get("/api/gameweek", async (): Promise<GameweekEvent> => {
    const { events } = await loadPlatformData();
    const nextGwId = getNextGameweek(events);
    const event = events.find((e) => e.id === nextGwId)!;
    return {
      id: event.id,
      deadlineTime: event.deadline_time,
      isCurrent: event.is_current,
      isNext: event.is_next,
      finished: event.finished
    };
  });
}
