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
  test("a red CI on an addon keeps the repository line's fix and prompt on its row", () => {
    const fix = { key: "keyring/ci/CI", state: "offered" };
    const s = base({ releases: { addons: [{ name: "keyring", rows: [{ mark: "✗", label: "CI", text: "failure on HEAD" }], verdict: { light: "red", reasons: [] }, fix: { key: "keyring/release/preflight" } }], repos: [{ name: "keyring", verdict: { light: "red", reasons: ["CI failure"] }, fix, prompt: "fix the CI" }], verdict: { light: "red", reasons: [] } } });
    const rows = queue(s).filter((i) => i.where === "keyring");
    expect(rows).toHaveLength(1);
    expect(rows[0].fix).toEqual(fix);
    expect(rows[0].prompt).toBe("fix the CI");
  });
  test("a pull request's reason loses its own name and title", () => {
    const s = base({ data: { jobs: [], prs: [{ repo: "wow-data", number: 42, title: "pins: forever", verdict: { light: "red", reasons: ["wow-data #42 pins: forever: its checks failure"] } }], builds: { light: "green", reasons: [] }, errors: [], verdict: { light: "red", reasons: [] } } });
    expect(queue(s)[0].what).toBe("pins: forever: its checks failure");
  });
  test("commits to push on a repository that is dirty, behind or unread are in the way, and a CI that is not success is red", () => {
    const s = base({ releases: { addons: [], repos: [
      { name: "wow-data", ahead: 2, behind: 0, dirty: 3, verdict: { light: "green", reasons: [] } },
      { name: "addon-kit", ahead: 0, behind: 0, dirty: 0, verdict: { light: "amber", reasons: ["CI timed_out"] } },
    ], verdict: { light: "amber", reasons: [] } } });
    const items = queue(s);
    expect(items.find((i) => i.where === "wow-data")?.light).toBe("red");
    expect(items.find((i) => i.where === "addon-kit")?.light).toBe("red");
  });
  test("an addon's fix sits on its first row only", () => {
    const fix = { key: "yonder/release/preflight" };
    const s = base({ releases: { addons: [{ name: "yonder", fix, rows: [{ mark: "✗", label: "git", text: "x" }, { mark: "✗", label: "interface", text: "y" }], verdict: { light: "red", reasons: [] } }], repos: [], verdict: { light: "red", reasons: [] } } });
    expect(queue(s).filter((i) => i.fix)).toHaveLength(1);
  });
  test("an addon with no CurseForge project is not a reading that failed", () => {
    const s = base({ stores: { stores: [{ repo: "goodwill", read: false, why: "not-on-curseforge", verdict: { light: "grey", reasons: ["not on CurseForge"] } }], verdict: { light: "grey", reasons: [] } } });
    expect(queue(s)).toHaveLength(0);
  });
});
