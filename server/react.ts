// Reading a source when something it depends on changed, instead of waiting
// for its timer. Events (a ref moved, a card written, a zip landed, a CI run
// ended) say which sources are stale; this decides when they are read: after
// a short quiet moment (a commit writes several files), never twice within
// the source's gap (preflight takes a minute), never while it is already
// being read (a change that lands mid-read gets one more read after it).
// The timers stay as the safety net, so a missed event costs a wait, not a
// wrong answer.

export type Clock = {
  now(): number;
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

export const realClock: Clock = {
  now: () => Date.now(),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** The least time between two readings caused by events, per source (seconds' worth of git, a minute for the slow tools). Stores are never read on an event: they use the user's cookies. */
export const GAPS_MS: Record<string, number> = { board: 5_000, zips: 5_000, status: 20_000, latest: 60_000, "data-prs": 60_000, preflight: 180_000 };
const DEFAULT_GAP_MS = 30_000;

type Cell = { pending: boolean; first: number; last: number; started: number; timer?: unknown };

export type Reading = { refresh(name: string): Promise<void>; has(name: string): boolean; busy(): string[] };

export class Reactor {
  private cells = new Map<string, Cell>();
  private stopped = false;
  constructor(
    private engine: Reading,
    private opts: { debounceMs?: number; maxWaitMs?: number; gaps?: Record<string, number>; clock?: Clock; log?: (line: string) => void } = {},
  ) {}

  private get clock() {
    return this.opts.clock ?? realClock;
  }
  private gap = (name: string) => (this.opts.gaps ?? GAPS_MS)[name] ?? DEFAULT_GAP_MS;

  /** Something these sources read has changed. `why` is for the log only. */
  trigger(names: string[], why: string) {
    if (this.stopped) return;
    for (const name of names) {
      if (!this.engine.has(name)) continue;
      const c = this.cells.get(name) ?? { pending: false, first: 0, last: 0, started: -Infinity };
      this.cells.set(name, c);
      const now = this.clock.now();
      if (!c.pending) c.first = now;
      c.pending = true;
      c.last = now;
      this.opts.log?.(`${name}: ${why}`);
      this.schedule(name, c);
    }
  }

  private schedule(name: string, c: Cell) {
    if (c.timer !== undefined) this.clock.clear(c.timer);
    const now = this.clock.now();
    const quietAt = Math.min(c.last + (this.opts.debounceMs ?? 1500), c.first + (this.opts.maxWaitMs ?? 15_000));
    const due = Math.max(quietAt, c.started + this.gap(name));
    c.timer = this.clock.set(() => this.fire(name, c), Math.max(0, due - now));
  }

  private fire(name: string, c: Cell) {
    c.timer = undefined;
    if (this.stopped || !c.pending) return;
    // (one flight per source: the change waits for the reading in progress, then gets its own)
    if (this.engine.busy().includes(name)) {
      c.timer = this.clock.set(() => this.fire(name, c), 2_000);
      return;
    }
    c.pending = false;
    c.started = this.clock.now();
    this.engine.refresh(name).catch(() => undefined);
  }

  /** The sources waiting for their moment. */
  waiting = () => [...this.cells].filter(([, c]) => c.pending).map(([n]) => n);

  stop() {
    this.stopped = true;
    for (const c of this.cells.values()) if (c.timer !== undefined) this.clock.clear(c.timer);
    this.cells.clear();
  }
}
