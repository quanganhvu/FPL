import type { Player } from "@fpl/shared";
import { getClubs, getPlayers, getTeamSummary } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useTeamId } from "../state/teamId";
import { LoadingState, ErrorState } from "../components/AsyncBoundary";
import { StatTile } from "../components/StatTile";
import { NotAvailableBanner } from "../components/NotAvailableBanner";
import { PitchView } from "../components/PitchView";

export default function Dashboard() {
  const { teamId } = useTeamId();
  const { data, loading, error } = useAsync(
    () => Promise.all([getTeamSummary(teamId), getPlayers(), getClubs()]),
    [teamId]
  );

  if (loading) return <LoadingState label="Loading your team..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const [summary, players, clubs] = data;
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

  const squad = summary.picks
    .map((pick) => playerById.get(pick.playerId))
    .filter((p): p is Player => p !== undefined);
  const startingXI = summary.picks
    .filter((p) => p.multiplier > 0)
    .map((p) => playerById.get(p.playerId))
    .filter((p): p is Player => p !== undefined);
  const bench = squad.filter((p) => !startingXI.some((s) => s.id === p.id));
  const captainId = summary.picks.find((p) => p.isCaptain)?.playerId;
  const viceCaptainId = summary.picks.find((p) => p.isViceCaptain)?.playerId;

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
        <h3>Your squad</h3>
        <PitchView startingXI={startingXI} bench={bench} captainId={captainId} viceCaptainId={viceCaptainId} clubs={clubs} />
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
