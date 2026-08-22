/** Small self-contained ridge regression (no runtime ML dependency needed - just a
 * few dozen lines of matrix math). Training-only; inference is a plain dot product,
 * implemented separately in src/engine/mlModel.ts against the serialized weights. */

export interface RidgeModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[], m: number): number {
  const variance = xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

/** Solves the square linear system Ax = b via Gauss-Jordan elimination with partial pivoting. */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) continue; // singular-ish column, leave as-is (regularization should prevent this)
    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Fits y ~ X via ridge regression. Standardizes features (zero mean, unit variance)
 * and centers the target internally; `bias` in the returned model already accounts
 * for the target's mean, so predict() = bias + weights . standardize(x).
 */
export function trainRidge(X: number[][], y: number[], lambda: number): RidgeModel {
  const n = X.length;
  const p = X[0].length;

  const featureMeans: number[] = [];
  const featureStds: number[] = [];
  for (let j = 0; j < p; j++) {
    const col = X.map((row) => row[j]);
    const m = mean(col);
    const s = std(col, m) || 1;
    featureMeans.push(m);
    featureStds.push(s);
  }

  const Xs = X.map((row) => row.map((v, j) => (v - featureMeans[j]) / featureStds[j]));
  const yMean = mean(y);
  const yc = y.map((v) => v - yMean);

  // Normal equations: (Xs^T Xs + lambda*I) w = Xs^T yc
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      Xty[j] += Xs[i][j] * yc[i];
      for (let k = 0; k < p; k++) {
        XtX[j][k] += Xs[i][j] * Xs[i][k];
      }
    }
  }
  for (let j = 0; j < p; j++) XtX[j][j] += lambda;

  const weights = solveLinearSystem(XtX, Xty);

  return { weights, bias: yMean, featureMeans, featureStds };
}

export function predictRidge(model: RidgeModel, features: number[]): number {
  const standardized = features.map((v, j) => (v - model.featureMeans[j]) / model.featureStds[j]);
  return model.bias + standardized.reduce((sum, v, j) => sum + v * model.weights[j], 0);
}

export function meanAbsoluteError(actual: number[], predicted: number[]): number {
  const errors = actual.map((a, i) => Math.abs(a - predicted[i]));
  return mean(errors);
}
