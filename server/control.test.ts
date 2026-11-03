// The server: Host, key, origin, method, the actions' commands injected (none run), the demo's view.
import { describe, expect, test } from "bun:test";
import { handler, type Deps } from "./control";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoCells } from "./demo";
import { demoLaunchCells, loadContent } from "./launch/night";
import { Engine } from "./engine";
import { Fixer, type Live } from "./fix";
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
  test("another Host name is refused, even for the page", async () => {
    const { h } = make();
    expect((await ask(h, "/api/state", { headers: { host: "evil.example:4999", ...keyed } })).status).toBe(403);
    expect((await ask(h, "/api/state", { headers: { host: "127.0.0.1:1", ...keyed } })).status).toBe(403);
    expect((await ask(h, "/api/state", { headers: { host: `localhost:${PORT}`, ...keyed } })).status).toBe(200);
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
  test("a button still works in launch night's window (the user's own press), while the store timer waits", async () => {
    ran.length = 0;
    const { h } = make({ clock: () => Date.parse("2026-11-05T00:00:00Z") });
    expect((await ask(h, "/api/action", { method: "POST", headers: keyed, body: { name: "store-dry", repo: "yonder" } })).status).toBe(200);
    expect((await ask(h, "/api/action", { method: "POST", headers: keyed, body: { name: "card", id: "a-card", status: "done" } })).status).toBe(200);
    expect(ran).toHaveLength(2);
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

  describe("launch night's routes", () => {
    const dir = mkdtempSync(join(tmpdir(), "wt-night-"));
    const content = loadContent();
    const night = { content, stateFile: join(dir, "s.json"), shotsDir: dir };
    const withNight = () => {
      const m = make({ night });
      m.engine.cells = { ...demoCells(), ...demoLaunchCells(content) };
      return m;
    };
    test("the state carries the Launch page, and without launch night there is none", async () => {
      const v = (await (await ask(withNight().h, "/api/state", { headers: keyed })).json()) as { launch?: { addons: unknown[] }; pages: { id: string }[] };
      expect(v.launch?.addons).toHaveLength(9);
      expect(v.pages.map((p) => p.id)).toContain("launch");
      const bare = (await (await ask(make().h, "/api/state", { headers: keyed })).json()) as { launch?: unknown };
      expect(bare.launch).toBeUndefined();
    });
    test("a tick is saved, checked, and shows on the Launch page", async () => {
      const { h } = withNight();
      expect((await ask(h, "/api/change", { method: "POST", headers: keyed, body: { op: "tick", key: "keyring/drawer", value: "broken" } })).status).toBe(200);
      const v = (await (await ask(h, "/api/state", { headers: keyed })).json()) as { launch: { addons: { id: string; light: string }[] } };
      expect(v.launch.addons.find((a) => a.id === "keyring")?.light).toBe("red");
      expect((await ask(h, "/api/change", { method: "POST", headers: keyed, body: { op: "tick", key: "bad", value: "ok" } })).status).toBe(400);
      expect((await ask(h, "/api/change", { method: "POST", body: { op: "tick", key: "a/b", value: "ok" } })).status).toBe(403);
    });
    test("the notes come out as Markdown", async () => {
      const { h } = withNight();
      const res = await ask(h, "/api/notes", { headers: keyed });
      expect(await res.text()).toContain("# Launch night");
      expect((await ask(h, "/api/notes")).status).toBe(403);
    });
    test("a screenshot is served only if the engine listed it, never by a path", async () => {
      const { h, engine } = withNight();
      engine.cells["launch-shots"] = { at: 0, ms: 0, data: [{ name: "a.png", mtime: 1 }] };
      await Bun.write(join(dir, "a.png"), "png");
      await Bun.write(join(dir, "secret.txt"), "no");
      const ok = await ask(h, "/api/shot?f=a.png", { headers: keyed });
      expect(ok.status).toBe(200);
      expect(await ok.text()).toBe("png");
      expect((await ask(h, "/api/shot?f=secret.txt", { headers: keyed })).status).toBe(404);
      expect((await ask(h, "/api/shot?f=..%2Fa.png", { headers: keyed })).status).toBe(404);
      expect((await ask(h, "/api/shot?f=a.png")).status).toBe(403);
    });
  });
});

describe("fix sessions' routes", () => {
  const DISPATCH: Live = { sessionId: "11112222-3333-4444-5555-666677778888", name: "the-dispatch", status: "idle", socket: "/tmp/cc-socks/9.sock", kind: "interactive" };
  const fixDir = mkdtempSync(join(tmpdir(), "wt-fix-"));
  const spawned: string[][] = [];
  const withFixer = () => {
    spawned.length = 0;
    rmSync(join(fixDir, "fixes.json"), { force: true });
    const fixer = new Fixer({ dir: fixDir, registry: () => [DISPATCH], agents: async () => [], spawn: async (argv) => (spawned.push(argv), { out: 'opened "x" (opusplan) as abc12345\n', code: 0, timedOut: false }) });
    const m = make({ fixer });
    m.engine.cells = demoCells();
    return m;
  };
  const post = (h: ReturnType<typeof make>["h"], path: string, body: unknown, headers: Record<string, string> = keyed) => ask(h, path, { method: "POST", headers, body });

  test("the state carries a fix on the red row and the list, and nothing without a fixer", async () => {
    const v = (await (await ask(withFixer().h, "/api/state", { headers: keyed })).json()) as { fixes: { key: string; state: string }[]; dispatcher: string; releases: { repos: { name: string; fix?: { key: string; state: string } }[] } };
    expect(v.fixes.map((f) => f.key)).toContain("keyring/ci/CI");
    expect(v.releases.repos.find((r) => r.name === "keyring")?.fix).toMatchObject({ key: "keyring/ci/CI", state: "offered" });
    expect(v.dispatcher).toBe(DISPATCH.sessionId);
    const bare = (await (await ask(make().h, "/api/state", { headers: keyed })).json()) as { fixes?: unknown };
    expect(bare.fixes).toBeUndefined();
  });

  test("preview starts nothing, the press with its token starts one, a replay and a missing key do not", async () => {
    const { h } = withFixer();
    const p = (await (await post(h, "/api/fix/preview", { key: "keyring/ci/CI" })).json()) as { token: string; prompt: string };
    expect(p.prompt).toContain("BEGIN EVIDENCE");
    expect(spawned).toEqual([]);
    expect((await post(h, "/api/fix/start", { token: p.token }, {})).status).toBe(403);
    const r = await post(h, "/api/fix/start", { token: p.token });
    expect(r.status).toBe(200);
    expect(spawned).toHaveLength(1);
    expect(spawned[0].slice(0, 3)).toEqual(["bun", "addon-kit/session.ts", "Fix: keyring ci CI"]);
    expect((await post(h, "/api/fix/start", { token: p.token })).status).toBe(400);
    expect(spawned).toHaveLength(1);
  });

  test("an unknown light, a bad token and a foreign origin are refused, and without a fixer there is no route", async () => {
    const { h } = withFixer();
    expect((await post(h, "/api/fix/preview", { key: "nothing/ci/CI" })).status).toBe(400);
    expect((await post(h, "/api/fix/start", { token: "nope" })).status).toBe(400);
    expect((await post(h, "/api/fix/preview", { key: "keyring/ci/CI" }, { ...keyed, origin: "http://evil.example" })).status).toBe(403);
    expect((await post(make().h, "/api/fix/preview", { key: "keyring/ci/CI" }, {})).status).toBe(403);
    expect((await post(make().h, "/api/fix/preview", { key: "keyring/ci/CI" })).status).toBe(404);
  });

  test("a fixer that breaks, or a malformed reading, never takes the state down; a null body is a 400, not a crash", async () => {
    const broken = new Fixer({ dir: fixDir, registry: () => { throw new Error("registry gone"); }, agents: async () => [], spawn: async () => ({ out: "", code: 0, timedOut: false }) });
    const m = make({ fixer: broken });
    m.engine.cells = demoCells();
    const res = await ask(m.h, "/api/state", { headers: keyed });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { fixError?: string }).fixError).toContain("registry gone");
    // (a job with a run that has no url: the section is skipped)
    const odd = withFixer();
    (odd.engine.cells["data-prs"].data as { jobs: { run?: unknown }[] }).jobs[0].run = { conclusion: "failure", status: "completed" };
    expect((await ask(odd.h, "/api/state", { headers: keyed })).status).toBe(200);
    const nul = await ask(odd.h, "/api/fix/preview", { method: "POST", headers: keyed, body: null });
    expect(nul.status).toBe(400);
  });

  test("attach: a light with no session is a 400, a foreign origin is refused", async () => {
    const { h } = withFixer();
    expect((await post(h, "/api/fix/attach", { key: "keyring/ci/CI" })).status).toBe(400);
    expect((await post(h, "/api/fix/attach", { key: "keyring/ci/CI" }, { ...keyed, origin: "http://evil.example" })).status).toBe(403);
    expect((await post(h, "/api/fix/attach", { key: "keyring/ci/CI" }, {})).status).toBe(403);
  });

  test("the dispatcher is chosen among the live ones only", async () => {
    const { h } = withFixer();
    expect((await post(h, "/api/fix/dispatcher", { session: DISPATCH.sessionId })).status).toBe(200);
    expect((await post(h, "/api/fix/dispatcher", { session: "not-alive" })).status).toBe(400);
  });
});
