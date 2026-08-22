import type { FixtureTickerClub, TickerFixture } from "@fpl/shared";
import { useAsync } from "../hooks/useAsync";
import { getFixtureTicker } from "../api/client";
import { LoadingState, ErrorState } from "./AsyncBoundary";

const HORIZON = 10;

/** Fixture difficulty is inherently a status signal (good = easy opportunity,
 * critical = risk), not a categorical series - reuses the app's existing
 * status palette rather than inventing a separate red/green scale. */
function difficultyClass(difficulty: number): string {
  if (difficulty <= 1) return "fdr-1";
  if (difficulty === 2) return "fdr-2";
  if (difficulty === 3) return "fdr-3";
  if (difficulty === 4) return "fdr-4";
  return "fdr-5";
}

function FixtureCell({ fixtures }: { fixtures: TickerFixture[] }) {
  if (fixtures.length === 0) {
    return <div className="ticker-cell fdr-blank" title="Blank gameweek" />;
  }
  if (fixtures.length === 1) {
    const f = fixtures[0];
    return (
      <div className={`ticker-cell ${difficultyClass(f.difficulty)}`} title={`${f.isHome ? "Home" : "Away"} vs ${f.opponentShortName} (FDR ${f.difficulty})`}>
        {f.isHome ? f.opponentShortName : f.opponentShortName.toLowerCase()}
      </div>
    );
  }
  // Double gameweek - stack both fixtures in one cell.
  return (
    <div className="ticker-cell ticker-cell-double" title={fixtures.map((f) => `${f.isHome ? "Home" : "Away"} vs ${f.opponentShortName} (FDR ${f.difficulty})`).join(" & ")}>
      {fixtures.map((f, i) => (
        <div key={i} className={`ticker-cell-half ${difficultyClass(f.difficulty)}`}>
          {f.isHome ? f.opponentShortName : f.opponentShortName.toLowerCase()}
        </div>
      ))}
    </div>
  );
}

function TickerTable({ clubs }: { clubs: FixtureTickerClub[] }) {
  const gws = [...new Set(clubs.flatMap((c) => c.fixtures.map((f) => f.gw)))].sort((a, b) => a - b);

  return (
    <div className="ticker-scroll">
      <table className="ticker-table">
        <thead>
          <tr>
            <th></th>
            {gws.map((gw) => (
              <th key={gw}>{gw}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clubs.map((club) => (
            <tr key={club.clubId}>
              <td className="ticker-club">{club.shortName}</td>
              {gws.map((gw) => (
                <td key={gw}>
                  <FixtureCell fixtures={club.fixtures.filter((f) => f.gw === gw)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FixtureTicker() {
  const { data, loading, error } = useAsync(() => getFixtureTicker(HORIZON), []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">Fixture difficulty</div>
      {loading && <LoadingState label="Loading fixtures..." />}
      {error && <ErrorState message={error} />}
      {data && <TickerTable clubs={data} />}
    </aside>
  );
}
