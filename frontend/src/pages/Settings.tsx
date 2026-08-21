import { useState } from "react";
import { getTeamSummary } from "../api/client";
import { useTeamId } from "../state/teamId";

export default function Settings() {
  const { teamId, setTeamId } = useTeamId();
  const [input, setInput] = useState(String(teamId));
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [managerName, setManagerName] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const handleSave = async () => {
    const parsed = Number(input);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setStatus("error");
      setErrorMsg("Enter a valid numeric team ID.");
      return;
    }
    setStatus("checking");
    try {
      const summary = await getTeamSummary(parsed);
      setManagerName(summary.managerName);
      setTeamId(parsed);
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="card">
      <h2>Settings</h2>
      <p className="muted">
        Your FPL team ID is the number under <code>fantasy.premierleague.com/entry/&lt;ID&gt;/...</code> (or found via
        the "Points" / "My Team" page URL).
      </p>
      <div className="filters-row">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. 8090938" />
        <button onClick={handleSave} disabled={status === "checking"}>
          {status === "checking" ? "Checking..." : "Save"}
        </button>
      </div>
      {status === "ok" && (
        <p>
          <span className="badge badge-good">Saved</span> Team ID set to {teamId}
          {managerName ? ` (${managerName})` : ""}.
        </p>
      )}
      {status === "error" && <div className="error-box">{errorMsg}</div>}
    </div>
  );
}
