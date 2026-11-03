// The window's list of what to do (frontend/src/lib/queue.ts) from the demo's real-shaped state and from small made-up ones: red first, one sentence each, a shared thing said once, nothing hidden by a dedupe.
import { describe, expect, test } from "bun:test";
import { demoCells } from "./demo";
import { view } from "./view";
import { itemsFor, queue, quiet, waitingToPush } from "../frontend/src/lib/queue";

const NOW = Date.parse("2026-11-03T16:30:00Z");
const demo = view(demoCells(NOW), [], NOW) as never;
const ok = { light: "green", reasons: [] };
const base = (over: Record<string, unknown>) => ({ releases: { addons: [], repos: [], verdict: ok }, data: { jobs: [], prs: [], builds: ok, errors: [], verdict: ok }, stores: { stores: [], verdict: ok }, zips: { zips: [], verdict: ok }, ...over }) as never;
const addon = (name: string, rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ name, rows, verdict: { light: rows.some((r) => r.mark === "✗") ? "red" : "amber", reasons: [] }, ...extra });
const repo = (name: string, over: Record<string, unknown> = {}) => ({ name, branch: "main", ahead: 0, behind: 0, dirty: 0, verdict: ok, ...over });

describe("the list", () => {
  const items = queue(demo);
  test("red comes before amber, amber before grey, and every id is its own", () => {
    const order = { red: 0, amber: 1, grey: 2 } as Record<string, number>;
    expect(items.map((i) => order[i.light])).toEqual(items.map((i) => order[i.light]).sort());
    expect(items.some((i) => i.light === "red")).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
  test("every item is a sentence: who it is about, then what is true", () => {
    for (const i of items) {
      expect(i.who.length).toBeGreaterThan(0);
      expect(i.what.length).toBeGreaterThan(8);
      expect(i.what).not.toContain(";");
    }
  });
  test("the quiet line counts what is green", () => {
    const q = quiet(demo);
    expect(q.stores).toBeLessThanOrEqual(q.storesOf);
  });
  test("waitingToPush lists repositories with commits not pushed", () => {
    expect(waitingToPush(demo).every((p) => p.ahead > 0)).toBe(true);
  });
});

describe("what each kind of light says", () => {
  test("a git stop is a sentence about commits behind origin and what to do, and does not hide a red CI", () => {
    const s = base({ releases: { addons: [addon("yonder", [{ mark: "✗", label: "git", text: "1 to pull: release.sh wants main clean and in sync" }])], repos: [repo("yonder", { behind: 1, verdict: { light: "red", reasons: ["1 behind origin", "CI failure"] } })], verdict: ok } });
    const items = queue(s);
    expect(items.find((i) => i.id === "rel/yonder/git")?.what).toContain("one commit behind origin. Pull it before a release.");
    expect(items.some((i) => /failed CI run/.test(i.what) && i.light === "red")).toBe(true);
    expect(items.some((i) => /behind origin/.test(i.what) && i.id.startsWith("repo/"))).toBe(false);
  });
  test("a reason most addons share is one item naming them, and a tool is never one of them", () => {
    const row = (n: string) => addon(n, [{ mark: "!", label: "review", text: "none recorded" }]);
    const s = base({ launch: { build: { reasons: [] }, infra: { reasons: [] }, sources: { reasons: [] }, addons: ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), inGame: { light: "green" }, checks: [] })) }, releases: { addons: [row("a"), row("b"), row("c"), row("wow-locker")], repos: [], verdict: ok } });
    const items = queue(s);
    const shared = items.find((i) => i.addons);
    expect(shared?.who).toBe("All three addons");
    expect(shared?.what).toBe("have commits with no review yet.");
    expect(shared?.addons).toEqual(["a", "b", "c"]);
    expect(items.some((i) => i.who === "wow-locker")).toBe(true);
  });
  test("commits to push on a repository that is dirty or behind are in the way, a failed CI run is red", () => {
    const s = base({ releases: { addons: [], repos: [repo("wow-data", { ahead: 2, dirty: 3 }), repo("addon-kit", { verdict: { light: "amber", reasons: ["CI timed_out"] } })], verdict: ok } });
    const items = queue(s);
    expect(items.find((i) => i.who === "wow-data")?.light).toBe("red");
    expect(items.find((i) => i.who === "addon-kit")?.what).toContain("failed CI run");
  });
  test("a pull request is a sentence, and a Players one says to read it first", () => {
    const pr = (kind: string, reason: string) => ({ repo: "wow-data", number: 42, title: "pins: forever", kind, verdict: { light: kind === "players" ? "amber" : "red", reasons: [reason] } });
    expect(queue(base({ data: { jobs: [], prs: [pr("pins", "wow-data #42 pins: forever: its checks failure")], builds: ok, errors: [], verdict: ok } }))[0].what).toBe("has pull request #42 (pins: forever) with failing checks.");
    expect(queue(base({ data: { jobs: [], prs: [pr("players", "strangers")], builds: ok, errors: [], verdict: ok } }))[0].what).toContain("Read it line by line");
  });
  test("an addon with no CurseForge project is not a reading that failed", () => {
    const s = base({ stores: { stores: [{ repo: "goodwill", read: false, why: "not-on-curseforge", verdict: { light: "grey", reasons: ["x"] } }], verdict: ok } });
    expect(queue(s)).toHaveLength(0);
  });
});

