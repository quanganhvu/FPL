import { useState } from "react";
import type { Player } from "@fpl/shared";

const MAX_SUGGESTIONS = 8;

export interface PlayerPickerProps {
  players: Player[];
  selected: number[];
  onChange: (ids: number[]) => void;
  label: string;
  placeholder?: string;
}

export function PlayerPicker({ players, selected, onChange, label, placeholder = "Search to add..." }: PlayerPickerProps) {
  const [search, setSearch] = useState("");

  const selectedPlayers = selected
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);

  const needle = search.trim().toLowerCase();
  const suggestions = needle
    ? players.filter((p) => !selected.includes(p.id) && p.webName.toLowerCase().includes(needle)).slice(0, MAX_SUGGESTIONS)
    : [];

  const add = (id: number) => {
    onChange([...selected, id]);
    setSearch("");
  };

  const remove = (id: number) => {
    onChange(selected.filter((x) => x !== id));
  };

  return (
    <div className="player-picker">
      <label className="muted" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
        {label}
      </label>

      {selectedPlayers.length > 0 && (
        <div className="picker-chips">
          {selectedPlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              className="picker-chip"
              onClick={() => remove(p.id)}
              title={`Remove ${p.webName}`}
            >
              {p.webName}
              <span className="picker-chip-x">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="picker-input-wrap">
        <input placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        {suggestions.length > 0 && (
          <div className="picker-dropdown">
            {suggestions.map((p) => (
              <div key={p.id} className="picker-option" onClick={() => add(p.id)}>
                <span className={`position-dot pos-${p.position}`} />
                {p.webName} <span className="muted">({p.position}, £{(p.nowCost / 10).toFixed(1)}m)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
