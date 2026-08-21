import { env } from "../config/env.js";
import { cache } from "../cache/index.js";

async function fetchWithRetry(url: string, attempts = 3): Promise<unknown> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "fpl-analysis-platform/0.1 (personal use)" }
      });
      if (!res.ok) {
        throw new Error(`FPL API request failed: ${res.status} ${res.statusText} for ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** i));
      }
    }
  }
  throw lastError;
}

export async function getFromFplApi<T>(path: string, ttlMs: number): Promise<T> {
  const url = `${env.FPL_API_BASE}${path}`;
  const cached = cache.get<T>(url);
  if (cached !== undefined) return cached;

  const data = (await fetchWithRetry(url)) as T;
  cache.set(url, data, ttlMs);
  return data;
}
