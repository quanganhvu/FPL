import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CacheStore } from "./CacheStore.js";
import { MemoryCache } from "./MemoryCache.js";

interface PersistedEntry {
  value: unknown;
  expiresAt: number;
}

function safeKeyToFilename(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";
}

/**
 * Wraps MemoryCache and additionally persists to disk so a dev-server
 * restart doesn't force a re-fetch of bootstrap-static. Must degrade to
 * memory-only silently if the filesystem is unwritable/ephemeral (e.g. a
 * future serverless deploy) - that's what keeps this cloud-portable.
 */
export class FileCache implements CacheStore {
  private memory = new MemoryCache();
  private dir: string;
  private diskAvailable: boolean;

  constructor(dir: string) {
    this.dir = dir;
    this.diskAvailable = this.ensureDir();
  }

  private ensureDir(): boolean {
    try {
      if (!existsSync(this.dir)) {
        mkdirSync(this.dir, { recursive: true });
      }
      return true;
    } catch {
      return false;
    }
  }

  get<T>(key: string): T | undefined {
    const fromMemory = this.memory.get<T>(key);
    if (fromMemory !== undefined) return fromMemory;

    if (!this.diskAvailable) return undefined;
    try {
      const path = join(this.dir, safeKeyToFilename(key));
      if (!existsSync(path)) return undefined;
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as PersistedEntry;
      if (Date.now() > parsed.expiresAt) return undefined;
      const remainingTtl = parsed.expiresAt - Date.now();
      this.memory.set(key, parsed.value, remainingTtl);
      return parsed.value as T;
    } catch {
      return undefined;
    }
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.memory.set(key, value, ttlMs);
    if (!this.diskAvailable) return;
    try {
      const path = join(this.dir, safeKeyToFilename(key));
      const entry: PersistedEntry = { value, expiresAt: Date.now() + ttlMs };
      writeFileSync(path, JSON.stringify(entry));
    } catch {
      // disk write failed (read-only FS, etc.) - memory cache still works
    }
  }
}
