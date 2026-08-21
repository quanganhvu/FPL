import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { TeamIdContext, loadStoredTeamId, storeTeamId } from "./state/teamId";
import "./index.css";

function Root() {
  const [teamId, setTeamIdState] = useState(loadStoredTeamId());

  const setTeamId = (id: number) => {
    storeTeamId(id);
    setTeamIdState(id);
  };

  return (
    <TeamIdContext.Provider value={{ teamId, setTeamId }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </TeamIdContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
