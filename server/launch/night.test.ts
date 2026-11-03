// Launch night inside Watchtower: the rules, the state file, and the Launch page's view from the family's cells.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Cell } from "../engine";
import { demoCells } from "../demo";
import { demoLaunchCells, foreverBuild, launchView, loadContent, screenshots, stateFile } from "./night";
import { view } from "../view";
import * as r from "./rules";

const row = (mark: string, label: string, text = "x") => ({ mark, label, text });

describe("readiness", () => {
  test("only launch rows count: languages and the review don't", () => {
    expect(r.readiness([row("✓", "git"), row("!", "deDE"), row("!", "review"), row("!", "cold read")]).light).toBe("green");
  });
  test("a ✗ on interface, CI, game data, version or git is red", () => {
    for (const label of ["interface", "CI", "game data", "version", "git"]) expect(r.readiness([row("✗", label)]).light).toBe("red");
  });
  test("a stale zip, a missing store id or a ✗ elsewhere is amber", () => {
    expect(r.readiness([row("!", "test zip")]).light).toBe("amber");
    expect(r.readiness([row("✗", "store ids")]).light).toBe("amber");
  });
});

describe("in game", () => {
  const ids = ["a", "b"];
  test("none ticked is grey, some amber, all ok green, any broken red", () => {
    expect(r.inGame("x", ids, {}).light).toBe("grey");
    expect(r.inGame("x", ids, { "x/a": "ok" }).light).toBe("amber");
    expect(r.inGame("x", ids, { "x/a": "ok", "x/b": "ok" }).light).toBe("green");
    expect(r.inGame("x", ids, { "x/a": "ok", "x/b": "broken" }).light).toBe("red");
  });
});

describe("the Forever build", () => {
  test("latest.ts's line, both forms", () => {
    expect(r.parseBuild("- forever: wowf 1.60.1.70707 → **1.60.1.70753**\n")).toEqual({ pin: "1.60.1.70707", latest: "1.60.1.70753" });
    expect(r.parseBuild("- forever: wowf 1.60.1.70707, the latest\n")).toEqual({ pin: "1.60.1.70707", latest: "1.60.1.70707" });
    expect(r.parseBuild("nothing")).toBeUndefined();
  });
  test("interface from a build", () => {
    expect(r.interfaceFor("1.60.1.70707")).toBe(16001);
    expect(r.interfaceFor("1.15.9.70576")).toBe(11509);
  });
  test("same version newer build is amber, a new version is red", () => {
    expect(r.buildLight({ pin: "1.60.1.1", latest: "1.60.1.1" }, 16001).light).toBe("green");
    expect(r.buildLight({ pin: "1.60.1.1", latest: "1.60.1.2" }, 16001).light).toBe("amber");
    expect(r.buildLight({ pin: "1.60.1.1", latest: "1.60.2.1" }, 16001).light).toBe("red");
    expect(r.buildLight(undefined, 16001).light).toBe("amber");
  });
});

describe("the other lights", () => {
  test("data chain: a running job amber, a failure red, a waiting PR red after the check time", () => {
    const ok = { workflow: "CI", status: "completed", conclusion: "success" };
    expect(r.chain([{ name: "a", runs: [ok], prs: [] }], 0, 10).light).toBe("green");
    expect(r.chain([{ name: "a", runs: [{ ...ok, status: "in_progress" }], prs: [] }], 0, 10).light).toBe("amber");
    expect(r.chain([{ name: "a", runs: [{ ...ok, conclusion: "failure" }], prs: [] }], 0, 10).light).toBe("red");
    const pr = [{ number: 1, title: "t" }];
    expect(r.chain([{ name: "a", runs: [], prs: pr }], 0, 10).light).toBe("amber");
    expect(r.chain([{ name: "a", runs: [], prs: pr }], 11, 10).light).toBe("red");
  });
  test("infra: slow is amber, down red", () => {
    const p = { name: "s", url: "", status: 200, ms: 100 };
    expect(r.infra([p]).light).toBe("green");
    expect(r.infra([{ ...p, ms: 4000 }]).light).toBe("amber");
    expect(r.infra([{ ...p, status: 503 }]).light).toBe("red");
    expect(r.infra([{ ...p, status: 0, error: "refused" }]).light).toBe("red");
  });
  test("board: only cards on a launch repository; blocked is red", () => {
    const repos = new Set(["yonder"]);
    expect(r.board([{ id: "1", title: "t", status: "blocked", repos: ["other"] }], repos).light).toBe("green");
    expect(r.board([{ id: "1", title: "t", status: "waiting-test", repos: ["yonder"] }], repos).light).toBe("amber");
    expect(r.board([{ id: "1", title: "t", status: "blocked", repos: ["yonder"] }], repos).light).toBe("red");
  });
  test("a skipped or cancelled run is fine, a repo gh gave nothing for is grey, not green", () => {
    const run = (conclusion: string) => ({ workflow: "CI", status: "completed", conclusion });
    expect(r.chain([{ name: "a", runs: [run("skipped"), run("cancelled")], prs: [] }], 0, 10).light).toBe("green");
    expect(r.chain([{ name: "a" }], 0, 10).light).toBe("grey");
    expect(r.worst("green", "grey")).toBe("grey");
    expect(r.worst("grey", "amber")).toBe("amber");
  });
});

