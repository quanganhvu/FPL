/**
 * Offline training script - NOT part of the deployed app. Run manually via
 * `npm run train`. Fetches historical per-gameweek FPL data from the
 * well-known open-source archive vaastav/Fantasy-Premier-League, engineers
 * features (see src/engine/features.ts for the shared feature definition),
 * fits a ridge regression per position, validates against a held-out season
 * and a naive baseline, and writes the learned weights to
 * src/engine/model/weights.json for the live app to load at runtime.
 *
 * Production never fetches this historical data or does any training - it
 * only loads the committed weights.json and runs a cheap dot product.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "csv-parse/sync";
import { FEATURE_KEYS, shrinkRate, type FeatureVector } from "../src/engine/features.js";
import { trainRidge, predictRidge, meanAbsoluteError, type RidgeModel } from "./lib/ridge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_BASE = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data";
const FIT_SEASONS = ["2021-22", "2022-23"]; // used to fit candidate models during lambda search
const VALIDATION_SEASON = "2023-24"; // used only to pick lambda - never trained on directly during search
const TEST_SEASON = "2024-25"; // touched exactly once, after lambda is chosen
const LAMBDA_GRID = [0.01, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000];
// Historical CSVs give raw ownership counts, not percentages - rescale to an
// approximate percent so this feature is on the same scale as the live
// selected_by_percent field (an exact total-manager-count per historical
// season isn't cheaply available; this is a documented order-of-magnitude
// approximation, which is all a linear feature needs).
const APPROX_TOTAL_MANAGERS = 9_000_000;

type Position = "GKP" | "DEF" | "MID" | "FWD";
const POSITION_MAP: Record<string, Position> = { GK: "GKP", GKP: "GKP", DEF: "DEF", MID: "MID", FWD: "FWD" };

interface TeamRow {
  id: number;
  name: string;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

interface GwRow {
  name: string;
  position: string;
  team: string;
  element: string;
  opponent_team: string;
  total_points: string;
  minutes: string;
  value: string;
  was_home: string;
  selected: string;
  expected_goal_involvements: string;
  starts: string;
  GW: string;
}

interface Sample {
  position: Position;
  features: FeatureVector;
  label: number;
}

async function fetchCsv<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  return parse(text, { columns: true, skip_empty_lines: true }) as T[];
}

async function loadSeason(season: string): Promise<{ teamsByName: Map<string, TeamRow>; teamsById: Map<number, TeamRow>; rows: GwRow[] }> {
  const [teams, rows] = await Promise.all([
    fetchCsv<TeamRow & Record<string, string>>(`${REPO_BASE}/${season}/teams.csv`),
    fetchCsv<GwRow>(`${REPO_BASE}/${season}/gws/merged_gw.csv`)
  ]);

  const teamsByName = new Map<string, TeamRow>();
  const teamsById = new Map<number, TeamRow>();
  for (const t of teams) {
    const parsed: TeamRow = {
      id: Number(t.id),
      name: t.name,
      strength_attack_home: Number(t.strength_attack_home),
      strength_attack_away: Number(t.strength_attack_away),
      strength_defence_home: Number(t.strength_defence_home),
      strength_defence_away: Number(t.strength_defence_away)
    };
    teamsByName.set(t.name, parsed);
    teamsById.set(parsed.id, parsed);
  }

  return { teamsByName, teamsById, rows };
}

const LABEL_HORIZON = 5; // predict the average of this GW + the next N-1, not one very noisy single GW -
// matches how the app actually uses predictions (predictedOverHorizon averages/sums multiple gameweeks)

interface PendingSample {
  position: Position;
  features: FeatureVector;
  ownPoints: number; // this row's own actual points, used to build the forward-looking label afterward
}

/** Builds training samples for one season, walking each player's rows in gameweek
 * order and computing features from only PRIOR gameweeks (avoiding label leakage).
 * The label is a forward-looking average over LABEL_HORIZON gameweeks (this GW
 * included), which is what the app's downstream horizon-summed prediction actually
 * needs, and is a meaningfully less noisy target than any single gameweek's score. */
