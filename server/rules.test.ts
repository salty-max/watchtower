// The rules, read from real tool output (testdata/) and from broken output.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as r from "./rules";

const read = <T>(name: string): T => JSON.parse(readFileSync(join(import.meta.dir, "testdata", name), "utf8"));
const preflight = read<r.Preflight[]>("preflight.json");
const status = read<r.Repo[]>("status.json");
const dataPrs = read<r.DataPrs>("data-prs.json");
const latest = read<r.Latest>("latest.json");
const stores = read<r.Store[]>("stores.json");
const NOW = Date.parse("2026-11-03T16:30:00Z");

const row = (mark: string, label = "x"): r.Row => ({ mark, label, text: "t" });
const pf = (rows: r.Row[]): r.Preflight => ({ name: "a", total: 1, ships: [], rows, verdict: "v" });

describe("worst and the summary", () => {
  test("grey ranks above green, below amber", () => {
    expect(r.worst("green", "grey")).toBe("grey");
    expect(r.worst("grey", "amber")).toBe("amber");
    expect(r.worst("amber", "red", "green")).toBe("red");
  });
  test("the window opens on the worst page, the first on a tie", () => {
    expect(r.summary({ releases: "green", data: "amber", stores: "red", zips: "red" })).toEqual({ overall: "red", open: "stores" });
    expect(r.summary({ releases: "green", data: "green", stores: "green", zips: "green" })).toEqual({ overall: "green", open: "releases" });
  });
});

describe("releases", () => {
  test("a ✗ is in the way, a ! wants a look, neither is ready", () => {
    expect(r.release(pf([row("✓"), row("✗", "CI")])).verdict.light).toBe("red");
    expect(r.release(pf([row("✓"), row("!", "review")])).verdict.light).toBe("amber");
    expect(r.release(pf([row("✓"), row("·")])).verdict.light).toBe("green");
  });
  test("the reasons name the label and put ✗ first", () => {
    const v = r.release(pf([row("!", "review"), row("✗", "CI")]));
    expect(v.verdict.reasons).toEqual(["CI: t", "review: t"]);
  });
  test("every real report gets a light and its own verdict line", () => {
    for (const p of preflight) {
      const x = r.release(p);
      expect(x.said).toBe(p.verdict);
      expect(["green", "amber", "red"]).toContain(x.verdict.light);
    }
  });
  test("a repository: CI red is red, a run in flight amber, unpushed commits shown but not judged", () => {
    const base: r.Repo = { name: "yonder", branch: "main", ahead: 0, behind: 0, dirty: 0, head: "abc x" };
    const run = (workflow: string, conclusion: string, status = "completed"): r.Run => ({ workflow, conclusion, status });
    expect(r.repoLine({ ...base, runs: [run("CI", "failure")] }, []).verdict.light).toBe("red");
    expect(r.repoLine({ ...base, runs: [run("Game data", "failure")] }, []).verdict.light).toBe("amber");
    expect(r.repoLine({ ...base, runs: [run("CI", "", "in_progress")] }, []).verdict.light).toBe("amber");
    expect(r.repoLine({ ...base, ahead: 3, dirty: 2, runs: [run("CI", "success")] }, []).verdict.light).toBe("green");
    expect(r.repoLine({ ...base, behind: 1 }, []).verdict.light).toBe("amber");
    expect(r.repoLine({ ...base, ghFailed: true }, []).verdict.light).toBe("grey");
  });
  test("unpushed commits name the cards that hold the repository, a done card not", () => {
    const base: r.Repo = { name: "yonder", branch: "main", ahead: 2, behind: 0, dirty: 0, head: "x" };
    const cards = [
      { id: "c1", title: "t", status: "running", repos: ["yonder", "keyring"] },
      { id: "c2", title: "t", status: "done", repos: ["yonder"] },
      { id: "c3", title: "t", status: "waiting-test", repos: ["keyring"] },
    ];
    expect(r.repoLine(base, cards).cards.map((c) => c.id)).toEqual(["c1"]);
  });
  test("every real repository reads", () => {
    for (const s of status) expect(r.repoLine(s, []).name).toBe(s.name);
  });
});