describe("changes from the page are checked, never trusted", () => {
  const s0 = r.emptyState();
  test("ticks", () => {
    const s = r.apply(s0, { op: "tick", key: "yonder/tab", value: "broken" }) as r.State;
    expect(s.ticks["yonder/tab"]).toBe("broken");
    expect((r.apply(s, { op: "tick", key: "yonder/tab", value: "untested" }) as r.State).ticks).toEqual({});
    for (const bad of [{ key: "../x", value: "ok" }, { key: "a/b", value: "fine" }, { key: 3, value: "ok" }]) expect(typeof r.apply(s0, { op: "tick", ...bad })).toBe("string");
  });
  test("notes need an addon, a severity and text, and are cut to size", () => {
    expect(typeof r.apply(s0, { op: "note", addon: "x", severity: "bug", text: "  " })).toBe("string");
    expect(typeof r.apply(s0, { op: "note", addon: "x", severity: "huge", text: "t" })).toBe("string");
    const s = r.apply(s0, { op: "note", addon: "x", severity: "bug", text: "y".repeat(5000), shot: "a.png" }) as r.State;
    expect(s.notes[0].text.length).toBe(2000);
    expect(s.notes[0].shot).toBe("a.png");
    expect((r.apply(s, { op: "drop", id: s.notes[0].id }) as r.State).notes).toEqual([]);
  });
  test("steps, answers, and an unknown op", () => {
    expect((r.apply(s0, { op: "step", id: "t", done: true }) as r.State).steps).toEqual({ t: true });
    expect((r.apply(s0, { op: "answer", id: "q", done: true, text: "1.60.1" }) as r.State).answers.q).toEqual({ done: true, text: "1.60.1" });
    expect(typeof r.apply(s0, { op: "rm -rf" })).toBe("string");
  });
  test("the state file survives a restart, and a broken file is an empty state", () => {
    const file = join(mkdtempSync(join(tmpdir(), "launch-")), "sub", "state.json");
    expect(r.readState(file)).toEqual(r.emptyState());
    const s = r.apply(s0, { op: "tick", key: "keyring/drawer", value: "broken" }) as r.State;
    r.writeState(file, s);
    expect(r.readState(file).ticks).toEqual({ "keyring/drawer": "broken" });
    Bun.write(file, "{ not json");
    expect(r.readState(file)).toEqual(r.emptyState());
  });
});


