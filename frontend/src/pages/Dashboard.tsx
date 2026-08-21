import { getPlayers, getTeamSummary } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useTeamId } from "../state/teamId";
import { LoadingState, ErrorState } from "../components/AsyncBoundary";
import { StatTile } from "../components/StatTile";
import { NotAvailableBanner } from "../components/NotAvailableBanner";

export default function Dashboard() {
  const { teamId } = useTeamId();
  const { data, loading, error } = useAsync(
    () => Promise.all([getTeamSummary(teamId), getPlayers()]),
    [teamId]
  );

  if (loading) return <LoadingState label="Loading your team..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const [summary, players] = data;
  const playerById = new Map(players.map((p) => [p.id, p]));

  if (!summary.picksAvailable) {
    return (
      <>
        <h1>{summary.managerName}</h1>
        <NotAvailableBanner />
        <p className="muted">
          Try the <a href="/optimizer">Squad Optimizer</a> to plan your opening squad with the standard £100.0m
          budget.
        </p>
      </>
    );
  }

  const sortedPicks = [...summary.picks].sort((a, b) => a.multiplier === b.multiplier ? 0 : b.multiplier - a.multiplier);

  return (
    <>
      <h1>{summary.managerName}</h1>
      <div className="stat-grid">
        <StatTile label="Bank" value={`£${(summary.bank / 10).toFixed(1)}m`} />
        <StatTile label="Team Value" value={`£${(summary.teamValue / 10).toFixed(1)}m`} />
        <StatTile label="Overall Rank" value={summary.overallRank ? summary.overallRank.toLocaleString() : "-"} />
        <StatTile label="Free Transfers" value={String(summary.freeTransfers)} />
      </div>

      <div className="card">
        <h3>Squad</h3>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th className="num">Price</th>
              <th className="num">Predicted (next GW)</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {sortedPicks.map((pick) => {
              const player = playerById.get(pick.playerId);
              return (
                <tr key={pick.playerId} style={{ opacity: pick.multiplier === 0 ? 0.5 : 1 }}>
                  <td>{player?.webName ?? `#${pick.playerId}`}</td>
                  <td>{player?.position ?? "-"}</td>
                  <td className="num">{player ? `£${(player.nowCost / 10).toFixed(1)}m` : "-"}</td>
                  <td className="num">{player ? player.predictedNextGw.toFixed(1) : "-"}</td>
                  <td>
                    {pick.isCaptain && <span className="badge badge-good">C</span>}
                    {pick.isViceCaptain && <span className="badge badge-warning">VC</span>}
                    {pick.multiplier === 0 && <span className="muted">Bench</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {summary.chipsUsed.length > 0 && (
        <div className="card">
          <h3>Chips used</h3>
          <ul>
            {summary.chipsUsed.map((c) => (
              <li key={c.name}>
                {c.name} - gameweek {c.event}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