describe("fixes and prompts", () => {
  test("an addon whose only stop is CI keeps the repository line's CI fix and prompt", () => {
    const fix = { key: "keyring/ci/CI", state: "offered" };
    const s = base({ releases: { addons: [addon("keyring", [{ mark: "✗", label: "CI", text: "failure on HEAD" }], { prompt: "p" })], repos: [repo("keyring", { verdict: { light: "red", reasons: ["CI failure"] }, fix, prompt: "fix the CI" })], verdict: ok } });
    const row = queue(s).find((i) => i.who === "keyring")!;
    expect(row.fix).toEqual(fix);
    expect(row.prompt).toBe("fix the CI");
  });
  test("an addon's release fix sits on its first item only", () => {
    const fix = { key: "yonder/release/preflight" };
    const s = base({ releases: { addons: [addon("yonder", [{ mark: "✗", label: "git", text: "x" }, { mark: "✗", label: "interface", text: "y" }], { fix })], repos: [], verdict: ok } });
    expect(queue(s).filter((i) => i.fix)).toHaveLength(1);
  });
  test("an item with no fix carries no prompt to copy", () => {
    const s = base({ releases: { addons: [addon("x", [{ mark: "!", label: "CI", text: "last run not on HEAD" }], { prompt: "p" })], repos: [], verdict: ok } });
    expect(queue(s)[0].prompt).toBeUndefined();
  });
  test("a tool that errors gets its source fix on the reading's item", () => {
    const fix = { key: "addon-kit/source/status", kind: "source", page: "releases", state: "offered" };
    const s = base({ fixes: [fix], releases: { addons: [], repos: [], verdict: { light: "amber", reasons: ["status failed, showing its last answer: boom"] } } });
    expect(queue(s)[0].fix).toEqual(fix);
  });
  test("a failed reading on the Data page shows amber, and one never answered shows grey", () => {
    const s = base({ data: { jobs: [], prs: [], builds: ok, errors: [], verdict: { light: "amber", reasons: ["data-prs failed, showing its last answer: boom", "latest has not answered yet"] } } });
    expect(queue(s).map((i) => i.light)).toEqual(["amber", "grey"]);
  });
  test("a Classic build reason stays when launch night says Forever's", () => {
    const s = base({ launch: { build: { light: "amber", reasons: ["forever moved"] }, infra: { reasons: [] }, sources: { reasons: [] }, addons: [] }, data: { jobs: [], prs: [], builds: { light: "amber", reasons: ["forever: 1.60.1.1 is pinned, wago.tools has 1.60.1.2", "classic: pin behind"] }, errors: [], verdict: ok } });
    const items = queue(s);
    expect(items.some((i) => i.who === "Classic")).toBe(true);
    expect(items.some((i) => /newer build, 1\.60\.1\.2/.test(i.what) && i.id.startsWith("build/"))).toBe(false);
  });
});

describe("one addon", () => {
  test("itemsFor is only that addon's own, and the shared ones are said for it alone", () => {
    const row = (n: string) => addon(n, [{ mark: "!", label: "review", text: "none recorded" }]);
    const s = base({ releases: { addons: [row("a"), row("b"), row("c")], repos: [], verdict: ok } });
    const mine = itemsFor(s, "a");
    expect(mine).toHaveLength(1);
    expect(mine[0].what).toBe("has commits with no review yet.");
    expect(mine[0].addons).toBeUndefined();
  });
});

describe("nothing to do before launch, and a plain pull", () => {
  const launchState = (open: boolean) => ({ build: { reasons: [] }, infra: { reasons: [] }, sources: { reasons: [] }, open, addons: ["a", "b"].map((id) => ({ id, name: id.toUpperCase(), inGame: { light: "grey" }, checks: [] })) });
  test("before launch an untested in-game check is not a thing to do, and after launch it is", () => {
    expect(queue(base({ launch: launchState(false) }))).toHaveLength(0);
    const after = queue(base({ launch: launchState(true) }));
    expect(after).toHaveLength(2);
    expect(after[0].what).toBe("has not been tested in the game yet.");
  });
  test("an addon that is only behind origin gets a pull and no fix; one that is also dirty or ahead keeps its fix", () => {
    const fix = { key: "yonder/release/preflight", state: "offered" };
    const git = [{ mark: "✗", label: "git", text: "1 to pull: release.sh wants main clean and in sync" }];
    const pullable = base({ releases: { addons: [addon("yonder", git, { fix })], repos: [repo("yonder", { behind: 1, verdict: { light: "amber", reasons: ["1 behind origin"] } })], verdict: ok } });
    const item = queue(pullable)[0];
    expect(item.pull).toBe("yonder");
    expect(item.fix).toBeUndefined();
    expect(item.prompt).toBeUndefined();
    const dirty = base({ releases: { addons: [addon("yonder", git, { fix })], repos: [repo("yonder", { behind: 1, dirty: 2, verdict: { light: "amber", reasons: ["1 behind origin"] } })], verdict: ok } });
    expect(queue(dirty)[0].pull).toBeUndefined();
    expect(queue(dirty)[0].fix).toEqual(fix);
  });
  test("a tool repository that is only behind gets a pull too", () => {
    const s = base({ releases: { addons: [], repos: [repo("wow-data", { behind: 2, verdict: { light: "amber", reasons: ["2 behind origin"] } })], verdict: ok } });
    expect(queue(s)[0].pull).toBe("wow-data");
  });
  test("a behind repository that is not on main keeps its fix and gets no pull", () => {
    const fix = { key: "yonder/release/preflight", state: "offered" };
    const s = base({ releases: { addons: [addon("yonder", [{ mark: "✗", label: "git", text: "x" }], { fix })], repos: [repo("yonder", { branch: "wip", behind: 1, verdict: { light: "amber", reasons: ["1 behind origin"] } })], verdict: ok } });
    expect(queue(s)[0].pull).toBeUndefined();
    expect(queue(s)[0].fix).toEqual(fix);
  });
});
