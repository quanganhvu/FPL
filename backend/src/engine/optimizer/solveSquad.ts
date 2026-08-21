import highsLoader, { type Highs } from "highs";
import type { OptimizerResult, Player } from "@fpl/shared";
import { buildSquadModel, type SquadModelOptions } from "./buildModel.js";

let highsInstance: Promise<Highs> | undefined;

function getHighs(): Promise<Highs> {
  if (!highsInstance) {
    highsInstance = highsLoader();
  }
  return highsInstance;
}

export interface SolveResult {
  squad: Player[];
  startingXI: Player[];
  bench: Player[];
  captain: Player;
  formation: string;
}

function formationString(startingXI: Player[]): string {
  const counts = { DEF: 0, MID: 0, FWD: 0 };
  for (const p of startingXI) {
    if (p.position in counts) counts[p.position as keyof typeof counts]++;
  }
  return `${counts.DEF}-${counts.MID}-${counts.FWD}`;
}

export async function solveSquadModel(options: SquadModelOptions): Promise<SolveResult> {
  const { lp, pool } = buildSquadModel(options);
  const highs = await getHighs();
  const solution = highs.solve(lp, { mip_rel_gap: 0.001, time_limit: 20 });

  if (solution.Status !== "Optimal") {
    throw new Error(`Squad optimizer did not find an optimal solution (status: ${solution.Status})`);
  }

  const poolById = new Map(pool.map((p) => [p.id, p]));
  const squad: Player[] = [];
  const startingXI: Player[] = [];
  let captain: Player | undefined;

  for (const p of pool) {
    const x = solution.Columns[`x${p.id}`]?.Primal ?? 0;
    const y = solution.Columns[`y${p.id}`]?.Primal ?? 0;
    const c = solution.Columns[`c${p.id}`]?.Primal ?? 0;
    if (x > 0.5) squad.push(p);
    if (y > 0.5) startingXI.push(p);
    if (c > 0.5) captain = poolById.get(p.id);
  }

  if (!captain) {
    throw new Error("Squad optimizer solution did not designate a captain");
  }

  const startingIds = new Set(startingXI.map((p) => p.id));
  const bench = squad.filter((p) => !startingIds.has(p.id));

  return { squad, startingXI, bench, captain, formation: formationString(startingXI) };
}

const BENCH_WEIGHT = 0.1; // must match the bench-quality weight in buildModel.ts's objective

/**
 * The single source of truth for "predicted points" of a squad, mirroring the
 * solver's actual objective exactly (full startingXI + captain bonus + discounted
 * bench). Any other place comparing squads by predicted value (e.g. a wildcard
 * gap check) must use this too, or the comparison silently uses two different
 * yardsticks - which is what let "lock a player in" look better than the
 * unconstrained optimum despite that being mathematically impossible for what
 * the solver truly maximizes.
 */
export function scoreSquad(startingXI: Player[], bench: Player[], captain: Player): number {
  return (
    startingXI.reduce((sum, p) => sum + p.predictedOverHorizon, 0) +
    captain.predictedOverHorizon +
    bench.reduce((sum, p) => sum + BENCH_WEIGHT * p.predictedOverHorizon, 0)
  );
}

export function toOptimizerResult(solved: SolveResult): OptimizerResult {
  const totalCost = solved.squad.reduce((sum, p) => sum + p.nowCost, 0);
  const predictedPoints = scoreSquad(solved.startingXI, solved.bench, solved.captain);
  return {
    squad: solved.squad,
    startingXI: solved.startingXI,
    bench: solved.bench,
    formation: solved.formation,
    captain: solved.captain,
    totalCost,
    predictedPoints
  };
}