describe("the content and the view", () => {
  const content = loadContent();
  const at = Date.parse(content.launch) - 3600_000;
  const cells = (): Record<string, Cell> => ({ ...demoCells(at), ...demoLaunchCells(content, at) });
  test("nine addons, ranked 1 to 9, every check with its words, and no semicolons", () => {
    expect(content.addons.map((a) => a.rank).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const a of content.addons) {
      expect(a.checks.length).toBeGreaterThan(0);
      for (const c of a.checks) for (const k of ["id", "look", "ok", "todo", "fix"] as const) expect(c[k].length).toBeGreaterThan(0);
    }
    expect(readFileSync(join(import.meta.dir, "night.json"), "utf8")).not.toContain(";");
  });
  test("the Forever build comes from latest.ts's JSON, and an error row says nothing", () => {
    expect(foreverBuild({ builds: [{ game: "forever", pinned: "1.60.1.1", latest: "1.60.1.2" }] })).toEqual({ pin: "1.60.1.1", latest: "1.60.1.2" });
    expect(foreverBuild({ builds: [{ game: "forever", pinned: "1.60.1.1", latest: "", error: "refused" }] })).toBeUndefined();
    expect(foreverBuild({ builds: [] })).toBeUndefined();
    expect(foreverBuild(undefined)).toBeUndefined();
  });
  test("the made-up view names a red addon, an amber build, and draws every panel", () => {
    const v = launchView(content, cells(), r.emptyState(), [], at);
    expect(v.addons).toHaveLength(9);
    expect(v.addons.find((a) => a.id === "keyring")?.light).toBe("red");
    expect(v.overall).toBe("red");
    expect(v.build.light).toBe("amber");
    expect(v.timeline.filter((t) => t.next)).toHaveLength(1);
  });
  test("with nothing read yet it says so, never throws, and is not green", () => {
    const v = launchView(content, {}, r.emptyState(), [], at);
    expect(v.addons[0].readiness.light).toBe("grey");
    expect(v.overall).not.toBe("green");
  });
  test("a failed reading is amber on old data, and the screenshots don't count", () => {
    const c = cells();
    c.status = { at: 0, ms: 0, data: content.addons.map((a) => ({ name: a.id, ahead: 0, behind: 0, dirty: 0, head: "x", runs: [], prs: [] })) };
    c.preflight = { at: 0, ms: 0, data: [] };
    expect(launchView(content, c, r.emptyState(), [], at).sources.light).toBe("green");
    c["launch-shots"] = { ...c["launch-shots"], error: "EPERM: iCloud Drive's root can't be read from here" };
    expect(launchView(content, c, r.emptyState(), [], at).sources.light).toBe("green");
    c.status = { ...c.status, error: "gave up after 180 s" };
    const v = launchView(content, c, r.emptyState(), [], at);
    expect(v.sources.light).toBe("amber");
    expect(v.sources.reasons).toEqual(["status failed: gave up after 180 s"]);
    expect(v.overall).not.toBe("green");
  });
  test("a status answer with no runs or pull requests (gh failed) draws", () => {
    const c = cells();
    c.status = { at: 0, ms: 0, data: content.addons.map((a) => ({ name: a.id, ahead: 0, behind: 0, dirty: 0, head: "x" })) };
    const v = launchView(content, c, r.emptyState(), [], at);
    expect(v.chain.light).toBe("grey");
    expect(v.addons).toHaveLength(9);
  });
  test("the screenshots: only images since the hour before launch, newest first; a folder that can't be read says why", () => {
    const dir = mkdtempSync(join(tmpdir(), "wt-shots-"));
    expect(screenshots(0, dir)).toEqual([]);
    expect(() => screenshots(0, join(dir, "nope"))).toThrow("iCloud Drive's root");
  });
});

describe("after launch night", () => {
  test("the Launch page stays but its lights no longer drive the tray", () => {
    const content = loadContent();
    const cells = { ...demoCells(), ...demoLaunchCells(content) };
    const night = { content, state: r.emptyState() };
    const before = view(cells, [], Date.parse("2026-11-05T12:00:00Z"), night);
    const after = view(cells, [], Date.parse("2026-11-07T12:00:00Z"), night);
    expect(before.pages.find((p) => p.id === "launch")?.light).toBe("red");
    expect(after.pages.find((p) => p.id === "launch")?.light).toBe("red");
    const without = view(cells, [], Date.parse("2026-11-07T12:00:00Z"));
    expect(after.overall).toBe(without.overall);
  });
});

describe("the ticks and notes file", () => {
  const home = () => mkdtempSync(join(tmpdir(), "wt-home-"));
  test("it lives under Watchtower's own cache folder, and WATCHTOWER_STATE moves it", () => {
    expect(stateFile(false, "/tmp", "/h", {}, "/nowhere/s.json")).toBe("/h/.cache/watchtower/launch-night.json");
    expect(stateFile(true, "/tmp", "/h", {})).toBe("/tmp/launch-night-demo.json");
    expect(stateFile(false, "/tmp", "/h", { WATCHTOWER_STATE: "/x/s.json" })).toBe("/x/s.json");
  });
  test("a night saved by launch.ts (addon-kit/.cache) moves over the first time, and never over a newer file", () => {
    const h = home();
    const legacy = join(h, "legacy.json");
    writeFileSync(legacy, JSON.stringify({ ticks: { "yonder/tab": "ok" }, steps: {}, answers: {}, notes: [] }));
    const file = stateFile(false, h, h, {}, legacy);
    expect(r.readState(file).ticks).toEqual({ "yonder/tab": "ok" });
    expect(readFileSync(legacy, "utf8")).toContain("yonder/tab"); // (copied, not moved: nothing is lost)
    writeFileSync(file, JSON.stringify({ ticks: { "keyring/drawer": "broken" }, steps: {}, answers: {}, notes: [] }));
    expect(r.readState(stateFile(false, h, h, {}, legacy)).ticks).toEqual({ "keyring/drawer": "broken" });
  });
  test("no legacy file is no error", () => {
    const h = home();
    mkdirSync(h, { recursive: true });
    expect(r.readState(stateFile(false, h, h, {}, join(h, "none.json")))).toEqual(r.emptyState());
  });
});
