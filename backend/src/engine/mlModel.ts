import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Position } from "@fpl/shared";
import { FEATURE_KEYS, type FeatureVector } from "./features.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RidgeModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
}

interface WeightsFile {
  models: Partial<Record<Position, RidgeModel>>;
}

let cachedModels: Partial<Record<Position, RidgeModel>> | undefined;
let loadAttempted = false;

/** Loads the trained weights once. Missing/unreadable file degrades to "no model
 * available" rather than throwing - callers fall back to the heuristic formula. */
function loadModels(): Partial<Record<Position, RidgeModel>> {
  if (loadAttempted) return cachedModels ?? {};
  loadAttempted = true;
  try {
    const path = join(__dirname, "model", "weights.json");
    const raw = JSON.parse(readFileSync(path, "utf-8")) as WeightsFile;
    cachedModels = raw.models;
    return cachedModels;
  } catch {
    return {};
  }
}

function predictRidge(model: RidgeModel, features: number[]): number {
  const standardized = features.map((v, j) => (v - model.featureMeans[j]) / model.featureStds[j]);
  return model.bias + standardized.reduce((sum, v, j) => sum + v * model.weights[j], 0);
}

export function hasModelForPosition(position: Position): boolean {
  return loadModels()[position] !== undefined;
}

/** Predicted points over LABEL_HORIZON gameweeks (the model was trained to predict a
 * 5-gameweek forward average - see backend/scripts/trainModel.ts), for one player in
 * one specific matchup context. Returns undefined if no trained model is available
 * for this position, so the caller can fall back to the heuristic formula. */
export function predictWithModel(position: Position, features: FeatureVector): number | undefined {
  const model = loadModels()[position];
  if (!model) return undefined;
  const vector = FEATURE_KEYS.map((k) => features[k]);
  return predictRidge(model, vector);
}
