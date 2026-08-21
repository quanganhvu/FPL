import { getChipStrategy } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useTeamId } from "../state/teamId";
import { LoadingState, ErrorState, EmptyState } from "../components/AsyncBoundary";
import { NotAvailableBanner } from "../components/NotAvailableBanner";

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  "free-hit": "Free Hit",
  "bench-boost": "Bench Boost",
  "triple-captain": "Triple Captain"
};

export default function ChipStrategy() {
  const { teamId } = useTeamId();
  const { data, loading, error } = useAsync(() => getChipStrategy(teamId), [teamId]);

  if (loading) return <LoadingState label="Scanning fixtures..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;
  if (!data.available) return <NotAvailableBanner message={data.message} />;

  return (
    <>
      <h1>Chip Strategy</h1>

      <div className="card">
        <h3>Recommendations</h3>
        {data.recommendations.length === 0 ? (
          <EmptyState>No strong chip windows detected in the next few gameweeks.</EmptyState>
        ) : (
          data.recommendations
            .sort((a, b) => a.gw - b.gw)
            .map((rec, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <span className="badge badge-good">
                  GW{rec.gw} - {CHIP_LABELS[rec.chip] ?? rec.chip}
                </span>{" "}
                <span>{rec.reason}</span>
                <span className="muted"> (~{rec.scoreImpact.toFixed(1)} pts impact)</span>
              </div>
            ))
        )}
      </div>

      <div className="card">
        <h3>Upcoming fixture congestion</h3>
        <div className="pitch-row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          {data.upcomingGameweeks.map((gw) => (
            <div key={gw.gw} className="player-chip" style={{ minWidth: 110 }}>
              <div>GW{gw.gw}</div>
              {gw.blankClubIds.length > 0 && (
                <div className="badge badge-warning" style={{ marginTop: 4 }}>
                  {gw.blankClubIds.length} blank
                </div>
              )}
              {gw.doubleClubIds.length > 0 && (
                <div className="badge badge-good" style={{ marginTop: 4 }}>
                  {gw.doubleClubIds.length} double
                </div>
              )}
              {gw.blankClubIds.length === 0 && gw.doubleClubIds.length === 0 && (
                <div className="muted" style={{ marginTop: 4 }}>
                  Normal
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
