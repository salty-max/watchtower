// The disk cache: a good reading comes back, anything doubtful is dropped, an error never replaces a good answer.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CACHE_VERSION, DiskCache } from "./cache";
import { Engine, staleCache } from "./engine";
import { view } from "./view";

const NOON = Date.parse("2026-11-03T12:00:00Z");
let dir: string;
beforeEach(() => void (dir = mkdtempSync(join(tmpdir(), "wt-cache-"))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const want = { a: { key: "bun a --json", shape: "array" as const } };

describe("the disk cache", () => {
  test("a saved reading comes back with its time", () => {
    const c = new DiskCache(dir);
    c.save("a", "bun a --json", { at: 5, ms: 7, data: [1] });
    expect(c.load(want)).toEqual({ a: { at: 5, ms: 7, data: [1] } });
  });
  test("a corrupt file is a cold read, not a crash", () => {
    writeFileSync(join(dir, "a.json"), '{"version": 1, "id": "a", "da');
    expect(new DiskCache(dir).load(want)).toEqual({});
  });
  test("another version, source, argv or shape is dropped", () => {
    const put = (o: object) => writeFileSync(join(dir, "a.json"), JSON.stringify({ version: CACHE_VERSION, id: "a", key: "bun a --json", at: 1, ms: 1, data: [], ...o }));
    const c = new DiskCache(dir);
    put({});
    expect(Object.keys(c.load(want))).toEqual(["a"]);
    put({ version: CACHE_VERSION + 1 });
    expect(c.load(want)).toEqual({});
    put({ id: "b" });
    expect(c.load(want)).toEqual({});
    put({ key: "bun a --other" });
    expect(c.load(want)).toEqual({});
    put({ data: { not: "an array" } });
    expect(c.load(want)).toEqual({});
    put({ data: null });
    expect(c.load(want)).toEqual({});
    put({ at: "yesterday" });
    expect(c.load(want)).toEqual({});
  });
  test("a source id can't walk out of the folder", () => {
    const c = new DiskCache(dir);
    c.save("../x", "k", { at: 1, ms: 1, data: [] });
    expect(c.load({ "../x": { key: "k" } })).toEqual({});
  });
});

describe("the engine with a cache", () => {
  const def = (get: () => Promise<unknown>) => ({ a: { every: 60_000, key: "bun a --json", shape: "array" as const, get } });

  test("it starts from the cached reading, marked, and a live one replaces it and is written", async () => {
    const c = new DiskCache(dir);
    c.save("a", "bun a --json", { at: NOON - 1000, ms: 9, data: ["old"] });
    const e = new Engine(def(async () => ["new"]), () => NOON, new DiskCache(dir));
    expect(e.cells.a).toMatchObject({ data: ["old"], cached: true, everyMs: 60_000 });
    await e.refresh("a");
    expect(e.cells.a.data).toEqual(["new"]);
    expect(e.cells.a.cached).toBeUndefined();
    expect(JSON.parse(readFileSync(join(dir, "a.json"), "utf8")).data).toEqual(["new"]);
  });
  test("a failing reading never overwrites the good one on disk", async () => {
    const c = new DiskCache(dir);
    c.save("a", "bun a --json", { at: NOON, ms: 1, data: ["good"] });
    const e = new Engine(def(() => Promise.reject(new Error("gave up"))), () => NOON, new DiskCache(dir));
    await e.refresh("a");
    expect(e.cells.a).toMatchObject({ data: ["good"], error: "gave up", cached: true });
    expect(JSON.parse(readFileSync(join(dir, "a.json"), "utf8")).data).toEqual(["good"]);
  });
  test("a cached reading older than its interval is amber on its page, a younger one is not", () => {
    const old = { at: NOON - 3_600_000, ms: 1, data: [], cached: true, everyMs: 30 * 60_000 };
    const fresh = { ...old, at: NOON - 60_000 };
    expect(staleCache(old, NOON)).toBe(true);
    expect(staleCache(fresh, NOON)).toBe(false);
    expect(staleCache({ ...old, cached: undefined }, NOON)).toBe(false);
    expect(view({ stores: old }, [], NOON).stores.verdict.light).toBe("amber");
    expect(view({ stores: old }, [], NOON).stores.verdict.reasons.join(" ")).toContain("cached");
    expect(view({ stores: fresh }, [], NOON).stores.verdict.light).toBe("green");
    expect(view({ stores: old }, [], NOON).ages.stores).toMatchObject({ cached: true, stale: true });
  });
  test("a live reading clears the stale mark: the page is green again", async () => {
    new DiskCache(dir).save("stores", "k", { at: NOON - 3_600_000, ms: 1, data: [] });
    const e = new Engine({ stores: { every: 60_000, key: "k", shape: "array", get: async () => [] } }, () => NOON, new DiskCache(dir));
    expect(view(e.cells, [], NOON).stores.verdict.light).toBe("amber");
    await e.refresh("stores");
    expect(view(e.cells, [], NOON).stores.verdict.light).toBe("green");
  });
  test("a paused cached reading in launch night's window is not called stale", () => {
    expect(staleCache({ at: NOON - 3_600_000, ms: 1, data: [], cached: true, everyMs: 60_000, paused: true }, NOON)).toBe(false);
  });
  test("a source with no key is never kept on disk", async () => {
    const e = new Engine({ a: { every: 1e12, get: async () => ["x"] } }, () => NOON, new DiskCache(dir));
    await e.refresh("a");
    expect(existsSync(join(dir, "a.json"))).toBe(false);
  });
});
