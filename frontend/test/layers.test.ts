import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { demo } from "../src/shared/demo";
import { Outdated, SignedOut } from "../src/shared/data";
import { remote } from "../src/pwa/remote";
import { API_VERSION, ENDPOINTS } from "../src/shared/schema";
import { dataLayerContract } from "./contract";
import { activityFor, commentsFor, numbersFor, playersFor, releasesFor, summaryFor, type Scenario } from "../src/shared/demo";

// ── the demo is valid against the schemas, in every scenario ──
describe("demo numbers", () => {
  for (const s of ["usual", "quiet", "trouble"] as Scenario[])
    test(`${s} parses against every schema (strict: an extra key fails)`, () => {
      expect(ENDPOINTS.summary.schema.parse(summaryFor(s))).toBeTruthy();
      expect(ENDPOINTS.comments.schema.parse(commentsFor(s))).toBeTruthy();
      expect(ENDPOINTS.activity.schema.parse(activityFor(s))).toBeTruthy();
      expect(ENDPOINTS.releases.schema.parse(releasesFor(s))).toBeTruthy();
      expect(ENDPOINTS.players.schema.parse(playersFor())).toBeTruthy();
      for (const r of ["7", "30", "90", "all"] as const) expect(ENDPOINTS.numbers.schema.parse(numbersFor(r))).toBeTruthy();
    });
  test("a range cuts every daily array to the same days", () => {
    const n = numbersFor("7");
    expect(n.days.length).toBe(7);
    for (const xs of Object.values(n.downloads.daily)) expect(xs.length).toBe(7);
    expect(n.downloads.early.length).toBe(7);
  });
});

// ── the demo layer ──
{
  const control = { down: false, signedOut: false, outdated: false };
  dataLayerContract("demo", {
    make: () => demo("usual", control),
    down: (on) => void (control.down = on),
    signedOut: (on) => void (control.signedOut = on),
    outdated: (on) => void (control.outdated = on),
  });
}

// ── the phone's remote layer, on a fake server that answers as the inbox does (ETag, 304, 401) ──
function fakeServer() {
  const state = { down: false, signedOut: false, version: API_VERSION, calls: [] as { path: string; inm: string | null }[] };
  const body = (path: string): unknown => {
    const url = new URL(path, "http://x");
    const v = state.version;
    const withVersion = (o: object) => ({ ...o, apiVersion: v });
    switch (url.pathname) {
      case ENDPOINTS.summary.path: return withVersion(summaryFor("usual"));
      case ENDPOINTS.numbers.path: return withVersion(numbersFor(url.searchParams.get("range") as "7"));
      case ENDPOINTS.players.path: return withVersion(playersFor());
      case ENDPOINTS.comments.path: return withVersion(commentsFor("usual"));
      case ENDPOINTS.activity.path: return withVersion(activityFor("usual"));
      case ENDPOINTS.releases.path: return withVersion(releasesFor("usual"));
    }
    return null;
  };
  const fetchFake = async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const inm = (init?.headers as Record<string, string> | undefined)?.["if-none-match"] ?? null;
    state.calls.push({ path, inm });
    if (state.down) throw new TypeError("network");
    if (state.signedOut) return new Response("{}", { status: 401 });
    const text = JSON.stringify(body(path));
    const etag = `"${createHash("sha256").update(text).digest("base64url").slice(0, 12)}"`;
    if (inm === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(text, { headers: { etag, "content-type": "application/json" } });
  };
  return { state, fetch: fetchFake as typeof fetch };
}

{
  const f = fakeServer();
  dataLayerContract("remote on a fake server", {
    make: () => remote({ fetch: f.fetch }),
    down: (on) => void (f.state.down = on),
    signedOut: (on) => void (f.state.signedOut = on),
    outdated: (on) => void (f.state.version = on ? API_VERSION + 1 : API_VERSION),
  });
}

const asFetch = (f: (...a: never[]) => Promise<Response>) => f as unknown as typeof fetch;

describe("remote layer", () => {
  test("a second read sends the ETag and takes the 304 as the same answer, read now", async () => {
    const f = fakeServer();
    let t = 1000;
    const d = remote({ fetch: f.fetch, now: () => (t += 10) });
    const a = await d.comments();
    const b = await d.comments();
    expect(f.state.calls[1].inm).toMatch(/^"/);
    expect(JSON.stringify(b.data)).toBe(JSON.stringify(a.data));
    expect(b.at).toBeGreaterThan(a.at);
    expect(b.stale).toBe(false);
  });
  test("the last good answer survives a closed app: it comes from the phone's own store, marked stale", async () => {
    const f = fakeServer();
    const kept = new Map<string, string>();
    const store = { get: (k: string) => kept.get(k) ?? null, set: (k: string, v: string) => void kept.set(k, v) };
    await remote({ fetch: f.fetch, store }).summary();
    f.state.down = true;
    const r = await remote({ fetch: f.fetch, store }).summary();
    expect(r.stale).toBe(true);
    expect(r.data.commentsWaiting).toBe(2);
  });
  test("a 304 renews the stored time too, so an offline start tells when the numbers were last confirmed", async () => {
    const f = fakeServer();
    const kept = new Map<string, string>();
    const store = { get: (k: string) => kept.get(k) ?? null, set: (k: string, v: string) => void kept.set(k, v) };
    let t = 1000;
    const d = remote({ fetch: f.fetch, store, now: () => (t += 1000) });
    await d.comments();
    const first = JSON.parse([...kept.values()][0]).at;
    await d.comments();
    expect(JSON.parse([...kept.values()][0]).at).toBeGreaterThan(first);
  });
  test("a stored answer in an old shape is not trusted", async () => {
    const f = fakeServer();
    f.state.down = true;
    const store = { get: () => JSON.stringify({ at: 1, etag: null, body: { apiVersion: 1, nonsense: true } }), set: () => {} };
    await expect(remote({ fetch: f.fetch, store }).summary()).rejects.toThrow();
  });
  test("a wrong shape of the right version is no answer, a wrong version is Outdated", async () => {
    const bad = remote({ fetch: asFetch(async () => new Response(JSON.stringify({ apiVersion: API_VERSION, extra: 1 }))) });
    await expect(bad.summary()).rejects.toThrow();
    const old = remote({ fetch: asFetch(async () => new Response(JSON.stringify({ apiVersion: 9 }))) });
    await expect(old.summary()).rejects.toBeInstanceOf(Outdated);
  });
  test("a 404 (switched off) shows the last answer as old, and with none it is no answer", async () => {
    const f = fakeServer();
    let off = false;
    const d = remote({ fetch: ((u: string, i?: RequestInit) => (off ? Promise.resolve(new Response("{}", { status: 404 })) : f.fetch(u, i))) as typeof fetch });
    await d.comments();
    off = true;
    expect((await d.comments()).stale).toBe(true);
    await expect(d.players()).rejects.toThrow();
  });
  test("401 and 403 are SignedOut", async () => {
    for (const status of [401, 403]) await expect(remote({ fetch: asFetch(async () => new Response("{}", { status })) }).summary()).rejects.toBeInstanceOf(SignedOut);
  });
  test("it asks with the cookie and asks for the range it was given", async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const f = fakeServer();
    const d = remote({ fetch: ((u: string, i?: RequestInit) => (seen.push({ url: String(u), init: i }), f.fetch(u, i))) as typeof fetch });
    await d.numbers("90");
    expect(seen[0].url).toBe("/api/owner/numbers?range=90");
    expect(seen[0].init?.credentials).toBe("same-origin");
  });
});
