/**
 * The addon control centre's server: `bun watchtower/server/control.ts` (from
 * ~/code/wow-addons) serves the app's data on 127.0.0.1 (the window's pages are frontend/, shown by the Wails shell). It runs the family's own
 * tools on timers (preflight, status, the board, the data's pull requests, the
 * store pages' dry run, wow-data's builds), turns their JSON into lights and
 * offers the harmless buttons. It needs no Claude session and costs nothing
 * while it runs.
 *
 *   bun watchtower/server/control.ts            serve (ctrl-c to stop)
 *   bun watchtower/server/control.ts --demo     made-up state, nothing run
 *   bun watchtower/server/control.ts --once     one gather, the view as JSON, then exit
 *   bun watchtower/server/control.ts notes      the night's ticks and notes as Markdown
 *
 * WATCHTOWER_PORT (default 4192, 0 for a free one) and WATCHTOWER_KEY (default:
 * made at each start) come from the environment, never from argv.
 * WATCHTOWER_SHELL=1 (the desktop app's start): the server stops when its stdin
 * closes (the app quit or died). The server answers this machine only, its
 * Host checked, and the key guards every call: the key is never in a page.
 * A push, a release, `store.ts --apply` and a merge are not here at all.
 */
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { demoData } from "./demo";
import { demoLaunchCells, launchDefs, launchRepoSet, loadContent, notesMarkdown, stateFile, ICLOUD_DRIVE, type Content } from "./launch/night";
import * as night from "./launch/rules";
import { DiskCache } from "./cache";
import { Engine, exec as realExec, toolDefs, type Cell, type Def, type Exec } from "./engine";
import { action, safe } from "./actions";
import { attach, Fixer, type Live } from "./fix";
import { view } from "./view";
import { listZips } from "./zips";

export type Deps = {
  engine: { cells: Record<string, Cell>; refresh(name: string): Promise<void>; has(name: string): boolean; busy(): string[]; sources(): string[] };
  /** The harmless actions' commands: injected so the tests run none. */
  exec: Exec;
  demo?: boolean;
  /** Launch night: its checklist, and the file its ticks and notes live in. */
  night?: { content: Content; stateFile: string; shotsDir: string };
  /** Fix sessions (server/fix.ts): without one there is no fix field and no route. */
  fixer?: Fixer;
  /** The time, injected so the tests can stand inside launch night's window. */
  clock?: () => number;
};

export function handler(deps: Deps, key: string, port: number) {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    // (this machine only: another name pointed at 127.0.0.1 is refused)
    if (!hosts.has(req.headers.get("host") ?? "")) return new Response("not here", { status: 403 });
    if (req.headers.get("x-watchtower-key") !== key) return new Response("the app's key, or nothing", { status: 403 });

    if (req.method === "GET" && url.pathname === "/api/state") {
      const n = deps.night;
      const v = view(deps.engine.cells, deps.engine.busy(), (deps.clock ?? Date.now)(), n && { content: n.content, state: night.readState(n.stateFile) });
      // (the fixes are a layer on the pages: whatever goes wrong in them never blanks the window)
      if (deps.fixer) {
        try {
          attach(v, await deps.fixer.view(deps.engine.cells));
        } catch (e) {
          (v as Record<string, unknown>).fixError = e instanceof Error ? e.message : String(e);
        }
      }
      return respond(v);
    }
    // (an <img> can't send a header, and in the app the shell adds the key to every request, an image's included)
    if (req.method === "GET" && url.pathname === "/api/shot" && deps.night) {
      const name = url.searchParams.get("f") ?? "";
      const known = ((deps.engine.cells["launch-shots"]?.data as { name: string }[] | undefined) ?? []).some((s) => s.name === name);
      if (!known || name !== basename(name)) return new Response("no such picture", { status: 404 });
      return new Response(Bun.file(join(deps.night.shotsDir, name)), { headers: { "cache-control": "private, max-age=300" } });
    }
    if (req.method === "GET" && url.pathname === "/api/notes" && deps.night) {
      return new Response(notesMarkdown(night.readState(deps.night.stateFile), deps.night.content), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
    }
    if (req.method !== "POST") return new Response("no such page", { status: 404 });
    // (a POST from a page of another origin never carries our key, and this is the second lock)
    const origin = req.headers.get("origin");
    if (origin && ![...hosts].some((h) => origin === `http://${h}`)) return new Response("not here", { status: 403 });
    const sent: unknown = await req.json().catch(() => ({}));
    const body = (sent && typeof sent === "object" && !Array.isArray(sent) ? sent : {}) as Record<string, unknown>;

    if (url.pathname === "/api/refresh") {
      const name = String(body.source ?? "");
      try {
        if (name === "all") await Promise.all(deps.engine.sources().map((s) => deps.engine.refresh(s)));
        else await deps.engine.refresh(name);
      } catch (e) {
        return respond({ error: e instanceof Error ? e.message : String(e) }, 400);
      }
      return respond({ ok: true });
    }

    // a fix session: the preview (nothing started), then the second press with its one-time token
    if (url.pathname === "/api/fix/preview" && deps.fixer) {
      const p = await deps.fixer.preview(String(body.key ?? ""), deps.engine.cells);
      return respond(p, "error" in p ? 400 : 200);
    }
    if (url.pathname === "/api/fix/start" && deps.fixer) {
      const r = await deps.fixer.start(String(body.token ?? ""), deps.engine.cells);
      return respond(r, "error" in r ? 400 : 200);
    }
    if (url.pathname === "/api/fix/attach" && deps.fixer) {
      const r = await deps.fixer.attach(String(body.key ?? ""), deps.engine.cells);
      return respond(r, "error" in r ? 400 : 200);
    }
    if (url.pathname === "/api/fix/dispatcher" && deps.fixer) {
      const e = deps.fixer.choose(String(body.session ?? ""));
      return e ? respond({ error: e }, 400) : respond({ ok: true });
    }

    if (url.pathname === "/api/change" && deps.night) {
      const next = night.apply(night.readState(deps.night.stateFile), body);
      if (typeof next === "string") return respond({ error: next }, 400);
      night.writeState(deps.night.stateFile, next);
      return respond({ ok: true });
    }

    if (url.pathname === "/api/action") {
      const a = action(body);
      if ("error" in a) return respond({ error: a.error }, 400);
      if (!safe(a)) return respond({ error: "not allowed" }, 400);
      const r = await deps.exec(a.argv, a.timeoutSec * 1000);
      if (body.name === "card") await deps.engine.refresh("board");
      return respond({ ok: r.code === 0 && !r.timedOut, out: r.timedOut ? "gave up waiting" : r.out.slice(-6000) });
    }
    return new Response("no such page", { status: 404 });
  };
}

