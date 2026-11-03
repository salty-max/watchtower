// Launch night, the page of Watchtower that replaced launch.ts: the checklist
// (night.json, data to amend without touching code), the readings only launch night needs (the site and the inbox, the Forever
// database's coverage, the user's screenshots) and the view the Launch page
// draws. The family's own readings (preflight, status, the board, the builds)
// are the cells the other pages already have: one gather, not two. The rules
// are launch/rules.ts, the ticks and notes live in a file of Watchtower's own.
import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { staleCache, type Cell, type Def } from "../engine";
import { LAUNCH_END } from "../rules";
import { family } from "../sources";
import * as rules from "./rules";

/** What each source reads, for the sentences about it. */
const THING: Record<string, string> = { preflight: "preflight's checks", status: "the repositories' state", board: "the board", "data-prs": "the daily jobs and pull requests", latest: "the game's builds", stores: "the store pages", zips: "the test zip folder", "launch-data": "Forever's data", "launch-infra": "the site and inbox check", "launch-shots": "the screenshots" };
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

export type Content = {
  launch: string;
  chainCheckAt: string;
  timeline: { id: string; at: string; title: string; detail: string }[];
  addons: { id: string; name: string; slash: string; rank: number; risk: string; checks: { id: string; look: string; ok: string; todo: string; fix: string }[] }[];
};

