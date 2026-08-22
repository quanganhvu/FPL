import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import PlayerExplorer from "./pages/PlayerExplorer";
import TransferSuggestions from "./pages/TransferSuggestions";
import Captaincy from "./pages/Captaincy";
import ChipStrategy from "./pages/ChipStrategy";
import SquadOptimizer from "./pages/SquadOptimizer";
import Settings from "./pages/Settings";
import { useTeamId } from "./state/teamId";
import { Crest } from "./components/Crest";
import { FixtureTicker } from "./components/FixtureTicker";

export default function App() {
  const { teamId } = useTeamId();

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">
          <span className="nav-crest">
            <Crest />
          </span>
          <span className="nav-title">Gaffer's Choice</span>
        </span>
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/players">Players</NavLink>
        <NavLink to="/transfers">Transfers</NavLink>
        <NavLink to="/captaincy">Captaincy</NavLink>
        <NavLink to="/chips">Chip Strategy</NavLink>
        <NavLink to="/optimizer">Squad Optimizer</NavLink>
        <span className="nav-spacer" />
        <span className="team-id-badge">Team {teamId}</span>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <div className="page-body">
        <div className="layout">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/players" element={<PlayerExplorer />} />
            <Route path="/transfers" element={<TransferSuggestions />} />
            <Route path="/captaincy" element={<Captaincy />} />
            <Route path="/chips" element={<ChipStrategy />} />
            <Route path="/optimizer" element={<SquadOptimizer />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <FixtureTicker />
      </div>
      <footer className="app-footer">
        <p>
          No personal data is recorded or stored on any server - your team ID stays in your browser's local storage,
          and all gameweek data is pulled live from the public FPL API.
        </p>
        <p className="app-footer-credit">Curated by Q</p>
      </footer>
    </>
  );
}
