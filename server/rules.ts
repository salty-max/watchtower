// The control centre's rules: what is green, amber, red or grey on each page.
// Pure functions over the tools' JSON (testdata/ holds real output), so
// rules.test.ts reads them without a server.

import { worst, type Light } from "./launch/rules";
export { worst, type Light };
export type Verdict = { light: Light; reasons: string[] };

// ── the tools' JSON, as far as the rules read it ────────────────────────────
export type Row = { mark: string; label: string; text: string };
export type Preflight = { name: string; tag?: string; version?: string; total: number; ships: unknown[]; rows: Row[]; verdict: string };
export type Run = { workflow: string; status: string; conclusion: string; sha?: string; at?: string };
export type Repo = {
  name: string;
  branch: string;
  ahead: number;
  behind: number;
  dirty: number;
  head: string;
  slug?: string;
  runs?: Run[];
  prs?: { number: number; title: string }[];
  build?: { file: string; version: string; state: "current" | "behind" | "unknown"; behind?: number };
  ghFailed?: boolean;
  unreadable?: boolean;
};
export type Card = { id: string; title: string; status: string; repos?: string[] };
export type JobRun = { conclusion: string; createdAt: string; status: string; url: string };
export type Job = { repo: string; workflow: string; label: string; run?: JobRun; mark: string; text: string; error?: string };
export type DataPr = { repo: string; number: number; title: string; branch: string; kind: "pins" | "players" | "game-data" | "other"; createdAt: string; url: string; next: string; checks?: { run?: JobRun; mark: string; text: string; error?: string } };
export type DataPrs = { at: string; repos: string[]; jobs: Job[]; prs: DataPr[]; errors: { repo: string; error: string }[] };
export type Latest = { at: string; builds: { game: string; product: string; pinned: string; latest: string; moved: boolean; error?: string }[]; databases: { name: string; moved: boolean; error?: string }[]; ui: { name: string; moved: boolean; error?: string }[]; moved: boolean };
export type Store =
  | { repo: string; read: true; title: string; id: number; curseforge: { page: string }; github: "none" | "same" | { now: string }; wago: { state: string } | { notRead: string }; due: string[]; semicolon: boolean }
  | { repo: string; read: false; why: "not-on-curseforge" | "unread"; error?: string };

const verdict = (light: Light, reasons: string[] = []): Verdict => ({ light, reasons });

/** The word for a light that stands for "nothing read": a failed source is grey on its own page. */
export const unread = (what: string, error?: string): Verdict => verdict("grey", [error ? `${what}: ${error}` : `${what} has not answered yet`]);

// ── Releases ────────────────────────────────────────────────────────────────
export type Release = {
  name: string;
  /** preflight's own verdict line. */
  said: string;
  tag?: string;
  version?: string;
  /** Commits that ship since the tag. */
  ships: number;
  verdict: Verdict;
  /** The rows that stand in the way or want a look, ✗ first. */
  rows: Row[];
};

/** An addon's light from preflight's rows: a ✗ is in the way (red), a "!" wants a look (amber). */
export function release(p: Preflight): Release {
  const stops = p.rows.filter((r) => r.mark === "✗");
  const looks = p.rows.filter((r) => r.mark === "!");
  const light: Light = stops.length ? "red" : looks.length ? "amber" : "green";
  return {
    name: p.name,
    said: p.verdict,
    tag: p.tag,
    version: p.version,
    ships: p.ships.length,
    verdict: verdict(light, [...stops, ...looks].map((r) => `${r.label}: ${r.text}`)),
    rows: [...stops, ...looks],
  };
}

export type RepoLine = {
  name: string;
  head: string;
  ahead: number;
  behind: number;
  dirty: number;
  /** The cards (not done) naming this repository: whose commits go out with a push. */
  cards: { id: string; title: string; status: string }[];
  ci?: string;
  lastRun?: Run;
  verdict: Verdict;
};

