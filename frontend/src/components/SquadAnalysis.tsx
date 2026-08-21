import type { Club, OptimizerResult, Player } from "@fpl/shared";
import { findClubStacks } from "./PitchView";

const PROVEN_STARTS_THRESHOLD = 10;

function isDoubtful(p: Player): boolean {
  if (p.status !== "a") return true;
  return p.chanceOfPlayingNextRound !== null && p.chanceOfPlayingNextRound < 100;
}

export function SquadAnalysis({ result, clubs }: { result: OptimizerResult; clubs?: Club[] }) {
  const { startingXI, captain } = result;

  const proven = startingXI.filter((p) => p.starts >= PROVEN_STARTS_THRESHOLD);
  const unproven = startingXI.filter((p) => p.starts < PROVEN_STARTS_THRESHOLD);
  const doubtful = startingXI.filter(isDoubtful);
  const clubStacks = clubs ? findClubStacks(startingXI, clubs) : [];

  const pros: string[] = [];
  const cons: string[] = [];

  pros.push(`${proven.length} of 11 starters have a proven track record (${PROVEN_STARTS_THRESHOLD}+ starts last season).`);
  pros.push(`Captain ${captain.webName} has the highest predicted score in the squad (${captain.predictedOverHorizon.toFixed(1)} pts over the horizon).`);
  if (doubtful.length === 0) {
    pros.push("No starting XI players are currently flagged as injury/rotation doubts.");
  }

  if (clubStacks.length > 0) {
    cons.push(
      `Concentration risk: ${clubStacks.map((s) => `${s.count} starters from ${s.clubName}`).join(", ")} - correlated results if that club has a bad week.`
    );
  }
  if (unproven.length > 0) {
    cons.push(
      `${unproven.length} starter(s) have limited game time (under ${PROVEN_STARTS_THRESHOLD} starts) - their score leans on a conservative estimate rather than a proven record: ${unproven.map((p) => p.webName).join(", ")}.`
    );
  }
  if (doubtful.length > 0) {
    cons.push(
      `${doubtful.length} starter(s) are injury/rotation doubts: ${doubtful
        .map((p) => `${p.webName}${p.chanceOfPlayingNextRound !== null ? ` (${p.chanceOfPlayingNextRound}% chance of playing)` : ""}`)
        .join(", ")}.`
    );
  }
  if (cons.length === 0) {
    cons.push("No major risks detected in this squad's starting XI.");
  }

  return (
    <div className="card">
      <h3>Squad analysis</h3>
      <div className="squad-analysis-grid">
        <div>
          <div className="squad-analysis-label good">Strengths</div>
          <ul>
            {pros.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="squad-analysis-label warning">Risks</div>
          <ul>
            {cons.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
