/**
 * The addon control centre's server: `bun watchtower/server/control.ts` (from
 * ~/code/wow-addons) serves the pages on 127.0.0.1. It runs the family's own
 * tools on timers (preflight, status, the board, the data's pull requests, the
 * store pages' dry run, wow-data's builds), turns their JSON into lights and
 * offers the harmless buttons. It needs no Claude session and costs nothing
 * while it runs.
 *
 *   bun watchtower/server/control.ts            serve (ctrl-c to stop)
 *   bun watchtower/server/control.ts --demo     made-up state, nothing run
 *   bun watchtower/server/control.ts --once     one gather, the view as JSON, then exit
 *
 * WATCHTOWER_PORT (default 4192, 0 for a free one) and WATCHTOWER_KEY (default:
 * made at each start) come from the environment, never from argv. The server
 * answers this machine only, its Host checked, and the key guards every call.
 * A push, a release, `store.ts --apply` and a merge are not here at all.
 */
import { randomBytes } from "node:crypto";
import { demoData } from "./demo";
import { Engine, exec as realExec, toolDefs, type Cell, type Def, type Exec } from "./engine";
import { action, safe } from "./actions";
import { quiet } from "./rules";
import { page } from "./page";
import { view } from "./view";
import { listZips } from "./zips";

export type Deps = {
  engine: { cells: Record<string, Cell>; refresh(name: string): Promise<void>; has(name: string): boolean; busy(): string[]; sources(): string[] };
  /** The harmless actions' commands: injected so the tests run none. */
  exec: Exec;
  demo?: boolean;
  /** The time, injected so the tests can stand inside launch night's window. */
  clock?: () => number;
};

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export function handler(deps: Deps, key: string, port: number) {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    // (this machine only: another name pointed at 127.0.0.1 is refused)
    if (!hosts.has(req.headers.get("host") ?? "")) return new Response("not here", { status: 403 });
    if (req.method === "GET" && url.pathname === "/") return new Response(page(key, deps.demo === true), { headers: HEADERS });
    if (req.headers.get("x-watchtower-key") !== key) return new Response("this page's key, or nothing", { status: 403 });

    if (req.method === "GET" && url.pathname === "/api/state") return respond(view(deps.engine.cells, deps.engine.busy()));
    if (req.method !== "POST") return new Response("no such page", { status: 404 });
    // (a POST from a page of another origin never carries our key, and this is the second lock)
    const origin = req.headers.get("origin");
    if (origin && ![...hosts].some((h) => origin === `http://${h}`)) return new Response("not here", { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

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

    if (url.pathname === "/api/action") {
      const a = action(body);
      if ("error" in a) return respond({ error: a.error }, 400);
      if (!safe(a)) return respond({ error: "not allowed" }, 400);
      // (a dry run reads the store pages with the user's cookies and gh: launch night's window has them to itself)
      if (!deps.demo && quiet((deps.clock ?? Date.now)())) return respond({ error: "launch night's window: nothing runs until 5 November 06:00 CET" }, 400);
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
  const defs: Record<string, Def> = demo
    ? Object.fromEntries(Object.entries(demoData(now)).map(([id, data]) => [id, { every: 1e12, get: async () => data }]))
    : { ...toolDefs(), zips: { every: 5 * 60_000, get: async () => listZips() } };
  // (the demo ignores launch night's window: it runs nothing)
  const engine = new Engine(defs, demo ? () => 0 : Date.now);
  const deps: Deps = { engine, exec: demo ? async (argv) => ({ out: `(demo) would run: ${argv.join(" ")}`, code: 0, timedOut: false }) : realExec, demo };

  if (args.includes("--once")) {
    await Promise.all(engine.sources().map((s) => engine.refresh(s)));
    console.log(JSON.stringify(view(engine.cells, []), null, 2));
  } else {
    if (demo) await Promise.all(engine.sources().map((s) => engine.refresh(s)));
    else engine.start();
    const key = process.env.WATCHTOWER_KEY || randomBytes(18).toString("base64url");
    let h: (r: Request) => Promise<Response>;
    const server = Bun.serve({ hostname: "127.0.0.1", port: Number(process.env.WATCHTOWER_PORT ?? 4192), fetch: (r) => h(r), idleTimeout: 255 });
    h = handler(deps, key, server.port as number);
    console.log(`watchtower: http://127.0.0.1:${server.port}/${demo ? " (made-up state, nothing run)" : ""}  (ctrl-c to stop)`);
  }
}
