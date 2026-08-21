import { getTransferSuggestions } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useTeamId } from "../state/teamId";
import { LoadingState, ErrorState, EmptyState } from "../components/AsyncBoundary";
import { NotAvailableBanner } from "../components/NotAvailableBanner";

export default function TransferSuggestions() {
  const { teamId } = useTeamId();
  const { data, loading, error } = useAsync(() => getTransferSuggestions(teamId, 5, 3), [teamId]);

  if (loading) return <LoadingState label="Solving transfer options..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;
  if (!data.available) return <NotAvailableBanner message={data.message} />;
  if (data.options.length === 0) return <EmptyState>No transfer options could be computed.</EmptyState>;

  const best = data.options[0];

  return (
    <>
      <h1>Transfer Suggestions</h1>
      <p className="muted">Comparing 0 to 3 transfers over the next 5 gameweeks, net of any point hits.</p>

      {data.options.map((option) => (
        <div className="card" key={option.transfersUsed}>
          <h3>
            {option.transfersUsed === 0 ? "Do nothing" : `${option.transfersUsed} transfer(s)`}
            {option === best && <span className="badge badge-good" style={{ marginLeft: 8 }}>Recommended</span>}
          </h3>
          <div className="stat-grid" style={{ marginBottom: option.swaps.length > 0 ? 12 : 0 }}>
            <div className="stat-tile">
              <div className="label">Net predicted points</div>
              <div className="value">{option.netPredictedPoints.toFixed(1)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Hit cost</div>
              <div className="value">{option.hitCost > 0 ? `-${option.hitCost}` : "0"}</div>
            </div>
          </div>
          {option.swaps.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Out</th>
                  <th>In</th>
                </tr>
              </thead>
              <tbody>
                {option.swaps.map((swap, i) => (
                  <tr key={i}>
                    <td>
                      {swap.out.webName} <span className="muted">£{(swap.out.nowCost / 10).toFixed(1)}m</span>
                    </td>
                    <td>
                      {swap.in.webName} <span className="muted">£{(swap.in.nowCost / 10).toFixed(1)}m</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      <p className="muted">This app doesn't execute transfers - make the move on the official FPL site.</p>
    </>
  );
}