describe("data", () => {
  const job = (over: Omit<Partial<r.Job>, "run"> & { run?: Partial<r.JobRun> | null }): r.Job => ({
    repo: "yonder",
    workflow: "game-data.yml",
    label: "Game data",
    mark: "✓",
    text: "success, today",
    ...over,
    run: over.run === null ? undefined : { conclusion: "success", createdAt: "x", status: "completed", url: "u", ...over.run },
  });
  test("a daily job: red when it failed, amber while it runs, grey unread or never run", () => {
    expect(r.job(job({ run: { conclusion: "failure" } })).light).toBe("red");
    expect(r.job(job({ run: { status: "in_progress", conclusion: "" } })).light).toBe("amber");
    expect(r.job(job({ run: null })).light).toBe("grey");
    expect(r.job(job({ error: "gh: rate limit" })).light).toBe("grey");
    expect(r.job(job({})).light).toBe("green");
  });
  const pr = (kind: r.DataPr["kind"], over: Partial<r.DataPr> = {}): r.DataPr => ({ repo: "wow-data", number: 1, title: "t", branch: "b", kind, createdAt: new Date(NOW - 3600_000).toISOString(), url: "u", next: "n", ...over });
  const checks = (conclusion: string): r.DataPr["checks"] => ({ run: { conclusion, createdAt: "x", status: "completed", url: "u" }, mark: "", text: "" });
  test("a Players pull request is amber however fresh and green its checks", () => {
    expect(r.dataPr(pr("players", { checks: checks("success") }), NOW).light).toBe("amber");
    expect(r.dataPr(pr("players"), NOW + 100 * 3600_000).light).toBe("amber");
  });
  test("Pins and Game data: amber waiting, red on failed checks or after 36 hours, grey when the checks can't be read", () => {
    expect(r.dataPr(pr("pins", { checks: checks("success") }), NOW).light).toBe("amber");
    expect(r.dataPr(pr("pins", { checks: checks("failure") }), NOW).light).toBe("red");
    expect(r.dataPr(pr("game-data"), NOW).light).toBe("amber");
    expect(r.dataPr(pr("game-data"), NOW + 40 * 3600_000).light).toBe("red");
    expect(r.dataPr(pr("pins", { checks: { mark: "?", text: "x", error: "gh" } }), NOW).light).toBe("grey");
  });
  test("builds: moved is amber, an API refusal grey, nothing read grey", () => {
    expect(r.builds(latest).light).toBe("green");
    const moved = { ...latest, builds: [{ ...latest.builds[1], latest: "1.60.1.70999", moved: true }] };
    expect(r.builds(moved).light).toBe("amber");
    expect(r.builds({ ...latest, builds: [{ ...latest.builds[0], error: "HTTP 429" }] }).light).toBe("grey");
    expect(r.builds(undefined).light).toBe("grey");
  });
  test("the real report: its red job makes the page red, and the page says which", () => {
    const d = r.data(dataPrs, latest, NOW);
    const failing = dataPrs.jobs.filter((j) => j.run?.conclusion === "failure").length;
    expect(d?.verdict.light).toBe(failing ? "red" : "green");
    if (failing) expect(d?.verdict.reasons.join(" ")).toContain("failure");
  });
  test("a repository gh could not read is grey", () => {
    const d = r.data({ ...dataPrs, jobs: [], prs: [], errors: [{ repo: "yonder", error: "gh: 502" }] }, latest, NOW);
    expect(d?.verdict.light).toBe("grey");
  });
  test("nothing read yet is no page at all", () => {
    expect(r.data(undefined, latest, NOW)).toBeUndefined();
  });
});

describe("stores", () => {
  const ok = stores.find((s) => s.read) as Extract<r.Store, { read: true }>;
  test("matching pages are green, a due --apply amber", () => {
    expect(r.store({ ...ok, due: [] }).light).toBe("green");
    const v = r.store({ ...ok, due: ["CurseForge's page"] });
    expect(v.light).toBe("amber");
    expect(v.reasons[0]).toContain("CurseForge's page");
  });
  test("a cookie missing or expired, or no CurseForge page, is grey and never green", () => {
    expect(r.store({ repo: "k", read: false, why: "unread", error: "no session" }).light).toBe("grey");
    expect(r.store({ repo: "k", read: false, why: "not-on-curseforge" }).light).toBe("grey");
    expect(r.store({ ...ok, wago: { notRead: "no cookie" } }).light).toBe("grey");
  });
  test("a semicolon in the page is amber", () => {
    expect(r.store({ ...ok, semicolon: true }).light).toBe("amber");
  });
});

describe("test zips", () => {
  const base = (name: string, build?: r.Repo["build"]): r.Repo => ({ name, branch: "main", ahead: 0, behind: 0, dirty: 0, head: "x", build });
  const zip = (name: string, mtime: number): r.Zip => ({ name, size: 1, mtime });
  test("current green, behind amber, none red, unknown grey", () => {
    const lines = r.zips(
      [base("yonder", { file: "Yonder-v1.zip", version: "v1", state: "current" }), base("keyring", { file: "k", version: "v1", state: "behind", behind: 2 }), base("mealbook"), base("palaver", { file: "p", version: "v1", state: "unknown" })],
      [],
    );
    expect(lines.map((l) => [l.name, l.verdict.light])).toEqual([["yonder", "green"], ["keyring", "amber"], ["mealbook", "red"], ["palaver", "grey"]]);
  });
  test("only the repositories that ship a zip are listed", () => {
    expect(r.zips([base("addon-kit"), base("wow-data"), base("yonder")], []).map((l) => l.name)).toEqual(["yonder"]);
  });
  test("a second zip of one addon is flagged, the older named, whatever the spelling", () => {
    const folder = [zip("SecondWind-v0.6.0.zip", 200), zip("SecondWind-v0.5.0.zip", 100), zip("Yonder-v1.zip", 1)];
    const [line] = r.zips([base("second-wind", { file: "SecondWind-v0.6.0.zip", version: "v0.6.0", state: "current" })], folder);
    expect(line.extra).toEqual(["SecondWind-v0.5.0.zip"]);
    expect(line.verdict.light).toBe("amber");
  });
  test("a folder that couldn't be listed says nothing of second zips", () => {
    const [line] = r.zips([base("yonder", { file: "f", version: "v", state: "current" })], undefined);
    expect(line.extra).toEqual([]);
  });
  test("every real repository reads", () => {
    expect(r.zips(status, []).length).toBeGreaterThan(5);
  });
});

describe("launch night's window", () => {
  test("nothing runs from 4 November 22:00 to 5 November 06:00 CET", () => {
    expect(r.quiet(Date.parse("2026-11-04T20:59:59Z"))).toBe(false);
    expect(r.quiet(Date.parse("2026-11-04T21:00:00Z"))).toBe(true);
    expect(r.quiet(Date.parse("2026-11-05T04:59:59Z"))).toBe(true);
    expect(r.quiet(Date.parse("2026-11-05T05:00:00Z"))).toBe(false);
    expect(r.quiet(Date.parse("2026-11-03T12:00:00Z"))).toBe(false);
  });
});
