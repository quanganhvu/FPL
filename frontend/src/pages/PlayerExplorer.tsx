import { useState } from "react";
import type { Position } from "@fpl/shared";
import { getPlayers } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { LoadingState, ErrorState } from "../components/AsyncBoundary";

const POSITIONS: Position[] = ["GKP", "DEF", "MID", "FWD"];

export default function PlayerExplorer() {
  const [position, setPosition] = useState<Position | "">("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"predictedPoints" | "form" | "price">("predictedPoints");

  const { data, loading, error } = useAsync(
    () => getPlayers({ position: position || undefined, search: search || undefined, sort }),
    [position, search, sort]
  );

  return (
    <>
      <h1>Player Explorer</h1>
      <div className="filters-row">
        <select value={position} onChange={(e) => setPosition(e.target.value as Position | "")}>
          <option value="">All positions</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input placeholder="Search player..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="predictedPoints">Sort: Predicted points</option>
          <option value="form">Sort: Form</option>
          <option value="price">Sort: Price</option>
        </select>
      </div>

      {loading && <LoadingState label="Loading players..." />}
      {error && <ErrorState message={error} />}

      {data && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="num">Price</th>
                <th className="num">Form</th>
                <th className="num">Owned %</th>
                <th className="num">Predicted (horizon)</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 100).map((p) => (
                <tr key={p.id}>
                  <td>{p.webName}</td>
                  <td>{p.position}</td>
                  <td className="num">£{(p.nowCost / 10).toFixed(1)}m</td>
                  <td className="num">{p.form.toFixed(1)}</td>
                  <td className="num">{p.selectedByPercent.toFixed(1)}%</td>
                  <td className="num">{p.predictedOverHorizon.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 100 && <p className="muted">Showing top 100 of {data.length} matches.</p>}
        </div>
      )}
    </>
  );
}
