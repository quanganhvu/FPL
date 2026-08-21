import type { ChipUsage, Pick, TeamSummary, Player } from "@fpl/shared";
import {
  getEntry,
  getEntryHistory,
  getEntryPicks,
  type RawEntry,
  type RawHistoryEvent,
  type RawChip
} from "../fpl-client/entry.js";
import type { RawEvent } from "../fpl-client/bootstrap.js";

/**
 * FPL doesn't publicly expose remaining free transfers (that's an authenticated
 * /my-team/ field). This estimates it from transfer history under the 2024+ rules:
 * 1 FT/gw, banked up to 5, reset to +1 (not full reset) after a wildcard/free hit GW.
 * Approximate - can drift if the manager used a chip we can't see the exact effect of.
 */
function estimateFreeTransfers(historyCurrent: RawHistoryEvent[], chips: RawChip[]): number {
  const chipGws = new Set(chips.filter((c) => c.name === "wildcard" || c.name === "freehit").map((c) => c.event));
  const sorted = [...historyCurrent].sort((a, b) => a.event - b.event);
  let bank = 1;
  for (const gw of sorted) {
    if (gw.event === 1) continue;
    if (chipGws.has(gw.event)) {
      bank = Math.min(5, bank + 1);
      continue;
    }
    bank = Math.max(1, Math.min(5, bank - gw.event_transfers + 1));
  }
  return bank;
}

function unavailableSummary(entry: RawEntry, chipsUsed: ChipUsage[]): TeamSummary {
  return {
    teamId: entry.id,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`,
    bank: entry.last_deadline_bank ?? 0,
    teamValue: entry.last_deadline_value ?? 0,
    overallRank: entry.summary_overall_rank,
    picks: [],
    chipsUsed,
    freeTransfers: 1,
    picksAvailable: false
  };
}

export async function getTeamSummary(teamId: number, players: Player[], _events: RawEvent[]): Promise<TeamSummary> {
  const [entry, history] = await Promise.all([getEntry(teamId), getEntryHistory(teamId)]);
  const chipsUsed: ChipUsage[] = history.chips.map((c) => ({ name: c.name, event: c.event }));

  // The public API only exposes a gameweek's picks once its deadline has passed -
  // current_event is null before this entry has any locked-in squad (pre-season,
  // or a brand-new team ahead of GW1's deadline).
  if (entry.current_event === null) {
    return unavailableSummary(entry, chipsUsed);
  }

  let picksResponse;
  try {
    picksResponse = await getEntryPicks(teamId, entry.current_event);
  } catch {
    return unavailableSummary(entry, chipsUsed);
  }

  const playerById = new Map(players.map((p) => [p.id, p]));

  const picks: Pick[] = picksResponse.picks.map((pick) => ({
    playerId: pick.element,
    isCaptain: pick.is_captain,
    isViceCaptain: pick.is_vice_captain,
    multiplier: pick.multiplier,
    // Approximation: exact selling price needs the authenticated /my-team/ endpoint.
    sellingPrice: playerById.get(pick.element)?.nowCost ?? 0
  }));

  return {
    teamId: entry.id,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`,
    bank: entry.last_deadline_bank ?? 0,
    teamValue: entry.last_deadline_value ?? 0,
    overallRank: entry.summary_overall_rank,
    picks,
    chipsUsed,
    freeTransfers: estimateFreeTransfers(history.current, history.chips),
    picksAvailable: true
  };
}
