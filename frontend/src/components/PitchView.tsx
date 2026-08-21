import type { Club, Player } from "@fpl/shared";

const POSITION_ORDER = { GKP: 0, DEF: 1, MID: 2, FWD: 3 } as const;
const PITCH_ROW_ORDER = ["FWD", "MID", "DEF", "GKP"] as const;

export interface PitchViewProps {
  startingXI: Player[];
  bench: Player[];
  captainId?: number;
  viceCaptainId?: number;
  /** When provided, surfaces a warning if 2+ starters share a club - the optimizer
   * only enforces FPL's hard 3-per-club cap, it has no concept of correlation risk
   * below that, so this is left for the user to see and judge for themselves. */
  clubs?: Club[];
}

function PlayerChip({
  player,
  isCaptain,
  isVice
}: {
  player: Player;
  isCaptain: boolean;
  isVice: boolean;
}) {
  return (
    <div className={`player-chip ${isCaptain ? "captain" : ""}`}>
      <span className={`position-dot pos-${player.position}`} />
      <div className="name">
        {player.webName}
        {isCaptain && <span className="armband">C</span>}
        {isVice && <span className="armband vice">V</span>}
      </div>
      <div className="cost">£{(player.nowCost / 10).toFixed(1)}m</div>
      {player.eventPoints !== 0 && <div className="gw-points">{player.eventPoints} pts this GW</div>}
    </div>
  );
}

export interface ClubStack {
  clubName: string;
  count: number;
}

export function findClubStacks(startingXI: Player[], clubs: Club[]): ClubStack[] {
  const counts = new Map<number, number>();
  for (const p of startingXI) counts.set(p.clubId, (counts.get(p.clubId) ?? 0) + 1);
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([clubId, count]) => ({ clubName: clubById.get(clubId)?.name ?? `Club ${clubId}`, count }));
}

export function PitchView({ startingXI, bench, captainId, viceCaptainId, clubs }: PitchViewProps) {
  const byPosition = (pos: string) =>
    startingXI.filter((p) => p.position === pos).sort((a, b) => b.predictedOverHorizon - a.predictedOverHorizon);

  const clubStacks = clubs ? findClubStacks(startingXI, clubs) : [];

  return (
    <>
      {clubStacks.length > 0 && (
        <div className="club-stack-warning">
          <span className="badge badge-warning">Concentration risk</span>{" "}
          {clubStacks.map((s) => `${s.count} starters from ${s.clubName}`).join(", ")} - correlated results if that
          club has a bad week.
        </div>
      )}
      <div className="pitch">
        {PITCH_ROW_ORDER.map((pos) => (
          <div className="pitch-row" key={pos}>
            {byPosition(pos).map((p) => (
              <PlayerChip key={p.id} player={p} isCaptain={p.id === captainId} isVice={p.id === viceCaptainId} />
            ))}
          </div>
        ))}
        {bench.length > 0 && (
          <div className="bench-row">
            <span className="bench-label">Bench</span>
            <div className="pitch-row">
              {[...bench]
                .sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position])
                .map((p) => (
                  <PlayerChip key={p.id} player={p} isCaptain={p.id === captainId} isVice={p.id === viceCaptainId} />
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