function buildSamplesForSeason(season: {
  teamsByName: Map<string, TeamRow>;
  teamsById: Map<number, TeamRow>;
  rows: GwRow[];
}): Sample[] {
  const byPlayer = new Map<string, GwRow[]>();
  for (const row of season.rows) {
    const list = byPlayer.get(row.element) ?? [];
    list.push(row);
    byPlayer.set(row.element, list);
  }

  const samples: Sample[] = [];

  for (const rows of byPlayer.values()) {
    rows.sort((a, b) => Number(a.GW) - Number(b.GW));

    let gamesPlayed = 0;
    let pointsSum = 0;
    let minutesSum = 0;
    let xgiSum = 0;
    let startsCount = 0;
    const recentPoints: number[] = []; // trailing window for "form"
    const pending: PendingSample[] = [];

    for (const row of rows) {
      const position = POSITION_MAP[row.position];
      const ownTeam = season.teamsByName.get(row.team);
      const oppTeam = season.teamsById.get(Number(row.opponent_team));
      const ownPoints = Number(row.total_points);

      if (position && ownTeam && oppTeam) {
        const isHome = row.was_home === "True";
        const form = recentPoints.length > 0 ? recentPoints.reduce((a, b) => a + b, 0) / recentPoints.length : 0;
        const pointsPerGame = gamesPlayed > 0 ? pointsSum / gamesPlayed : 0;
        const minutesPerGame = gamesPlayed > 0 ? minutesSum / gamesPlayed : 0;
        const xgi90 = minutesSum > 0 ? (xgiSum / minutesSum) * 90 : 0;
        const ownershipPercentApprox = ((Number(row.selected) || 0) / APPROX_TOTAL_MANAGERS) * 100;
        const ownershipLog = Math.log1p(ownershipPercentApprox);

        const features: FeatureVector = {
          form: shrinkRate(form, startsCount),
          pointsPerGame: shrinkRate(pointsPerGame, startsCount),
          price: Number(row.value),
          isHome: isHome ? 1 : 0,
          ownStrengthAttack: isHome ? ownTeam.strength_attack_home : ownTeam.strength_attack_away,
          ownStrengthDefence: isHome ? ownTeam.strength_defence_home : ownTeam.strength_defence_away,
          oppStrengthAttack: isHome ? oppTeam.strength_attack_away : oppTeam.strength_attack_home,
          oppStrengthDefence: isHome ? oppTeam.strength_defence_away : oppTeam.strength_defence_home,
          ownershipLog,
          xgi90,
          minutesPerGame,
          startsCount
        };

        pending.push({ position, features, ownPoints });
      } else {
        // Row can't be featurized (unmatched team, unknown position), but its points still
        // count toward FUTURE rows' forward-looking labels, so track it as a label-only entry.
        pending.push({ position: "MID", features: null as unknown as FeatureVector, ownPoints });
      }

      // Update running state with this row's ACTUAL results, for use in future rows only.
      gamesPlayed += 1;
      pointsSum += ownPoints;
      minutesSum += Number(row.minutes) || 0;
      xgiSum += Number(row.expected_goal_involvements) || 0;
      startsCount += Number(row.starts) || 0;
      recentPoints.push(ownPoints);
      if (recentPoints.length > 5) recentPoints.shift();
    }

    for (let i = 0; i < pending.length; i++) {
      if (!pending[i].features) continue; // label-only placeholder row, not a real sample
      const window = pending.slice(i, i + LABEL_HORIZON).map((p) => p.ownPoints);
      const label = window.reduce((a, b) => a + b, 0) / window.length;
      samples.push({ position: pending[i].position, features: pending[i].features, label });
    }
  }

  return samples;
}

