// Running the family's tools and keeping their answers: one cell per source,
// filled on timers, one flight at a time, an old answer kept when the new one
// fails (marked with the error, so the page can call it stale).
import { quiet } from "./rules";
import { family, SOURCES, type Source } from "./sources";

export type Cell = { at: number; ms: number; data?: unknown; error?: string; paused?: boolean };
/** `every` may depend on the hour (launch night is read faster). `always`: read even in launch night's window, as launch night is Watchtower's own page now (the others, which take cookies and more rate limit, wait). */
export type Def = { every: number | (() => number); get: () => Promise<unknown>; always?: boolean };
export type Exec = (argv: string[], ms: number) => Promise<{ out: string; code: number; timedOut: boolean }>;

/** Runs an argv from the family folder, killing it after `ms`. */
export const exec: Exec = async (argv, ms) => {
  const root = family();
  if (!root) throw new Error("no family folder beside this repository");
  const p = Bun.spawn(argv, { cwd: root, stdout: "pipe", stderr: "pipe", env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("WATCHTOWER_"))), NO_COLOR: "1" } });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    p.kill();
  }, ms);
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;
  clearTimeout(timer);
  return { out: out || err, code, timedOut };
};

/** One tool's `--json`. A non-zero exit still counts when it printed JSON (preflight exits 1 while a ✗ stands). */
export async function readJson(run: Exec, s: Source): Promise<unknown> {
  const r = await run(s.argv, s.timeoutSec * 1000);
  if (r.timedOut) throw new Error(`gave up after ${s.timeoutSec} s`);
  try {
    return JSON.parse(r.out);
  } catch {
    throw new Error(`no JSON from ${s.argv.slice(1, 2).join(" ")}: ${r.out.trim().split("\n").slice(-2).join(" ").slice(0, 200)}`);
  }
}

/** What launch night reads, and so what runs in its window. */
export const LAUNCH_READS = new Set(["preflight", "status", "board", "latest"]);
/** From the evening before launch to the morning after, the readings launch night leans on come faster (launch night's own pace). */
const FAST = { board: 1, status: 2 } as Record<string, number>;
const fast = (now: number) => now >= Date.parse("2026-11-04T12:00:00Z") && now < Date.parse("2026-11-06T06:00:00Z");

export const toolDefs = (run: Exec = exec, clock: () => number = Date.now): Record<string, Def> =>
  Object.fromEntries(SOURCES.map((s) => [s.id, { every: () => (FAST[s.id] && fast(clock()) ? FAST[s.id] : s.everyMin) * 60_000, always: LAUNCH_READS.has(s.id), get: () => readJson(run, s) }]));

export class Engine {
  cells: Record<string, Cell> = {};
  private inflight = new Map<string, Promise<void>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private stopped = false;
  constructor(
    private defs: Record<string, Def>,
    private clock: () => number = Date.now,
  ) {}

  has = (name: string) => Object.hasOwn(this.defs, name);
  sources = () => Object.keys(this.defs);

  refresh(name: string): Promise<void> {
    const def = Object.hasOwn(this.defs, name) ? this.defs[name] : undefined;
    if (!def) return Promise.reject(new Error(`no source ${name}`));
    // (launch night's window: nothing runs, the last answers stay)
    if (!def.always && quiet(this.clock())) {
      this.cells[name] = { ...this.cells[name], at: this.cells[name]?.at ?? this.clock(), ms: this.cells[name]?.ms ?? 0, paused: true };
      return Promise.resolve();
    }
    const running = this.inflight.get(name);
    if (running) return running;
    const t = Date.now();
    const p = def
      .get()
      .then((data) => {
        this.cells[name] = { at: Date.now(), ms: Date.now() - t, data };
      })
      .catch((e) => {
        this.cells[name] = { ...this.cells[name], at: this.cells[name]?.at ?? Date.now(), ms: Date.now() - t, error: e instanceof Error ? e.message : String(e) };
      })
      .finally(() => this.inflight.delete(name));
    this.inflight.set(name, p);
    return p;
  }

  start() {
    this.stopped = false;
    for (const [name, def] of Object.entries(this.defs)) {
      const loop = () => {
        if (this.stopped) return;
        void this.refresh(name);
        this.timers.set(name, setTimeout(loop, typeof def.every === "function" ? def.every() : def.every));
      };
      loop();
    }
  }
  stop() {
    this.stopped = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
  busy = () => [...this.inflight.keys()];
}
