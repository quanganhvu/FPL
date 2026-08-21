import type { RawEvent } from "../fpl-client/bootstrap.js";

export function getNextGameweek(events: RawEvent[]): number {
  const next = events.find((e) => e.is_next) ?? events.find((e) => !e.finished);
  if (!next) throw new Error("Could not determine next gameweek - season may be over or bootstrap data is stale");
  return next.id;
}

export function getCurrentGameweek(events: RawEvent[]): number {
  const current = events.find((e) => e.is_current);
  if (current) return current.id;
  // between seasons / before GW1: fall back to the last finished event, or the next one
  const lastFinished = [...events].reverse().find((e) => e.finished);
  return lastFinished?.id ?? getNextGameweek(events);
}

export function getHorizonGameweeks(events: RawEvent[], horizon: number): number[] {
  const start = getNextGameweek(events);
  const maxGw = Math.max(...events.map((e) => e.id));
  const gws: number[] = [];
  for (let gw = start; gw < start + horizon && gw <= maxGw; gw++) {
    gws.push(gw);
  }
  return gws;
}