function toMatrix(samples: Sample[], keys: (keyof FeatureVector)[] = FEATURE_KEYS): { X: number[][]; y: number[] } {
  const X = samples.map((s) => keys.map((k) => s.features[k]));
  const y = samples.map((s) => s.label);
  return { X, y };
}

function maeFor(model: RidgeModel, samples: Sample[]): number {
  const { X, y } = toMatrix(samples);
  const predictions = X.map((x) => predictRidge(model, x));
  return meanAbsoluteError(y, predictions);
}

async function main() {
  console.log(`Fetching fit seasons: ${FIT_SEASONS.join(", ")}...`);
  const fitSeasonsData = await Promise.all(FIT_SEASONS.map(loadSeason));
  console.log(`Fetching validation season: ${VALIDATION_SEASON}...`);
  const validationSeasonData = await loadSeason(VALIDATION_SEASON);
  console.log(`Fetching test season: ${TEST_SEASON}...`);
  const testSeasonData = await loadSeason(TEST_SEASON);

  const fitSamples = fitSeasonsData.flatMap(buildSamplesForSeason);
  const validationSamples = buildSamplesForSeason(validationSeasonData);
  const testSamples = buildSamplesForSeason(testSeasonData);
  console.log(
    `Fit samples: ${fitSamples.length}, validation samples: ${validationSamples.length}, test samples: ${testSamples.length}`
  );

  const positions: Position[] = ["GKP", "DEF", "MID", "FWD"];
  const models: Record<Position, RidgeModel> = {} as Record<Position, RidgeModel>;

  for (const position of positions) {
    const fitSubset = fitSamples.filter((s) => s.position === position);
    const validationSubset = validationSamples.filter((s) => s.position === position);
    const testSubset = testSamples.filter((s) => s.position === position);
    if (fitSubset.length < 20 || validationSubset.length === 0 || testSubset.length === 0) {
      console.warn(`Skipping ${position}: insufficient data`);
      continue;
    }

    // Pick lambda by validation MAE only - the test season stays untouched until after this choice.
    const { X: fitX, y: fitY } = toMatrix(fitSubset);
    let bestLambda = LAMBDA_GRID[0];
    let bestValidationMae = Infinity;
    for (const lambda of LAMBDA_GRID) {
      const candidate = trainRidge(fitX, fitY, lambda);
      const validationMae = maeFor(candidate, validationSubset);
      if (validationMae < bestValidationMae) {
        bestValidationMae = validationMae;
        bestLambda = lambda;
      }
    }

    // Refit on fit+validation combined at the chosen lambda, then evaluate once on the true test season.
    const finalTrainSubset = [...fitSubset, ...validationSubset];
    const { X: finalX, y: finalY } = toMatrix(finalTrainSubset);
    const model = trainRidge(finalX, finalY, bestLambda);
    models[position] = model;

    const modelMae = maeFor(model, testSubset);
    const naiveMae = meanAbsoluteError(
      testSubset.map((s) => s.label),
      testSubset.map((s) => s.features.pointsPerGame)
    );

    console.log(
      `${position}: n_fit=${fitSubset.length} n_val=${validationSubset.length} n_test=${testSubset.length} | ` +
        `lambda=${bestLambda} (val MAE=${bestValidationMae.toFixed(3)}) | ` +
        `test MAE ridge=${modelMae.toFixed(3)} vs naive (season PPG)=${naiveMae.toFixed(3)} ` +
        `${modelMae < naiveMae ? "(ridge wins)" : "(ridge LOSES - investigate before shipping)"}`
    );
  }

  const outPath = join(__dirname, "..", "src", "engine", "model", "weights.json");
  const payload = {
    trainedAt: new Date().toISOString(),
    trainSeasons: [...FIT_SEASONS, VALIDATION_SEASON],
    testSeason: TEST_SEASON,
    featureKeys: FEATURE_KEYS,
    models
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote model weights to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
