import type { z } from "zod";
import { Outdated, SignedOut, Unreachable, type OwnerData, type Result } from "../shared/data";
import { API_VERSION, ENDPOINTS, type Range } from "../shared/schema";

/**
 * The phone app's data layer: the owner API at the server it was loaded from,
 * with the owner's cookie (which the page cannot read and the browser sends).
 * Every answer is checked against the schemas, a quiet minute is a 304 (the
 * ETag of the last answer is sent back), and when the server does not answer
 * the last good answer is shown, marked stale: from memory, or from the phone's
 * own storage after the app was closed. It takes its fetch and its storage as
 * arguments, so a test can run it against the inbox's own app in the same process.
 */
export type Store = { get(key: string): string | null; set(key: string, value: string): void };

type Options = { base?: string; fetch?: typeof fetch; store?: Store; now?: () => number };
type Kept = { at: number; etag: string | null; body: unknown };

export function remote(options: Options = {}): OwnerData {
  const base = options.base ?? "";
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const memory = new Map<string, Kept>();
  const keep = (path: string) => `watchtower:${path}`;

  const stored = (path: string): Kept | null => {
    try {
      const raw = options.store?.get(keep(path));
      return raw ? (JSON.parse(raw) as Kept) : null;
    } catch {
      return null;
    }
  };

  // (also on a 304: the time the numbers were last confirmed is what an offline start tells)
  const save = (path: string, kept: Kept) => {
    try {
      options.store?.set(keep(path), JSON.stringify(kept));
    } catch {
      // (a full or refused store: the app works without it)
    }
  };

  async function read<T>(path: string, schema: z.ZodType<T>): Promise<Result<T>> {
    const known = memory.get(path) ?? stored(path);
    const older = (): Result<T> => {
      const parsed = known ? schema.safeParse(known.body) : null;
      if (!known || !parsed?.success) throw new Unreachable();
      return { data: parsed.data, at: known.at, stale: true };
    };
    let res: Response;
    try {
      res = await doFetch(base + path, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json", ...(memory.get(path)?.etag ? { "if-none-match": memory.get(path)!.etag! } : {}) } });
    } catch {
      return older();
    }
    if (res.status === 401 || res.status === 403) throw new SignedOut();
    if (res.status === 304 && memory.has(path)) {
      const kept = { ...memory.get(path)!, at: now() };
      memory.set(path, kept);
      save(path, kept);
      return { data: schema.parse(kept.body), at: kept.at, stale: false };
    }
    if (res.status === 404) return older(); // (switched off at the server: what was read before, marked as old, or nothing)
    if (!res.ok) return older();
    const body: unknown = await res.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const version = (body as { apiVersion?: unknown } | null)?.apiVersion;
      if (typeof version === "number" && version !== API_VERSION) throw new Outdated(version);
      return older();
    }
    const kept: Kept = { at: now(), etag: res.headers.get("etag"), body };
    memory.set(path, kept);
    save(path, kept);
    return { data: parsed.data, at: kept.at, stale: false };
  }

  const E = ENDPOINTS;
  return {
    summary: () => read(E.summary.path, E.summary.schema),
    numbers: (range: Range) => read(`${E.numbers.path}?range=${range}`, E.numbers.schema),
    players: () => read(E.players.path, E.players.schema),
    comments: () => read(E.comments.path, E.comments.schema),
    activity: () => read(E.activity.path, E.activity.schema),
    releases: () => read(E.releases.path, E.releases.schema),
  };
}