// ── the command ─────────────────────────────────────────────────────────────
if (import.meta.main) {
  const args = process.argv.slice(2);
  const demo = args.includes("--demo");
  const now = Date.now();
  const content = loadContent();
  const constant = (data: unknown): Def => ({ every: 1e12, always: true, get: async () => data });
  const defs: Record<string, Def> = demo
    ? { ...Object.fromEntries(Object.entries(demoData(now)).map(([id, data]) => [id, constant(data)])), ...Object.fromEntries(Object.entries(demoLaunchCells(content, now)).map(([id, c]) => [id, constant(c.data)])) }
    : { ...toolDefs(), ...launchDefs(content), zips: { every: 5 * 60_000, key: "folder", shape: "array", get: async () => listZips() } };
  // (the demo ignores launch night's window: it runs nothing)
  // (the last good readings from disk draw the pages at once: only the server proper, not the demo or --once)
  const cache = demo || args.includes("--once") ? undefined : new DiskCache();
  cache?.sweep();
  const engine = new Engine(defs, demo ? () => 0 : Date.now, cache);
  const deps: Deps = {
    engine,
    exec: demo ? async (argv) => ({ out: `(demo) would run: ${argv.join(" ")}`, code: 0, timedOut: false }) : realExec,
    demo,
    night: { content, stateFile: stateFile(demo, tmpdir()), shotsDir: ICLOUD_DRIVE },
    // (the demo starts nothing and keeps its tries in memory; a made-up dispatcher lets the window show the preview)
    fixer: new Fixer({ spawn: realExec, demo, launchRepos: launchRepoSet(content), ...(demo ? { registry: (): Live[] => [{ sessionId: "0de0de0d-0000-0000-0000-000000000000", name: "the dispatch (demo)", status: "idle", socket: "/tmp/cc-socks/0.sock", kind: "interactive" }], agents: async () => [] } : {}) }),
  };

  if (args.includes("--once")) {
    await Promise.all(engine.sources().map((s) => engine.refresh(s)));
    console.log(JSON.stringify(view(engine.cells, [], Date.now(), { content, state: night.readState(deps.night!.stateFile) }), null, 2));
  } else if (args[0] === "notes") {
    process.stdout.write(notesMarkdown(night.readState(deps.night!.stateFile), content));
  } else {
    if (demo) await Promise.all(engine.sources().map((s) => engine.refresh(s)));
    else engine.start();
    const key = process.env.WATCHTOWER_KEY || randomBytes(18).toString("base64url");
    let h: (r: Request) => Promise<Response>;
    const server = Bun.serve({ hostname: "127.0.0.1", port: Number(process.env.WATCHTOWER_PORT ?? 4192), fetch: (r) => h(r), idleTimeout: 255 });
    h = handler(deps, key, server.port as number);
    if (process.env.WATCHTOWER_SHELL === "1") {
      // (the app holds our stdin: its end of the pipe closing, however it happened, ends us)
      void (async () => {
        for await (const _ of Bun.stdin.stream()) void _;
        process.exit(0);
      })();
    }
    console.log(`watchtower server: http://127.0.0.1:${server.port}/${demo ? " (made-up state, nothing run)" : ""}  (ctrl-c to stop; the window is the app, or \`bun run dev\` in frontend/)`);
  }
}
