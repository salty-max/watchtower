// The last good reading of every source, kept on disk so the next start draws
// at once and reads again in the background. A file counts only when it is this
// build's shape (CACHE_VERSION), the same source with the same argv (its
// fingerprint) and the kind of data the pages expect: anything else is dropped,
// never trusted. Only a successful reading is ever written, so an error can't
// replace a good answer. Best effort throughout: a cache that can't be read or
// written is a cold start, never a failure.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Bump when a source's JSON changes shape or the Cell does: every older file is then dropped. */
export const CACHE_VERSION = 1;

export type Shape = "array" | "object";
export type Saved = { at: number; ms: number; data: unknown };
/** What the engine asks of a cache. */
export type Store = {
  load(keys: Record<string, { key: string; shape?: Shape }>): Record<string, Saved>;
  save(id: string, key: string, cell: Saved): void;
};

export const cacheDir = () => process.env.WATCHTOWER_CACHE || join(homedir(), ".cache", "watchtower", "readings");

const fits = (data: unknown, shape?: Shape) => data !== null && data !== undefined && (shape === "array" ? Array.isArray(data) : shape === "object" ? typeof data === "object" && !Array.isArray(data) : true);
const safeId = (id: string) => /^[a-z0-9-]+$/.test(id);

export class DiskCache implements Store {
  constructor(private dir: string = cacheDir()) {}

  load(keys: Record<string, { key: string; shape?: Shape }>): Record<string, Saved> {
    const out: Record<string, Saved> = {};
    for (const [id, want] of Object.entries(keys)) {
      if (!safeId(id)) continue;
      try {
        const f = JSON.parse(readFileSync(join(this.dir, `${id}.json`), "utf8"));
        if (f?.version !== CACHE_VERSION || f.id !== id || f.key !== want.key) continue;
        if (!Number.isFinite(f.at) || !Number.isFinite(f.ms) || !fits(f.data, want.shape)) continue;
        out[id] = { at: f.at, ms: f.ms, data: f.data };
      } catch {
        // (missing, unreadable or corrupt: a cold read of this source)
      }
    }
    return out;
  }

  save(id: string, key: string, cell: Saved) {
    if (!safeId(id) || cell.data === undefined) return;
    try {
      mkdirSync(this.dir, { recursive: true });
      const file = join(this.dir, `${id}.json`);
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ version: CACHE_VERSION, id, key, at: cell.at, ms: cell.ms, data: cell.data }));
      renameSync(tmp, file);
    } catch {
      // (read-only disk, full disk: the next start reads cold)
    }
  }

  /** Leftover temporary files of a crashed write. */
  sweep() {
    try {
      for (const n of readdirSync(this.dir)) if (n.endsWith(".tmp")) rmSync(join(this.dir, n), { force: true });
    } catch {
      // (no folder yet)
    }
  }
}
