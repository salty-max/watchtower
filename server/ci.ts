// A cheap look at each repository's newest CI runs, so a run that starts or
// ends is noticed within a minute. One `gh run list` per repository (the same
// call status makes, with fewer fields and five runs): a repository is looked
// at soon after its refs moved (a push starts a run), every 45 s while a run
// is going, and every 10 minutes otherwise. A repository that fails waits
// 5 minutes and the others go on. A rate limit or a timeout backs the whole
// poll off (5 minutes, doubling to 30) and a good answer ends the backoff.
// It runs through launch night's window too: the readings it causes are the
// engine's to allow or pause. Reads only: the argv has no word of `forbidden`.
import type { Exec } from "./engine";
import { realClock, type Clock } from "./react";

export type CiRepo = { name: string; slug: string };
type Run = { databaseId?: number; status?: string; conclusion?: string };
export type CiChange = { repo: string; ended: boolean };

export const ciArgv = (slug: string) => ["gh", "run", "list", "-R", slug, "-L", "5", "--json", "databaseId,status,conclusion"];
const SLUG = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const ACTIVE_MS = 45_000;
const IDLE_MS = 10 * 60_000;
const SOON_MS = 20_000;
const BACKOFF_MS = 5 * 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;

type Seen = { sig: string; active: boolean; due: number };

export class CiWatch {
  private seen = new Map<string, Seen>();
  private timer?: unknown;
  private stopped = true;
  private running = false;
  private backoff = 0;
  private pausedUntil = 0;
  constructor(
    private o: { repos: () => CiRepo[]; run: Exec; onChange: (c: CiChange) => void; clock?: Clock; tickMs?: number; log?: (line: string) => void },
  ) {}

  private get clock() {
    return this.o.clock ?? realClock;
  }

  /** A repository's refs moved: look at it soon, whatever its idle pace. */
  poke(repo: string) {
    const s = this.seen.get(repo);
    const due = this.clock.now() + SOON_MS;
    if (s) s.due = Math.min(s.due, due);
    else this.seen.set(repo, { sig: "", active: false, due });
  }

  start() {
    this.stopped = false;
    this.arm();
  }
  stop() {
    this.stopped = true;
    if (this.timer !== undefined) this.clock.clear(this.timer);
  }
  private arm() {
    if (!this.stopped) this.timer = this.clock.set(() => void this.tick(), this.o.tickMs ?? 15_000);
  }

  /** One pass: every repository that is due, one after the other. */
  async tick() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const now = this.clock.now();
      if (now < this.pausedUntil) return;
      for (const r of this.o.repos()) {
        if (!SLUG.test(r.slug)) continue;
        const s = this.seen.get(r.name) ?? { sig: "", active: false, due: 0 };
        this.seen.set(r.name, s);
        if (s.due > this.clock.now()) continue;
        if (!(await this.look(r, s))) break;
      }
    } finally {
      this.running = false;
      this.arm();
    }
  }

  /** false: the poll should stop for now (a failure). */
  private async look(r: CiRepo, s: Seen): Promise<boolean> {
    let runs: Run[];
    try {
      const out = await this.o.run(ciArgv(r.slug), 20_000);
      if (out.timedOut || out.code !== 0) throw new Error(out.timedOut ? "gave up" : out.out.trim().split("\n")[0].slice(0, 160));
      const parsed = JSON.parse(out.out);
      if (!Array.isArray(parsed)) throw new Error("not a list of runs");
      runs = parsed;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      // (this repository waits its turn, so one that keeps failing never holds up the rest)
      s.due = this.clock.now() + BACKOFF_MS;
      if (!/rate limit|403|gave up/i.test(why)) {
        this.o.log?.(`ci: ${r.name} unreadable (${why}), trying again in ${BACKOFF_MS / 60_000} min`);
        return true;
      }
      // (a rate limit or a timeout stops the whole poll for a while)
      this.backoff = Math.min(Math.max(this.backoff * 2, BACKOFF_MS), BACKOFF_MAX_MS);
      this.pausedUntil = this.clock.now() + this.backoff;
      this.o.log?.(`ci: ${r.name} unreadable (${why}), pausing ${Math.round(this.backoff / 60_000)} min`);
      return false;
    }
    this.backoff = 0;
    const sig = JSON.stringify(runs.map((x) => [x.databaseId, x.status, x.conclusion]));
    const active = runs.some((x) => x.status !== undefined && x.status !== "completed");
    const first = s.sig === "";
    const changed = !first && sig !== s.sig;
    const ended = changed && s.active && !active;
    s.sig = sig;
    s.active = active;
    s.due = this.clock.now() + (active ? ACTIVE_MS : IDLE_MS);
    // (the first look only sets what later ones are compared with)
    if (changed) this.o.onChange({ repo: r.name, ended });
    return true;
  }
}