export const ICLOUD_DRIVE = join(homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs");

/** The repositories launch night watches: the addons and what they lean on (fix sessions are allowed on these in its window). */
export const launchRepoSet = (content: Content): Set<string> => new Set([...content.addons.map((a) => a.id), "ravenpost", "wow-data", "addon-kit"]);

export const loadContent = (): Content => JSON.parse(readFileSync(join(import.meta.dir, "night.json"), "utf8"));

/**
 * Where ticks and notes live: ~/.cache/watchtower/launch-night.json
 * (WATCHTOWER_STATE moves it). The night saved by launch.ts, in
 * addon-kit/.cache/launch-night.json, is copied there the first time (never
 * over a file that is already there), so no tick is lost.
 */
export function stateFile(demo: boolean, tmp: string, home = homedir(), env: Record<string, string | undefined> = process.env, legacy?: string): string {
  if (env.WATCHTOWER_STATE) return env.WATCHTOWER_STATE;
  if (demo) return join(tmp, "launch-night-demo.json");
  const file = join(home, ".cache", "watchtower", "launch-night.json");
  const old = legacy ?? (family() ? join(family() as string, "addon-kit", ".cache", "launch-night.json") : undefined);
  if (old && !existsSync(file) && existsSync(old)) {
    mkdirSync(dirname(file), { recursive: true });
    copyFileSync(old, file);
  }
  return file;
}

// ── the readings only launch night needs ────────────────────────────────────
const PROBES = [
  { name: "hearthtale.app", url: "https://hearthtale.app/" },
  { name: "ravenpost-inbox", url: "https://ravenpost-inbox.vercel.app/" },
];

async function probe(p: { name: string; url: string }): Promise<rules.Probe> {
  const t = Date.now();
  try {
    const res = await fetch(p.url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
    return { ...p, status: res.status, ms: Date.now() - t };
  } catch (e) {
    return { ...p, status: 0, ms: Date.now() - t, error: e instanceof Error ? e.message : String(e) };
  }
}

const ZONES = ["Zephras Isle", "Shen'dralas", "Riverglades", "Mount Hyjal", "Gilneas"];

function coverage() {
  const root = family();
  const file = root ? join(root, "wow-data", ".cache", "db", "forever.db") : "";
  if (!file || !existsSync(file) || statSync(file).size < 1e6) throw new Error("forever.db not built (bun wow-data/bin/get.ts)");
  const db = new Database(file, { readonly: true });
  try {
    const one = (sql: string, ...a: string[]) => (db.query(sql).get(...a) as { n: number }).n;
    const zones = ZONES.map((z) => ({ zone: z, quests: one("select count(*) n from quest where zone_id in (select id from name where kind='area' and locale='enUS' and name=?)", z) }));
    const kinds = Object.fromEntries((db.query("select kind, count(*) n from name where locale='enUS' and kind in ('creature','quest','object','item','faction') group by kind").all() as { kind: string; n: number }[]).map((r) => [r.kind, r.n]));
    const meta = Object.fromEntries((db.query("select key, value from meta").all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    return { zones, kinds, builtAt: meta.built_at, pins: meta.pins ? JSON.parse(meta.pins).builds?.forever?.build : undefined };
  } finally {
    db.close();
  }
}

/** The images in iCloud Drive's root since an hour before launch: the user's screenshots. */
export function screenshots(since: number, dir = ICLOUD_DRIVE) {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    throw new Error(`${code ?? "unreadable"}: iCloud Drive's root can't be read from here${code === "EPERM" ? " (the app has no access yet: allow it when macOS asks, or give Watchtower Files and Folders access in System Settings)" : ""}`);
  }
  return names
    .filter((n) => /\.(png|jpe?g|webp)$/i.test(n))
    .map((n) => ({ name: n, mtime: statSync(join(dir, n)).mtimeMs }))
    .filter((f) => f.mtime >= since)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 40);
}

const MIN = 60_000;
/** The night's pace, then an hour once it is over (nothing reads iCloud Drive every 20 seconds for good). */
const after = (ms: number) => () => (Date.now() < LAUNCH_END ? ms : 60 * MIN);
/** The sources launch night adds to the family's: their ids are prefixed, so no page's cell is overwritten. */
export const launchDefs = (content: Content): Record<string, Def> => ({
  "launch-infra": { every: after(5 * MIN), always: true, key: "probes", shape: "array", get: () => Promise.all(PROBES.map(probe)) },
  "launch-data": { every: after(15 * MIN), always: true, key: "coverage", shape: "object", get: async () => coverage() },
  "launch-shots": { every: after(20_000), always: true, get: async () => screenshots(Date.parse(content.launch) - 3600_000) },
});

// ── the view the Launch page draws ──────────────────────────────────────────
type PreflightReport = { name: string; rows: rules.Row[]; version?: string; tag?: string };
type StatusRepo = { name: string; ahead: number; behind: number; dirty: number; head: string; runs?: rules.Run[]; prs?: { number: number; title: string }[] };
type Latest = { builds?: { game: string; pinned: string; latest: string; error?: string }[] };

/** The Forever build as launch night's rules want it, from wow-data's `latest.ts --json` (the Markdown it used to parse is made from the same rows). */
export function foreverBuild(l: Latest | undefined): rules.Build | undefined {
  const b = l?.builds?.find((x) => x.game === "forever");
  return b && !b.error && b.pinned && b.latest ? { pin: b.pinned, latest: b.latest } : undefined;
}

export function launchView(content: Content, cells: Record<string, Cell>, state: rules.State, busy: string[], now = Date.now()) {
  const preflight = (cells.preflight?.data as PreflightReport[] | undefined) ?? [];
  const status = (cells.status?.data as StatusRepo[] | undefined) ?? [];
  const build = foreverBuild(cells.latest?.data as Latest | undefined);

  const tocFor = (rows: rules.Row[]) => Number(rows.find((r) => r.label === "interface")?.text.match(/forever (\d+)/)?.[1]) || 16001;
  const toc = tocFor(preflight.flatMap((p) => p.rows));
  const buildV = rules.buildLight(build, toc);

  const addons = [...content.addons]
    .sort((a, b) => a.rank - b.rank)
    .map((a) => {
      const report = preflight.find((p) => p.name === a.id);
      const ready = report ? rules.readiness(report.rows) : { light: "grey" as const, reasons: [cells.preflight?.error ?? "Watchtower has not heard from preflight yet."] };
      const game = rules.inGame(a.id, a.checks.map((c) => c.id), state.ticks);
      const repo = status.find((s) => s.name === a.id);
      const zip = report?.rows.find((r) => r.label === "test zip");
      return {
        ...a,
        version: report?.version,
        tag: report?.tag,
        head: repo?.head,
        ci: repo?.runs?.find((r) => r.workflow === "CI")?.conclusion,
        zip: zip ? { mark: zip.mark, text: zip.text } : undefined,
        readiness: ready,
        inGame: game,
        // (in game, "not tested" is grey and never lowers a card: readiness is what the tools can say before launch)
        light: rules.worst(ready.light, game.light === "grey" ? "green" : game.light),
        checks: a.checks.map((c) => ({ ...c, tick: state.ticks[`${a.id}/${c.id}`] ?? "untested" })),
      };
    });

  const chain = cells.status?.data
    ? rules.chain(status.filter((s) => s.name === "wow-data" || content.addons.some((a) => a.id === s.name)).map((s) => ({ name: s.name, runs: s.runs, prs: s.prs })), now, Date.parse(content.chainCheckAt))
    : { light: "grey" as const, reasons: [cells.status?.error ?? "Watchtower has not heard from status yet."] };
  const infra = cells["launch-infra"]?.data ? rules.infra(cells["launch-infra"].data as rules.Probe[]) : { light: "grey" as const, reasons: ["The site and inbox have not been checked yet."] };
  const launchRepos = launchRepoSet(content);
  const cards = ((cells.board?.data as rules.Card[] | undefined) ?? []).filter((c) => c.status !== "done");
  const boardV = rules.board(cards, launchRepos);

  // (a source that failed keeps its last answer: a green on old data is not a green, so a failure after an answer is amber. One that never answered is already grey where it feeds a light. The screenshots are left out: a missing iCloud permission must not stop a launch)
  const mine = ["preflight", "status", "board", "latest", "launch-infra", "launch-data"];
  const failing = mine.filter((k) => cells[k]?.error && cells[k].data !== undefined);
  // (a cached reading older than its interval is no more green than a failed one)
  const cached = mine.filter((k) => !failing.includes(k) && staleCache(cells[k], now));
  const sourcesV: rules.Verdict = { light: failing.length || cached.length ? "amber" : "green", reasons: [...failing.map((k) => `Watchtower could not read ${THING[k] ?? k}: ${cells[k].error}`), ...cached.map((k) => `${cap(THING[k] ?? k)} is an old reading while Watchtower reads it again.`)] };

  const overall = rules.worst(buildV.light, chain.light, infra.light, boardV.light, sourcesV.light, ...addons.map((a) => a.light));

  let next = true;
  const timeline = content.timeline
    .map((t) => ({ ...t, ms: Date.parse(t.at) }))
    .sort((a, b) => a.ms - b.ms)
    .map((t) => {
      const done = !!state.steps[t.id];
      const isNext = !done && next && t.ms >= now - 3600_000 ? ((next = false), true) : false;
      return { id: t.id, at: t.at, title: t.title, detail: t.detail, done, past: t.ms < now, next: isNext };
    });

  const shots = cells["launch-shots"];
  return {
    launch: content.launch,
    overall,
    build: { ...buildV, pin: build?.pin, latest: build?.latest, toc },
    addons,
    timeline,
    data: { ...(cells["launch-data"]?.data as object | undefined), error: cells["launch-data"]?.error },
    chain,
    infra: { ...infra, probes: cells["launch-infra"]?.data as rules.Probe[] | undefined },
    sources: sourcesV,
    board: { ...boardV, cards: cards.map((c) => ({ id: c.id, title: c.title, status: c.status, repos: c.repos })) },
    notes: state.notes,
    shots: { list: (shots?.data as { name: string; mtime: number }[] | undefined) ?? [], error: shots?.error },
    busy,
  };
}

export const notesMarkdown = (state: rules.State, content: Content) => rules.notesMarkdown(state, content);

// ── made-up state for --demo: the family's cells plus launch night's own ────
export function demoLaunchCells(content: Content, now = Date.now()): Record<string, Cell> {
  const cell = (data: unknown): Cell => ({ at: now - 90_000, ms: 1200, data });
  return {
    "launch-infra": cell([
      { name: "hearthtale.app", url: "", status: 200, ms: 240 },
      { name: "ravenpost-inbox", url: "", status: 200, ms: 410 },
    ]),
    "launch-data": cell({
      zones: [
        { zone: "Zephras Isle", quests: 110 },
        { zone: "Shen'dralas", quests: 19 },
        { zone: "Riverglades", quests: 1 },
        { zone: "Mount Hyjal", quests: 0 },
        { zone: "Gilneas", quests: 0 },
      ],
      kinds: { creature: 13675, quest: 5241, object: 12057, item: 25206, faction: 253 },
      builtAt: "2026-10-30T22:56:45.016Z",
      pins: "1.60.1.70707",
    }),
    "launch-shots": cell([]),
  };
}
