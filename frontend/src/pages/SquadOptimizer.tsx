import { useState } from "react";
import type { OptimizerResult, Player } from "@fpl/shared";
import { getPlayers, optimizeSquad } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useTeamId } from "../state/teamId";
import { LoadingState, ErrorState } from "../components/AsyncBoundary";
import { PitchView } from "../components/PitchView";

function PlayerMultiSelect({
  players,
  selected,
  onChange,
  label
}: {
  players: Player[];
  selected: number[];
  onChange: (ids: number[]) => void;
  label: string;
}) {
  return (
    <div>
      <label className="muted" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
        {label}
      </label>
      <select
        multiple
        value={selected.map(String)}
        onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o) => Number(o.value)))}
        style={{ height: 120, width: 240 }}
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.webName} ({p.position}, £{(p.nowCost / 10).toFixed(1)}m)
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SquadOptimizer() {
  const { teamId } = useTeamId();
  const { data: players, loading: loadingPlayers, error: playersError } = useAsync(() => getPlayers(), []);

  const [budget, setBudget] = useState("100.0");
  const [lockPlayers, setLockPlayers] = useState<number[]>([]);
  const [excludePlayers, setExcludePlayers] = useState<number[]>([]);
  const [result, setResult] = useState<OptimizerResult | undefined>();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | undefined>();

  const runOptimizer = async () => {
    setRunning(true);
    setRunError(undefined);
    try {
      const budgetTenths = Math.round(Number(budget) * 10);
      const res = await optimizeSquad(teamId, {
        budgetOverride: budgetTenths,
        lockPlayers,
        excludePlayers
      });
      setResult(res);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  if (loadingPlayers) return <LoadingState label="Loading player pool..." />;
  if (playersError) return <ErrorState message={playersError} />;

  return (
    <>
      <h1>Squad Optimizer</h1>
      <div className="card">
        <div className="filters-row" style={{ alignItems: "flex-end" }}>
          <div>
            <label className="muted" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
              Budget (£m)
            </label>
            <input value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: 100 }} />
          </div>
          {players && (
            <>
              <PlayerMultiSelect players={players} selected={lockPlayers} onChange={setLockPlayers} label="Lock in squad" />
              <PlayerMultiSelect players={players} selected={excludePlayers} onChange={setExcludePlayers} label="Exclude" />
            </>
          )}
          <button onClick={runOptimizer} disabled={running}>
            {running ? "Solving..." : "Run Optimizer"}
          </button>
        </div>
        {runError && <div className="error-box">{runError}</div>}
      </div>

      {result && (
        <div className="card">
          <div className="stat-grid">
            <div className="stat-tile">
              <div className="label">Formation</div>
              <div className="value">{result.formation}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Total Cost</div>
              <div className="value">£{(result.totalCost / 10).toFixed(1)}m</div>
            </div>
            <div className="stat-tile">
              <div className="label">Predicted Points</div>
              <div className="value">{result.predictedPoints.toFixed(1)}</div>
            </div>
          </div>
          <PitchView startingXI={result.startingXI} bench={result.bench} captainId={result.captain.id} />
        </div>
      )}
    </>
  );
}
