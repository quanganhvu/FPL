import type { RawTeam } from "../fpl-client/bootstrap.js";

/**
 * Backend-internal only (not part of the shared Club type the frontend uses) -
 * the live counterpart to the strength fields the training script reads from
 * each historical season's teams.csv, keeping the ML model's features
 * consistent between training and inference.
 */
export interface TeamStrength {
  attackHome: number;
  attackAway: number;
  defenceHome: number;
  defenceAway: number;
}

export function buildTeamStrengthMap(teams: RawTeam[]): Map<number, TeamStrength> {
  return new Map(
    teams.map((t) => [
      t.id,
      {
        attackHome: t.strength_attack_home,
        attackAway: t.strength_attack_away,
        defenceHome: t.strength_defence_home,
        defenceAway: t.strength_defence_away
      }
    ])
  );
}