/** A repository's light from status: CI red is red, a run in flight, being behind origin or gh unread is amber/grey. Unpushed commits and a dirty tree are shown, not judged: the push wave's order is the skill's. */
export function repoLine(r: Repo, cards: Card[]): RepoLine {
  const reasons: string[] = [];
  let light: Light = "green";
  const runs = r.runs ?? [];
  const ci = runs.find((x) => x.workflow === "CI");
  for (const run of runs) {
    if (run.status !== "completed") {
      light = worst(light, "amber");
      reasons.push(`${run.workflow} is running`);
    } else if (!["success", "skipped", "cancelled"].includes(run.conclusion)) {
      light = worst(light, run.workflow === "CI" ? "red" : "amber");
      reasons.push(`${run.workflow} ${run.conclusion}`);
    }
  }
  if (r.behind > 0) {
    light = worst(light, "amber");
    reasons.push(`${r.behind} behind origin`);
  }
  for (const pr of r.prs ?? []) {
    light = worst(light, "amber");
    reasons.push(`#${pr.number} ${pr.title} is open`);
  }
  if (r.unreadable) {
    light = worst(light, "grey");
    reasons.push("git could not read it");
  } else if (r.ghFailed) {
    light = worst(light, "grey");
    reasons.push("gh gave nothing: CI and pull requests unknown");
  }
  return {
    name: r.name,
    head: r.head,
    ahead: r.ahead,
    behind: r.behind,
    dirty: r.dirty,
    cards: cards.filter((c) => c.status !== "done" && (c.repos ?? []).includes(r.name)).map((c) => ({ id: c.id, title: c.title, status: c.status })),
    ci: ci?.conclusion,
    lastRun: runs.slice().sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0],
    verdict: verdict(light, reasons),
  };
}

// ── Data ────────────────────────────────────────────────────────────────────
const HOUR = 3600_000;

/** A daily job: red when its last run failed, amber while it runs, grey when it could not be read or never ran. */
export function job(j: Job): Verdict {
  if (j.error) return verdict("grey", [`${j.repo} ${j.label}: ${j.error}`]);
  if (!j.run) return verdict("grey", [`${j.repo} ${j.label}: no run yet`]);
  if (j.run.status !== "completed") return verdict("amber", [`${j.repo} ${j.label}: running`]);
  if (["success", "skipped", "cancelled"].includes(j.run.conclusion)) return verdict("green");
  return verdict("red", [`${j.repo} ${j.label}: ${j.run.conclusion} (${j.text})`]);
}

/**
 * A data pull request. Players' is always amber until read (strangers' data,
 * never merged by itself). Pins' and Game data's wait on their checks (amber)
 * and go red when the checks failed or the pull request has stood for more
 * than 36 hours, a day's job having missed. Anything else is amber.
 */
export function dataPr(p: DataPr, now: number): Verdict {
  const age = now - Date.parse(p.createdAt);
  const what = `${p.repo} #${p.number} ${p.title}`;
  if (p.kind === "players") return verdict("amber", [`${what}: strangers' facts, to be read before any merge`]);
  if (p.checks?.error) return verdict("grey", [`${what}: its checks could not be read (${p.checks.error})`]);
  const failed = p.checks?.run && p.checks.run.status === "completed" && !["success", "skipped", "cancelled"].includes(p.checks.run.conclusion);
  if (failed) return verdict("red", [`${what}: its checks ${p.checks?.run?.conclusion}`]);
  if (age > 36 * HOUR) return verdict("red", [`${what}: open for ${Math.floor(age / HOUR)} hours, ${p.next}`]);
  return verdict("amber", [`${what}: ${p.next}`]);
}

/** A game's build moved past the pins is amber (the pins job carries it), unread is grey. */
export function builds(l: Latest | undefined): Verdict {
  if (!l) return unread("wago.tools");
  const reasons: string[] = [];
  let light: Light = "green";
  for (const b of l.builds) {
    if (b.error) {
      light = worst(light, "grey");
      reasons.push(`${b.game}: ${b.error}`);
    } else if (b.moved || b.latest !== b.pinned) {
      light = worst(light, "amber");
      reasons.push(`${b.game}: ${b.pinned} is pinned, wago.tools has ${b.latest}`);
    }
  }
  return verdict(light, reasons);
}

export type DataView = { verdict: Verdict; jobs: (Job & { verdict: Verdict })[]; prs: (DataPr & { verdict: Verdict })[]; builds: Verdict; errors: DataPrs["errors"] };

export function data(d: DataPrs | undefined, l: Latest | undefined, now: number): DataView | undefined {
  if (!d) return undefined;
  const jobs = d.jobs.map((j) => ({ ...j, verdict: job(j) }));
  const prs = d.prs.map((p) => ({ ...p, verdict: dataPr(p, now) }));
  const b = builds(l);
  const errors = d.errors.map((e) => verdict("grey", [`${e.repo}: ${e.error}`]));
  return {
    verdict: verdict(
      worst(b.light, ...jobs.map((j) => j.verdict.light), ...prs.map((p) => p.verdict.light), ...errors.map((e) => e.light)),
      [...jobs.flatMap((j) => (j.verdict.light === "green" ? [] : j.verdict.reasons)), ...prs.flatMap((p) => p.verdict.reasons), ...b.reasons, ...errors.flatMap((e) => e.reasons)],
    ),
    jobs,
    prs,
    builds: b,
    errors: d.errors,
  };
}

