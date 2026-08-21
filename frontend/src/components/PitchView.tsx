import type { Player } from "@fpl/shared";

const POSITION_ORDER = { GKP: 0, DEF: 1, MID: 2, FWD: 3 } as const;
const PITCH_ROW_ORDER = ["FWD", "MID", "DEF", "GKP"] as const;

export interface PitchViewProps {
  startingXI: Player[];
  bench: Player[];
  captainId?: number;
  viceCaptainId?: number;
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
    </div>
  );
}

export function PitchView({ startingXI, bench, captainId, viceCaptainId }: PitchViewProps) {
  const byPosition = (pos: string) =>
    startingXI.filter((p) => p.position === pos).sort((a, b) => b.predictedOverHorizon - a.predictedOverHorizon);

  return (
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
  );
}
