import { Outdated, SignedOut, Unreachable, type OwnerData, type Result } from "./data";
import { API_VERSION, type Activity, type Comments, type Numbers, type Players, type Range, type Releases, type Summary } from "./schema";

/**
 * Made-up numbers in the shape of the real launch lift, answered as the real
 * layer answers them (the same schemas, the same errors). The pages' tests run
 * on it, the phone check looks at it, and `?demo` in the phone app's address
 * shows it. Three scenarios: `usual` has things to look at (a comment, a late
 * release, CurseForge's session turned down), `quiet` has none, `trouble` has a
 * failed job. No name here is a real person's: the addons are the family's, the commenters are made up.
 */
export type Scenario = "usual" | "quiet" | "trouble";
export const NOW = Date.parse("2026-11-06T09:30:00Z");

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const dayOf = (t: number) => iso(t).slice(0, 10);
const LAST = "2026-11-05";
const N_DAYS = 60;
const days = Array.from({ length: N_DAYS }, (_, i) => dayOf(Date.parse(LAST) - (N_DAYS - 1 - i) * DAY));

// [name, repo, on CurseForge, a day's base, rank on CurseForge]
const ADDONS: [string, string, boolean, number, number | null][] = [
  ["Lorekeeper's Codex", "lorekeepers-codex", true, 21, 41],
  ["Yonder", "yonder", true, 20, 44],
  ["Hearthtale", "hearthtale", true, 14, 63],
  ["Second Wind", "second-wind", true, 13, 70],
  ["Palaver", "palaver", true, 11, 82],
  ["Mealbook", "mealbook", true, 11, 80],
  ["Keyring", "keyring", true, 10, 95],
  ["WoWLocker", "wow-locker", false, 9, null],
  ["Goodwill", "goodwill", true, 9, 101],
  ["Yours Truly", "yours-truly", true, 7, 140],
  ["Ravenpost", "ravenpost", false, 8, null],
];

/** A day's downloads for an addon: a slow rise, a weekly wave, then the launch (the last two days). */
const dayValue = (base: number, i: number, k: number) => {
  const wave = 1 + 0.25 * Math.sin((i + k) / 2.2);
  const launch = i === N_DAYS - 1 ? 4.6 : i === N_DAYS - 2 ? 2.1 : 1;
  return Math.round(base * wave * (0.8 + (i / N_DAYS) * 0.6) * launch);
};

const cut = <T,>(xs: T[], from: number) => xs.slice(from);

export function numbersFor(range: Range): Numbers {
  const from = range === "all" ? 0 : Math.max(0, N_DAYS - Number(range));
  const full = Object.fromEntries(ADDONS.map(([a, , , base], k) => [a, days.map((_, i) => (i < 3 ? null : dayValue(base, i, k)))]));
  const sums = (name: string) => (full[name] as (number | null)[]).reduce<number>((t, v) => t + (v ?? 0), 0);
  const tail = (name: string, n: number) => cut(full[name] as (number | null)[], N_DAYS - n).reduce<number>((t, v) => t + (v ?? 0), 0);
  const cf = ADDONS.filter((a) => a[2]);
  const hours = Array.from({ length: 48 }, (_, i) => iso(Math.floor(NOW / 3_600_000) * 3_600_000 - (47 - i) * 3_600_000));
  const hourly = Object.fromEntries(cf.map(([a, , , base], k) => [a, hours.map((_, i) => Math.round((base / 9) * (1 + 0.4 * Math.sin((i + k) / 3)) * (i > 30 ? 3.2 : 1)))]));
  const share = (v: number | null, f: number) => (v === null ? null : Math.round(v * f));
  const total = (i: number) => ADDONS.reduce<number | null>((t, [a]) => ((full[a] as (number | null)[])[i] === null ? t : (t ?? 0) + (full[a] as number[])[i]), null);
  return {
    apiVersion: API_VERSION,
    range,
    days: cut(days, from),
    downloads: {
      addons: ADDONS.map((a) => a[0]),
      listed: ADDONS.map((a) => a[0]),
      daily: Object.fromEntries(Object.entries(full).map(([a, xs]) => [a, cut(xs, from)])),
      since: cut(
        days.map(() => null),
        from,
      ),
      totals: Object.fromEntries(ADDONS.map(([a, , , base]) => [a, sums(a) + base * 12])),
      channels: Object.fromEntries(ADDONS.map(([a, , onCf, base]) => [a, onCf ? { curseforge: Math.round((sums(a) + base * 12) * 0.7), wago: Math.round((sums(a) + base * 12) * 0.2), github: Math.round((sums(a) + base * 12) * 0.1) } : { github: sums(a) + base * 12 }])),
      week: Object.fromEntries(ADDONS.map(([a]) => [a, tail(a, 7)])),
      early: cut(
        days.map((_, i) => i < 5),
        from,
      ),
      stores: {
        curseforge: cut(
          days.map((_, i) => share(total(i), 0.71)),
          from,
        ),
        wago: cut(
          days.map((_, i) => share(total(i), 0.19)),
          from,
        ),
        github: cut(
          days.map((_, i) => share(total(i), 0.1)),
          from,
        ),
      },
    },
    unique: Object.fromEntries(cf.map(([a]) => [a, cut((full[a] as (number | null)[]).map((v) => (v === null ? null : Math.round(v * 0.64))), from)])),
    rank: Object.fromEntries(cf.map(([a, , , , r]) => [a, cut(days.map((_, i) => (r === null ? null : r + Math.round((N_DAYS - i) / 6))), from)])),
    periods: Object.fromEntries(cf.map(([a]) => [a, { "7": { downloads: tail(a, 7), unique: Math.round(tail(a, 7) * 0.7) }, "30": { downloads: tail(a, 30), unique: Math.round(tail(a, 30) * 0.66) }, "90": { downloads: sums(a), unique: Math.round(sums(a) * 0.62) } }])),
    hourly: { hours, series: hourly, today: 809, readings: 288 },
    marks: [
      { day: "2026-10-14", addon: "Yonder", text: "Yonder 0.14.0" },
      { day: "2026-10-22", addon: "Lorekeeper's Codex", text: "Lorekeeper's Codex 0.15.0" },
      { day: "2026-11-02", addon: "Palaver", text: "Palaver 0.3.0" },
      { day: "2026-11-05", addon: "Yonder", text: "Yonder 0.15.0" },
    ],
    checkedAt: iso(NOW - 3 * 60_000),
    uniqueAt: iso(NOW - 70 * 3_600_000),
  };
}

