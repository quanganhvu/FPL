import type { Player } from "@fpl/shared";

export interface SquadModelOptions {
  players: Player[];
  budget: number; // tenths of a million, same scale as Player.nowCost
  lockPlayers?: number[];
  excludePlayers?: number[];
  currentSquadIds?: number[];
  exactTransfersOut?: number; // requires currentSquadIds; keeps exactly (currentSquadIds.length - t) of them
  formation?: string; // "DEF-MID-FWD", e.g. "4-4-2"; omit to let the solver pick the best valid formation
}

/** Parses "4-4-2" into exact starting-XI counts per position. Falls back to the free-choice range if invalid/absent. */
function resolveXiQuota(formation: string | undefined): Record<string, [number, number]> {
  const DEFAULT_QUOTA: Record<string, [number, number]> = { GKP: [1, 1], DEF: [3, 5], MID: [2, 5], FWD: [1, 3] };
  if (!formation) return DEFAULT_QUOTA;

  const match = formation.match(/^(\d)-(\d)-(\d)$/);
  if (!match) return DEFAULT_QUOTA;
  const [def, mid, fwd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const valid = def >= 3 && def <= 5 && mid >= 2 && mid <= 5 && fwd >= 1 && fwd <= 3 && def + mid + fwd === 10;
  if (!valid) return DEFAULT_QUOTA;

  return { GKP: [1, 1], DEF: [def, def], MID: [mid, mid], FWD: [fwd, fwd] };
}

const xVar = (id: number) => `x${id}`;
const yVar = (id: number) => `y${id}`;
const cVar = (id: number) => `c${id}`;

/** Builds a CPLEX LP-format string (consumed by the highs-js solver) for the squad-selection MILP. */
export function buildSquadModel(options: SquadModelOptions): { lp: string; pool: Player[] } {
  const excludeSet = new Set(options.excludePlayers ?? []);
  const lockSet = new Set(options.lockPlayers ?? []);
  const pool = options.players.filter((p) => !excludeSet.has(p.id));

  const objectiveTerms = pool.map((p) => {
    const pred = p.predictedOverHorizon;
    // Expanded from: y*pred + c*pred + 0.1*(x-y)*pred  =>  0.1*pred*x + 0.9*pred*y + pred*c
    return `${fmt(0.1 * pred)} ${xVar(p.id)} + ${fmt(0.9 * pred)} ${yVar(p.id)} + ${fmt(pred)} ${cVar(p.id)}`;
  });

  const constraints: string[] = [];
  let cIdx = 0;
  const nextLabel = () => `r${cIdx++}`;

  constraints.push(`${nextLabel()}: ${sumVar(pool, xVar)} = 15`);
  for (const position of ["GKP", "DEF", "MID", "FWD"] as const) {
    const subset = pool.filter((p) => p.position === position);
    const quota = { GKP: 2, DEF: 5, MID: 5, FWD: 3 }[position];
    constraints.push(`${nextLabel()}: ${sumVar(subset, xVar)} = ${quota}`);
  }

  constraints.push(`${nextLabel()}: ${sumVar(pool, yVar)} = 11`);
  const xiQuota = resolveXiQuota(options.formation);
  for (const position of ["GKP", "DEF", "MID", "FWD"] as const) {
    const subset = pool.filter((p) => p.position === position);
    const [min, max] = xiQuota[position];
    if (min === max) {
      constraints.push(`${nextLabel()}: ${sumVar(subset, yVar)} = ${min}`);
    } else {
      constraints.push(`${nextLabel()}: ${sumVar(subset, yVar)} >= ${min}`);
      constraints.push(`${nextLabel()}: ${sumVar(subset, yVar)} <= ${max}`);
    }
  }

  constraints.push(`${nextLabel()}: ${sumVar(pool, cVar)} = 1`);

  for (const p of pool) {
    constraints.push(`${nextLabel()}: ${yVar(p.id)} - ${xVar(p.id)} <= 0`);
    constraints.push(`${nextLabel()}: ${cVar(p.id)} - ${yVar(p.id)} <= 0`);
  }

  const budgetTerms = pool.map((p) => `${fmt(p.nowCost)} ${xVar(p.id)}`).join(" + ");
  constraints.push(`${nextLabel()}: ${budgetTerms} <= ${fmt(options.budget)}`);

  const clubIds = [...new Set(pool.map((p) => p.clubId))];
  for (const clubId of clubIds) {
    const subset = pool.filter((p) => p.clubId === clubId);
    constraints.push(`${nextLabel()}: ${sumVar(subset, xVar)} <= 3`);
  }

  if (options.currentSquadIds && options.exactTransfersOut !== undefined) {
    const currentInPool = pool.filter((p) => options.currentSquadIds!.includes(p.id));
    const keep = currentInPool.length - options.exactTransfersOut;
    constraints.push(`${nextLabel()}: ${sumVar(currentInPool, xVar)} = ${keep}`);
  }

  const bounds: string[] = [];
  for (const id of lockSet) {
    if (pool.some((p) => p.id === id)) {
      bounds.push(`${xVar(id)} = 1`);
    }
  }

  const binaries = pool.flatMap((p) => [xVar(p.id), yVar(p.id), cVar(p.id)]);

  const lp = [
    "Maximize",
    ` obj: ${objectiveTerms.join(" + ")}`,
    "Subject To",
    ...constraints.map((c) => ` ${c}`),
    ...(bounds.length > 0 ? ["Bounds", ...bounds.map((b) => ` ${b}`)] : []),
    "Binary",
    ...binaries.map((b) => ` ${b}`),
    "End"
  ].join("\n");

  return { lp, pool };
}

function sumVar(players: Player[], varFn: (id: number) => string): string {
  if (players.length === 0) return "0";
  return players.map((p) => varFn(p.id)).join(" + ");
}

function fmt(n: number): string {
  return n.toFixed(6);
}
