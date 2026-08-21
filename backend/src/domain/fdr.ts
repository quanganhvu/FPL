import type { RawFixture } from "../fpl-client/fixtures.js";
import type { GameweekFixtureCount } from "@fpl/shared";

export interface ClubFixture {
  opponentClubId: number;
  difficulty: number;
  isHome: boolean;
}

/** Fixtures for one club in one gameweek - empty for a blank, length 2+ for a double. */
export function getClubFixturesInGw(fixtures: RawFixture[], clubId: number, gw: number): ClubFixture[] {
  return fixtures
    .filter((f) => f.event === gw && (f.team_h === clubId || f.team_a === clubId))
    .map((f) => {
      const isHome = f.team_h === clubId;
      return {
        opponentClubId: isHome ? f.team_a : f.team_h,
        difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
        isHome
      };
    });
}

/** For each gameweek in gws, which clubs have 0 fixtures (blank) and which have 2+ (double). */
export function getGameweekFixtureCounts(
  fixtures: RawFixture[],
  gws: number[],
  clubIds: number[]
): GameweekFixtureCount[] {
  return gws.map((gw) => {
    const blankClubIds: number[] = [];
    const doubleClubIds: number[] = [];
    for (const clubId of clubIds) {
      const count = getClubFixturesInGw(fixtures, clubId, gw).length;
      if (count === 0) blankClubIds.push(clubId);
      if (count >= 2) doubleClubIds.push(clubId);
    }
    return { gw, blankClubIds, doubleClubIds };
  });
}
