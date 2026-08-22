import type { Club } from "@fpl/shared";
import { useAsync } from "../hooks/useAsync";
import { getLeagueTable } from "../api/client";
import { LoadingState, ErrorState } from "./AsyncBoundary";

export function LeagueTable() {
  const { data, loading, error } = useAsync(() => getLeagueTable(), []);
  const hasStarted = data?.some((c) => c.played > 0) ?? false;

  return (
    <div className="sidebar-section">
      <div className="sidebar-header">League table</div>
      {loading && <LoadingState label="Loading table..." />}
      {error && <ErrorState message={error} />}
      {data && !hasStarted && (
        <p className="muted league-table-note">Standings will populate once matches have been played.</p>
      )}
      {data && (
        <div className="league-table-scroll">
          <table className="league-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.id}>
                  <td>{c.position || i + 1}</td>
                  <td className="league-table-club">{c.shortName}</td>
                  <td>{c.played}</td>
                  <td>{c.win}</td>
                  <td>{c.draw}</td>
                  <td>{c.loss}</td>
                  <td className="league-table-pts">{c.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
