import { env } from "../config/env.js";
import type { CacheStore } from "./CacheStore.js";
import { FileCache } from "./FileCache.js";

export const cache: CacheStore = new FileCache(env.CACHE_DIR);
export type { CacheStore };