const standingOf = (s: Scenario): Summary["standing"] =>
  s === "trouble"
    ? { tone: "blood", icon: "x", title: "A job failed", line: "Yonder: the daily data job stopped at the pull request" }
    : s === "usual"
      ? { tone: "gold", icon: "clock", title: "Something waits for you", line: "Players' facts: 41 lines, over the size ceiling for merging by itself" }
      : { tone: "ok", icon: "check", title: "All quiet", line: "Last word 3 h ago: Yonder's daily data merged by itself" };

export function summaryFor(s: Scenario): Summary {
  const n = numbersFor("all");
  const total = Object.values(n.downloads.totals).reduce((a, b) => a + b, 0);
  const warnings: Summary["warnings"] = s === "usual" ? [{ key: "drift-mealbook-v0.2.0", level: "note", title: "Mealbook 0.2.0 isn't on CurseForge yet", line: "On GitHub for 8 h: in CurseForge's review, held for the stores, or the upload failed." }] : [];
  const stamp = (x: string) => `"${x}-1"`;
  return {
    apiVersion: API_VERSION,
    through: LAST,
    standing: standingOf(s),
    problems: { failed: s === "trouble" ? 1 : 0, waiting: s === "usual" ? 1 : 0 },
    figures: {
      downloads: { total, today: 809, week: Object.values(n.downloads.week).reduce<number>((a, b) => a + (b ?? 0), 0) },
      installs: { last: 74, today: 31 },
      facts: { last: 900, today: 212 },
      visitors: { last: 60, today: 19, sites: ["hearthtale.app", "wow-locker.app"] },
    },
    commentsWaiting: s === "quiet" ? 0 : 2,
    unique: s === "usual" ? { at: iso(NOW - 70 * 3_600_000), through: "2026-11-02", stale: true } : { at: iso(NOW - 40 * 60_000), through: LAST, stale: false },
    warnings,
    stamps: { numbers: stamp("n"), players: stamp("p"), comments: stamp("c"), activity: stamp("a"), releases: stamp("r") },
  };
}

export function commentsFor(s: Scenario): Comments {
  const answered = s === "quiet";
  const reply = (author: string, text: string, at: string, owner: boolean) => ({ author, text, at, owner });
  return {
    apiVersion: API_VERSION,
    waiting: answered ? 0 : 2,
    threads: [
      { addon: "Yonder", repo: "yonder", url: "https://www.curseforge.com/wow/addons/yonder/comments/1001", author: "Thalindra", text: "Found the riddle in Stranglethorn, but the toast never came up after I used the emote. Is it meant to wait for the next login?", at: iso(NOW - 9 * 3_600_000), last: iso(NOW - 9 * 3_600_000), replies: [], answered },
      { addon: "Palaver", repo: "palaver", url: "https://www.curseforge.com/wow/addons/palaver/comments/1002", author: "Kragnok", text: "Love the new camera. Can the dialogue window sit on the left side of the screen instead?", at: iso(NOW - 31 * 3_600_000), last: iso(NOW - 31 * 3_600_000), replies: [], answered },
      { addon: "Mealbook", repo: "mealbook", url: "https://www.curseforge.com/wow/addons/mealbook/comments/1003", author: "Brewmistress", text: "The cooking road is lovely. One question about the Forever recipes, do they show up before I learn them?", at: iso(NOW - 50 * 3_600_000), last: iso(NOW - 40 * 3_600_000), replies: [reply("Max", "Not before you learn them, no. The page fills in as you do.", iso(NOW - 40 * 3_600_000), true)], answered: true },
      { addon: "Hearthtale", repo: "hearthtale", url: "https://www.curseforge.com/wow/addons/hearthtale/comments/1004", author: "Ysolde", text: "My diary did not fill in after the patch. Reloading helped, thank you for the fix.", at: iso(NOW - 120 * 3_600_000), last: iso(NOW - 100 * 3_600_000), replies: [reply("Max", "Glad it works again.", iso(NOW - 100 * 3_600_000), true)], answered: true },
    ],
  };
}

