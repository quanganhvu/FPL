import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { getCaptainPicks } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useTeamId } from "../state/teamId";
import { LoadingState, ErrorState } from "../components/AsyncBoundary";
import { NotAvailableBanner } from "../components/NotAvailableBanner";

export default function Captaincy() {
  const { teamId } = useTeamId();
  const { data, loading, error } = useAsync(() => getCaptainPicks(teamId), [teamId]);

  if (loading) return <LoadingState label="Ranking captain candidates..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;
  if (!data.available) return <NotAvailableBanner message={data.message} />;

  const chartData = data.picks.map((p) => ({
    name: p.player.webName,
    predicted: Number(p.predictedPoints.toFixed(1))
  }));

  return (
    <>
      <h1>Captaincy</h1>
      <div className="card">
        <h3>Top candidates - next gameweek</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--gridline)" />
            <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--baseline)" }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "var(--text-primary)", fontSize: 13 }}
              axisLine={{ stroke: "var(--baseline)" }}
              width={100}
            />
            <Bar dataKey="predicted" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={28}>
              <LabelList dataKey="predicted" position="right" fill="var(--text-primary)" fontSize={13} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.picks.map((pick, i) => (
        <div className="card" key={pick.player.id}>
          <h3>
            {i === 0 && <span className="badge badge-good">Captain</span>}
            {i === 1 && <span className="badge badge-warning">Vice</span>}
            {" "}
            {pick.player.webName}
          </h3>
          <p>{pick.rationale}</p>
        </div>
      ))}
    </>
  );
}
