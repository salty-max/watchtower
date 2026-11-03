// Made-up state, to try the pages (--demo): the real shapes (testdata/, saved
// from the tools) with a few things gone wrong, so every light shows. Nothing
// is run and nothing is written.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Cell } from "./engine";
import type { DataPrs, Latest, Preflight, Repo, Store, Zip } from "./rules";

const read = <T>(name: string): T => JSON.parse(readFileSync(join(import.meta.dir, "testdata", name), "utf8"));

/** The sources' answers, by id. */
export function demoData(now = Date.now()): Record<string, unknown> {
  const iso = (ago: number) => new Date(now - ago).toISOString();
  const preflight = read<Preflight[]>("preflight.json");
  const status = read<Repo[]>("status.json");
  const dataPrs = read<DataPrs>("data-prs.json");
  const latest = read<Latest>("latest.json");
  const stores = read<Store[]>("stores.json");
  const board = read<unknown[]>("board.json");

  // a ✗ in the way on one addon, and a "!" on another
  const keyring = preflight.find((p) => p.name === "keyring");
  if (keyring) {
    keyring.rows = keyring.rows.map((r) => (r.label === "CI" ? { ...r, mark: "✗", text: "failure on HEAD" } : r));
    keyring.verdict = "1 in the way";
  }
  const goodwill = preflight.find((p) => p.name === "goodwill");
  if (goodwill) goodwill.rows.push({ mark: "!", label: "review", text: "none recorded on HEAD: packet.ts, then the reviewer" });

  // unpushed commits, a failing CI, a stale zip
  const repo = (name: string) => status.find((s) => s.name === name);
  const yonder = repo("yonder");
  if (yonder) yonder.ahead = 3;
  const k = repo("keyring");
  if (k?.runs) k.runs = k.runs.map((r) => (r.workflow === "CI" ? { ...r, conclusion: "failure" } : r));
  const m = repo("mealbook");
  if (m) m.build = { file: "Mealbook-v0.2.0.zip", version: "v0.2.0", state: "behind", behind: 4 };
  const g = repo("goodwill");
  if (g) delete g.build;

  // a Players pull request, a Pins one whose checks failed, a game data one left open
  dataPrs.prs.push(
    { repo: "wow-data", number: 41, title: "data: players' facts of 3 November", branch: "players/2026-11-03", kind: "players", createdAt: iso(5 * 3600_000), url: "https://github.com/salty-max/wow-data/pull/41", next: "strangers' facts: data-prs.ts facts, then the user's go", checks: { run: { conclusion: "success", createdAt: iso(5 * 3600_000), status: "completed", url: "" }, mark: "✓", text: "success" } },
    { repo: "wow-data", number: 42, title: "pins: forever 1.60.1.70801", branch: "pins/2026-11-03", kind: "pins", createdAt: iso(3 * 3600_000), url: "https://github.com/salty-max/wow-data/pull/42", next: "the builds moved and didn't merge: the skill's Pins part", checks: { run: { conclusion: "failure", createdAt: iso(3 * 3600_000), status: "completed", url: "" }, mark: "✗", text: "failure" } },
    { repo: "yonder", number: 77, title: "data: regenerate from the pins", branch: "game-data/2026-11-02", kind: "game-data", createdAt: iso(40 * 3600_000), url: "https://github.com/salty-max/yonder/pull/77", next: "a game-data pull request left open: read why" },
  );
  const fb = latest.builds.find((b) => b.game === "forever");
  if (fb) {
    fb.latest = "1.60.1.70801";
    fb.moved = true;
  }

  // a store page due, another one unread
  const s = stores.find((x) => x.repo === "palaver");
  if (s?.read) s.due = ["CurseForge's page", "Wago's page and summary"];
  const u = stores.find((x) => x.repo === "mealbook");
  if (u) Object.assign(u, { read: false, why: "unread", error: "CurseForge said 401: the cookie has expired" });

  // two zips of one addon
  const zips: Zip[] = [
    { name: "Yonder-v0.15.0.zip", size: 3.1e6, mtime: now - 86400_000 },
    { name: "Yonder-v0.14.0.zip", size: 3.0e6, mtime: now - 9 * 86400_000 },
    { name: "Hearthtale-v0.14.0.zip", size: 5.2e6, mtime: now - 3600_000 },
  ];
  return { preflight, status, board, "data-prs": dataPrs, latest, stores, zips };
}

export const demoCells = (now = Date.now()): Record<string, Cell> => Object.fromEntries(Object.entries(demoData(now)).map(([id, data]) => [id, { at: now - 90_000, ms: 1200, data }]));