export function activityFor(s: Scenario): Activity {
  return {
    apiVersion: API_VERSION,
    standing: standingOf(s),
    events: [
      { at: iso(NOW - 3 * 3_600_000), kind: "merged", repo: "yonder", addon: "Yonder", title: "Yonder's daily data merged by itself", body: "Two zones changed." },
      { at: iso(NOW - 8 * 3_600_000), kind: "release", repo: "mealbook", addon: "Mealbook", title: "Mealbook 0.2.0 is on GitHub", body: "Made with --hold: the stores wait." },
    ],
  };
}

export function releasesFor(s: Scenario): Releases {
  return {
    apiVersion: API_VERSION,
    driftHours: 6,
    rankBase: "2026-10-29",
    addons: ADDONS.map(([name, repo, onCf, , rank]) => ({
      name,
      repo,
      hasCurseForge: onCf,
      github: { tag: "v0.2.0", at: iso(NOW - 8 * 3_600_000), url: `https://github.com/salty-max/${repo}/releases/tag/v0.2.0` },
      curseforge: onCf ? { version: name === "Mealbook" && s === "usual" ? "0.1.1" : "0.2.0", at: iso(NOW - 20 * 3_600_000), downloads: 400, type: 1 } : null,
      curseforgeRead: onCf,
      job: null,
      behind: name === "Mealbook" && s === "usual" ? { hours: 8 } : null,
      rank: rank === null ? null : { now: rank, was: rank + 3, isNew: false, favorites: 12 },
    })),
    checks: s === "usual" ? summaryFor(s).warnings : [],
  };
}

export function playersFor(): Players {
  const w = (f: (i: number) => number | null) => days.map((_, i) => f(i));
  return {
    apiVersion: API_VERSION,
    days,
    installs: w((i) => (i < 20 ? null : 30 + i)),
    installsWeek: w((i) => (i < 20 ? null : 60 + i * 2)),
    facts: w((i) => (i < 20 ? null : 200 + i * 10)),
    sharers: w((i) => (i < 20 ? null : 3 + Math.floor(i / 8))),
    newFacts: w((i) => (i < 20 ? null : 40)),
    sites: { "hearthtale.app": { visitors: w((i) => 20 + (i % 9)), pageviews: w((i) => 50 + (i % 13)) } },
    ravenpost: { installs: 74, versions: { "0.5.1": 60, "0.6.0": 14 }, os: { macos: 51, windows: 23 }, linked: { yes: 40, no: 34 } },
    distinct: { counts: { week: 120, month: 210, ever: 330, newWeek: 18, newMonth: 52, since: "2026-10-01" }, to: LAST },
    sharing: { games: { classic: 600, forever: 300 }, locales: { enUS: 700, frFR: 200 } },
    today: { at: iso(NOW - 4 * 60_000), day: "2026-11-06", installs: 31, sharers: 4, uploads: 9, facts: 212, visitors: 19 },
  };
}

/** What a test or a screenshot changes while the demo runs. */
export type DemoControl = { down: boolean; signedOut: boolean; outdated: boolean };

/** The demo layer: answers like the real one, an older answer marked stale when `down`, the real errors when signed out or outdated. */
export function demo(scenario: Scenario = "usual", control: DemoControl = { down: false, signedOut: false, outdated: false }, now: () => number = () => NOW): OwnerData & { control: DemoControl } {
  const last = new Map<string, unknown>();
  const answer = async <T,>(key: string, make: () => T): Promise<Result<T>> => {
    if (control.signedOut) throw new SignedOut();
    if (control.outdated) throw new Outdated(API_VERSION + 1);
    if (control.down) {
      const was = last.get(key) as Result<T> | undefined;
      if (!was) throw new Unreachable();
      return { ...was, stale: true };
    }
    const result: Result<T> = { data: make(), at: now(), stale: false };
    last.set(key, result);
    return result;
  };
  return {
    control,
    summary: () => answer("summary", () => summaryFor(scenario)),
    numbers: (range) => answer(`numbers-${range}`, () => numbersFor(range)),
    players: () => answer("players", playersFor),
    comments: () => answer("comments", () => commentsFor(scenario)),
    activity: () => answer("activity", () => activityFor(scenario)),
    releases: () => answer("releases", () => releasesFor(scenario)),
  };
}
