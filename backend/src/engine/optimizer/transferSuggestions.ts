import type { Player, TransferOption, TransferSwap } from "@fpl/shared";
import { solveSquadModel, toOptimizerResult } from "./solveSquad.js";

const HIT_COST_PER_TRANSFER = 4;
const POSITION_ORDER = { GKP: 0, DEF: 1, MID: 2, FWD: 3 } as const;

function byPositionThenId(a: Player, b: Player): number {
  const posDiff = POSITION_ORDER[a.position] - POSITION_ORDER[b.position];
  return posDiff !== 0 ? posDiff : a.id - b.id;
}

function diffSquads(oldSquad: Player[], newSquad: Player[]): TransferSwap[] {
  const newIds = new Set(newSquad.map((p) => p.id));
  const oldIds = new Set(oldSquad.map((p) => p.id));
  const out = oldSquad.filter((p) => !newIds.has(p.id)).sort(byPositionThenId);
  const inPlayers = newSquad.filter((p) => !oldIds.has(p.id)).sort(byPositionThenId);
  return out.map((outPlayer, i) => ({ out: outPlayer, in: inPlayers[i] }));
}

export async function getTransferSuggestions(
  currentSquad: Player[],
  pool: Player[],
  budget: number,
  freeTransfers: number,
  maxTransfers = 5
): Promise<TransferOption[]> {
  const currentSquadIds = currentSquad.map((p) => p.id);
  const cappedMax = Math.min(maxTransfers, currentSquad.length);
  const options: TransferOption[] = [];

  for (let t = 0; t <= cappedMax; t++) {
    try {
      const solved = await solveSquadModel({
        players: pool,
        budget,
        currentSquadIds,
        exactTransfersOut: t
      });
      const result = toOptimizerResult(solved);
      const hitCost = Math.max(0, t - freeTransfers) * HIT_COST_PER_TRANSFER;
      options.push({
        transfersUsed: t,
        netPredictedPoints: result.predictedPoints - hitCost,
        hitCost,
        swaps: diffSquads(currentSquad, solved.squad)
      });
    } catch {
      // infeasible at this transfer count (e.g. budget too tight) - skip it
    }
  }

  return options.sort((a, b) => b.netPredictedPoints - a.netPredictedPoints);
}
