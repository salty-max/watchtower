// The overview's queue (frontend/src/lib/queue.ts) from the demo's real-shaped state: red first, a shared reason said once, nothing green, one slot id per row.
import { describe, expect, test } from "bun:test";
import { demoCells } from "./demo";
import { view } from "./view";
import { queue, quiet } from "../frontend/src/lib/queue";

const NOW = Date.parse("2026-11-03T16:30:00Z");
const s = view(demoCells(NOW), [], NOW) as never;

describe("the queue", () => {
  const items = queue(s);
  test("red rows come before amber, amber before grey, and none is green", () => {
    const order = { red: 0, amber: 1, grey: 2 } as Record<string, number>;
    expect(items.every((i) => i.light in order)).toBe(true);
    expect(items.map((i) => order[i.light])).toEqual([...items.map((i) => order[i.light])].sort());
    expect(items.some((i) => i.light === "red")).toBe(true);
  });
  test("every row has its own id, which is its fix slot's", () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test("a reason most addons share is one row naming them", () => {
    const shared = items.filter((i) => i.names && i.names.length >= 3 && i.page === "releases");
    for (const r of shared) expect(r.where).toMatch(/^\d+ of \d+ addons$/);
  });
  test("the quiet line counts what is green", () => {
    const q = quiet(s);
    expect(q.storesOf).toBe((s as never as { stores: { stores: unknown[] } }).stores.stores.length);
    expect(q.stores).toBeLessThanOrEqual(q.storesOf);
  });
});

describe("what the dedupes must not hide", () => {
  const base = (over: Record<string, unknown>) => ({ releases: { addons: [], repos: [], verdict: { light: "green", reasons: [] } }, data: { jobs: [], prs: [], builds: { light: "green", reasons: [] }, errors: [], verdict: { light: "green", reasons: [] } }, stores: { stores: [], verdict: { light: "green", reasons: [] } }, zips: { zips: [], verdict: { light: "green", reasons: [] } }, ...over }) as never;
  test("a git cross on an addon does not hide its repository's red CI", () => {
    const s = base({ releases: { addons: [{ name: "yonder", rows: [{ mark: "✗", label: "git", text: "1 ahead" }], verdict: { light: "red", reasons: [] } }], repos: [{ name: "yonder", verdict: { light: "red", reasons: ["1 unpushed", "CI failure"] } }], verdict: { light: "red", reasons: [] } } });
    const items = queue(s);
    expect(items.some((i) => i.what === "CI failure" && i.light === "red")).toBe(true);
    expect(items.some((i) => i.what === "1 unpushed")).toBe(false);
  });
  test("the Data page's failed reading shows, amber, and not-answered shows grey", () => {
    const s = base({ data: { jobs: [], prs: [], builds: { light: "green", reasons: [] }, errors: [], verdict: { light: "amber", reasons: ["data-prs failed, showing its last answer: boom", "latest has not answered yet"] } } });
    const items = queue(s);
    expect(items.map((i) => i.light)).toEqual(["amber", "grey"]);
  });
  test("a Classic build reason stays when launch night says Forever's", () => {
    const s = base({ launch: { build: { light: "amber", reasons: ["forever moved"] }, infra: { reasons: [] }, sources: { reasons: [] }, addons: [] }, data: { jobs: [], prs: [], builds: { light: "amber", reasons: ["forever moved", "classic: pin behind"] }, errors: [], verdict: { light: "amber", reasons: [] } } });
    expect(queue(s).some((i) => i.what === "classic: pin behind")).toBe(true);
  });
});