// ── Stores ──────────────────────────────────────────────────────────────────
/** An addon's store pages against its file: amber when `--apply` is due, grey when the dry run cannot see (no cookie, expired, not listed). */
export function store(s: Store): Verdict {
  if (!s.read) {
    return verdict("grey", [s.why === "not-on-curseforge" ? "not on CurseForge (no store page to compare)" : `could not be read: ${s.error ?? "unknown"}`]);
  }
  const reasons = s.due.map((d) => `${d} would change`);
  let light: Light = s.due.length ? "amber" : "green";
  if (s.semicolon) {
    light = worst(light, "amber");
    reasons.push("a semicolon in the page: none in what players read");
  }
  if ("notRead" in s.wago) {
    light = worst(light, "grey");
    reasons.push(`Wago not read: ${s.wago.notRead}`);
  }
  return verdict(light, reasons);
}

// ── Test zips ───────────────────────────────────────────────────────────────
export type Zip = { name: string; size: number; mtime: number };
export type ZipLine = { name: string; file?: string; version?: string; extra: string[]; verdict: Verdict };

/** The addon a zip file name belongs to: the part before `-v<number>`. */
export const zipAddon = (file: string): string => file.replace(/-v\d.*\.zip$/i, "").replace(/\.zip$/i, "");

/** The repositories that ship a test zip to iCloud (the addons, Ravenpost's own build is a folder of its own). */
export const ZIPPED = ["hearthtale", "lorekeepers-codex", "yonder", "second-wind", "keyring", "palaver", "mealbook", "goodwill", "yours-truly", "wow-locker"];

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The zip page. status.ts's `build` says whether the newest zip is current
 * (red: none, amber: older than HEAD's shipping files, grey: unknown). The
 * folder itself is listed here, because the tools take the newest only: a
 * second zip of one addon is flagged (the older to the Trash).
 */
export function zips(repos: Repo[], folder: Zip[] | undefined): ZipLine[] {
  return repos.filter((r) => ZIPPED.includes(r.name)).map((r) => {
    const b = r.build;
    const mine = (folder ?? []).filter((z) => /\.zip$/i.test(z.name) && squash(zipAddon(z.name)) === squash(r.name));
    const extra = mine.length > 1 ? mine.slice().sort((a, b2) => b2.mtime - a.mtime).slice(1).map((z) => z.name) : [];
    const reasons: string[] = [];
    let light: Light = "green";
    if (!b) {
      light = "red";
      reasons.push("no test zip in iCloud: bun run package, the zip alone");
    } else if (b.state === "behind") {
      light = "amber";
      reasons.push(`older than HEAD${b.behind ? ` (${b.behind} commit${b.behind > 1 ? "s" : ""} of shipping files since)` : ""}`);
    } else if (b.state === "unknown") {
      light = "grey";
      reasons.push("cannot tell if it is current");
    }
    if (extra.length) {
      light = worst(light, "amber");
      reasons.push(`a second zip: ${extra.join(", ")} (the older one to the Trash)`);
    }
    return { name: r.name, file: b?.file, version: b?.version, extra, verdict: verdict(light, reasons) };
  });
}

// ── the summary: one light per page, the tray's colour ──────────────────────
export type PageId = "launch" | "releases" | "data" | "stores" | "zips";
export const PAGES: { id: PageId; label: string }[] = [
  { id: "launch", label: "Launch night" },
  { id: "releases", label: "Releases" },
  { id: "data", label: "Data" },
  { id: "stores", label: "Stores" },
  { id: "zips", label: "Test zips" },
];

/** The tray icon's colour and the page the window opens on: the worst page, the first of them on a tie. */
export function summary(lights: Partial<Record<PageId, Light>>): { overall: Light; open: PageId } {
  const overall = worst(...Object.values(lights));
  const open = PAGES.find((p) => lights[p.id] === overall)?.id ?? "releases";
  return { overall, open };
}

// ── the guard: launch night's window ────────────────────────────────────────
/** No source runs from 4 November 2026 22:00 to 5 November 06:00 CET (21:00 to 05:00 UTC): launch night has the rate limits, the cookies and the checkouts to itself. */
export const QUIET_FROM = Date.parse("2026-11-04T21:00:00Z");
export const QUIET_TO = Date.parse("2026-11-05T05:00:00Z");
/** Launch night ends for the tray and the readings 6 November 2026 06:00 UTC (the morning after, as the faster pace does): the Launch page stays, its lights no longer drive the icon. */
export const LAUNCH_END = Date.parse("2026-11-06T06:00:00Z");
export const quiet = (now: number): boolean => now >= QUIET_FROM && now < QUIET_TO;
