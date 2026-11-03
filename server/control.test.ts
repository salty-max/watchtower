// The server: Host, key, origin, method, the actions' commands injected (none run), the demo's view.
import { describe, expect, test } from "bun:test";
import { handler, type Deps } from "./control";
import { demoCells } from "./demo";
import { Engine } from "./engine";
import { view } from "./view";

const PORT = 4999;
const KEY = "k3y";
const ran: string[][] = [];

function make(over: Partial<Deps> = {}) {
  const engine = new Engine({ board: { every: 1e12, get: async () => [] }, preflight: { every: 1e12, get: async () => [] } }, () => 0);
  const deps: Deps = { engine, exec: async (argv) => (ran.push(argv), { out: "ok", code: 0, timedOut: false }), ...over };
  return { h: handler(deps, KEY, PORT), engine };
}
const ask = (h: ReturnType<typeof make>["h"], path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) =>
  h(new Request(`http://127.0.0.1:${PORT}${path}`, { method: init.method ?? "GET", headers: { host: `127.0.0.1:${PORT}`, ...init.headers }, body: init.body === undefined ? undefined : JSON.stringify(init.body) }));
const keyed = { "x-watchtower-key": KEY };

describe("the server", () => {
  test("the page is served with a frame ban and a CSP, and carries the key", async () => {
    const res = await ask(make().h, "/");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(await res.text()).toContain(JSON.stringify(KEY));
  });
  test("another Host name is refused, even for the page", async () => {
    const { h } = make();
    expect((await ask(h, "/", { headers: { host: "evil.example:4999" } })).status).toBe(403);
    expect((await ask(h, "/", { headers: { host: "127.0.0.1:1" } })).status).toBe(403);
    expect((await ask(h, "/", { headers: { host: `localhost:${PORT}` } })).status).toBe(200);
  });
  test("no key or a wrong one is 403 on every call", async () => {
    const { h } = make();
    expect((await ask(h, "/api/state")).status).toBe(403);
    expect((await ask(h, "/api/state", { headers: { "x-watchtower-key": "no" } })).status).toBe(403);
    expect((await ask(h, "/api/refresh", { method: "POST", body: { source: "all" } })).status).toBe(403);
    expect((await ask(h, "/api/action", { method: "POST", body: { name: "card", id: "x", status: "done" } })).status).toBe(403);
    expect(ran).toEqual([]);
  });
  test("the key is never read from the URL", async () => {
    expect((await ask(make().h, `/api/state?k=${KEY}`)).status).toBe(403);
  });
  test("state answers the view, and a POST from another origin is refused", async () => {
    const { h } = make();
    const res = await ask(h, "/api/state", { headers: keyed });
    expect(res.status).toBe(200);
    expect(Object.keys(await res.json())).toContain("pages");
    expect((await ask(h, "/api/refresh", { method: "POST", headers: { ...keyed, origin: "http://evil.example" }, body: { source: "all" } })).status).toBe(403);
    expect((await ask(h, "/api/refresh", { method: "POST", headers: { ...keyed, origin: `http://127.0.0.1:${PORT}` }, body: { source: "all" } })).status).toBe(200);
  });
  test("only GET and POST on known paths: a PUT, an unknown path and an unknown source are not served", async () => {
    const { h } = make();
    expect((await ask(h, "/api/state", { method: "PUT", headers: keyed })).status).toBe(404);
    expect((await ask(h, "/api/nothing", { method: "POST", headers: keyed, body: {} })).status).toBe(404);
    expect((await ask(h, "/api/refresh", { method: "POST", headers: keyed, body: { source: "../etc" } })).status).toBe(400);
  });
  test("an action runs the table's argv and nothing the body names", async () => {
    ran.length = 0;
    const { h } = make();
    const res = await ask(h, "/api/action", { method: "POST", headers: keyed, body: { name: "store-dry", repo: "yonder", argv: ["git", "push"] } });
    expect(res.status).toBe(200);
    expect(ran).toEqual([["bun", "addon-kit/store.ts", "yonder"]]);
    for (const body of [{ name: "push" }, { name: "store-dry", repo: "x --apply" }, { name: "card", id: "x", status: "running" }]) {
      expect((await ask(h, "/api/action", { method: "POST", headers: keyed, body })).status).toBe(400);
    }
    expect(ran.length).toBe(1);
  });
  test("in launch night's window an action runs nothing, the demo aside", async () => {
    ran.length = 0;
    const inside = Date.parse("2026-11-05T00:00:00Z");
    const { h } = make({ clock: () => inside });
    const res = await ask(h, "/api/action", { method: "POST", headers: keyed, body: { name: "store-dry", repo: "yonder" } });
    expect(res.status).toBe(400);
    expect(ran).toEqual([]);
    const { h: after } = make({ clock: () => inside + 7 * 3600_000 });
    expect((await ask(after, "/api/action", { method: "POST", headers: keyed, body: { name: "store-dry", repo: "yonder" } })).status).toBe(200);
  });
  test("a card's status refreshes the board afterwards", async () => {
    ran.length = 0;
    const { h, engine } = make();
    await ask(h, "/api/action", { method: "POST", headers: keyed, body: { name: "card", id: "a-card", status: "waiting-test" } });
    expect(ran).toEqual([["bun", "addon-kit/board.ts", "set", "a-card", "--status", "waiting-test"]]);
    expect(engine.cells.board?.data).toEqual([]);
  });
});

describe("the demo", () => {
  const v = view(demoCells(Date.parse("2026-11-03T16:30:00Z")), [], Date.parse("2026-11-03T16:30:00Z"));
  test("every page has something to show, and between them every light", () => {
    const lights = new Set<string>();
    for (const c of [...v.releases.addons, ...v.releases.repos, ...v.data.jobs, ...v.data.prs, ...v.stores.stores, ...v.zips.zips]) lights.add(c.verdict.light);
    expect([...lights].sort()).toEqual(["amber", "green", "grey", "red"]);
    expect(v.pages.map((p) => p.id)).toEqual(["releases", "data", "stores", "zips"]);
  });
  test("the tray colour is the worst page, and the window opens on it", () => {
    expect(v.overall).toBe("red");
    expect(v.pages.find((p) => p.id === v.open)?.light).toBe("red");
  });
  test("a Players pull request in the demo is amber, a copy prompt is ready for it", () => {
    const players = v.data.prs.find((p) => p.kind === "players");
    expect(players?.verdict.light).toBe("amber");
    expect(players?.prompt).toContain("Players");
  });
});
