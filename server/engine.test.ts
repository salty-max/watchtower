// The engine: one flight at a time, an old answer kept (and marked) when the next fails, launch night's window.
import { describe, expect, test } from "bun:test";
import { Engine, readJson } from "./engine";
import { view } from "./view";

const NOON = Date.parse("2026-11-03T12:00:00Z");
const NIGHT = Date.parse("2026-11-05T00:00:00Z");

describe("the engine", () => {
  test("two refreshes while one is in flight run the source once", async () => {
    let n = 0;
    const e = new Engine({ a: { every: 1e12, get: async () => (await Bun.sleep(20), ++n) } }, () => NOON);
    await Promise.all([e.refresh("a"), e.refresh("a")]);
    expect(n).toBe(1);
    expect(e.cells.a.data).toBe(1);
  });
  test("a failure keeps the last answer and marks it", async () => {
    let fail = false;
    const e = new Engine({ a: { every: 1e12, get: async () => (fail ? Promise.reject(new Error("gave up")) : "old") } }, () => NOON);
    await e.refresh("a");
    fail = true;
    await e.refresh("a");
    expect(e.cells.a).toMatchObject({ data: "old", error: "gave up" });
  });
  test("a failed answer shows as amber on its page, never green, and a source that never answered as grey", async () => {
    const e = new Engine({ stores: { every: 1e12, get: async () => [] } }, () => NOON);
    await e.refresh("stores");
    expect(view(e.cells, [], NOON).stores.verdict.light).toBe("green");
    e.cells.stores = { ...e.cells.stores, error: "no JSON" };
    expect(view(e.cells, [], NOON).stores.verdict.light).toBe("amber");
    expect(view({ stores: { at: 1, ms: 1, error: "boom" } }, [], NOON).stores.verdict.light).toBe("grey");
  });
  test("a source that never answered turns its page grey, the zips and the board included", () => {
    const answered = { at: 1, ms: 1, data: [] };
    const v = view({ status: answered, preflight: answered, board: { at: 1, ms: 1, error: "boom" }, zips: { at: 1, ms: 1, error: "EPERM" } }, [], NOON);
    expect(v.releases.verdict.light).toBe("grey");
    expect(v.zips.verdict.light).toBe("grey");
    expect(v.zips.verdict.reasons.join(" ")).toContain("EPERM");
  });
  test("Object's own names are not sources", async () => {
    const e = new Engine({}, () => NOON);
    expect(e.has("toString")).toBe(false);
    await expect(e.refresh("__proto__")).rejects.toThrow("no source");
  });
  test("unknown source rejects", async () => {
    await expect(new Engine({}, () => NOON).refresh("x")).rejects.toThrow("no source x");
  });
  test("in launch night's window nothing runs and the old answers stay", async () => {
    let n = 0;
    let now = NOON;
    const e = new Engine({ a: { every: 1e12, get: async () => ++n } }, () => now);
    await e.refresh("a");
    now = NIGHT;
    await e.refresh("a");
    expect(n).toBe(1);
    expect(e.cells.a).toMatchObject({ data: 1, paused: true });
    now = NIGHT + 7 * 3600_000;
    await e.refresh("a");
    expect(n).toBe(2);
  });
});

describe("reading a tool's JSON", () => {
  const src = { id: "x", label: "x", argv: ["bun", "t.ts", "--json"], everyMin: 5, timeoutSec: 1 };
  test("a non-zero exit with JSON still counts (preflight exits 1 while a ✗ stands)", async () => {
    expect(await readJson(async () => ({ out: '[{"a":1}]', code: 1, timedOut: false }), src)).toEqual([{ a: 1 }]);
  });
  test("text instead of JSON is an error that says what it printed", async () => {
    await expect(readJson(async () => ({ out: "gh: not logged in\n", code: 1, timedOut: false }), src)).rejects.toThrow("gh: not logged in");
  });
  test("a timeout is an error", async () => {
    await expect(readJson(async () => ({ out: "", code: 143, timedOut: true }), src)).rejects.toThrow("gave up after 1 s");
  });
  test("a view of nothing is every page grey, none green", () => {
    const v = view({}, [], NOON);
    expect(v.pages.every((p) => p.light === "grey")).toBe(true);
  });
});
