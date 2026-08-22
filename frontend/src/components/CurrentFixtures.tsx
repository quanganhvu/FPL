import type { LiveFixture } from "@fpl/shared";
import { useAsync } from "../hooks/useAsync";
import { getCurrentFixtures } from "../api/client";
import { LoadingState, ErrorState } from "./AsyncBoundary";

function statusBadge(f: LiveFixture) {
  if (f.finished || f.finishedProvisional) {
    return <span className="badge badge-good">FT</span>;
  }
  if (f.started) {
    return <span className="badge badge-warning">LIVE</span>;
  }
  if (!f.kickoffTime) return null;
  const kickoff = new Date(f.kickoffTime);
  const label = kickoff.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  return <span className="muted fixture-kickoff">{label}</span>;
}

function FixtureRow({ f }: { f: LiveFixture }) {
  const showScore = f.started || f.finished || f.finishedProvisional;
  return (
    <div className="fixture-row">
      <span className="fixture-club">{f.homeShortName}</span>
      <span className="fixture-score">{showScore ? `${f.homeScore ?? 0} - ${f.awayScore ?? 0}` : "v"}</span>
      <span className="fixture-club">{f.awayShortName}</span>
      <span className="fixture-status">{statusBadge(f)}</span>
    </div>
  );
}

export function CurrentFixtures() {
  const { data, loading, error } = useAsync(() => getCurrentFixtures(), []);

  return (
    <div className="sidebar-section">
      <div className="sidebar-header">
        Gameweek {data?.[0]?.gw ?? ""} fixtures
      </div>
      {loading && <LoadingState label="Loading fixtures..." />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && <p className="muted">No fixtures scheduled.</p>}
      {data && data.map((f) => <FixtureRow key={f.id} f={f} />)}
    </div>
  );
}
