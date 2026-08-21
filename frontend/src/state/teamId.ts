import { createContext, useContext } from "react";

const STORAGE_KEY = "fpl.teamId";

export function loadStoredTeamId(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Number(import.meta.env.VITE_DEFAULT_TEAM_ID);
}

export function storeTeamId(teamId: number): void {
  localStorage.setItem(STORAGE_KEY, String(teamId));
}

export interface TeamIdContextValue {
  teamId: number;
  setTeamId: (teamId: number) => void;
}

export const TeamIdContext = createContext<TeamIdContextValue | undefined>(undefined);

export function useTeamId(): TeamIdContextValue {
  const ctx = useContext(TeamIdContext);
  if (!ctx) throw new Error("useTeamId must be used within TeamIdContext.Provider");
  return ctx;
}
