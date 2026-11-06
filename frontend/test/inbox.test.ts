import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { remote } from "../src/pwa/remote";
import { ENDPOINTS } from "../src/shared/schema";
import { dataLayerContract } from "./contract";

/**
 * The phone's data layer on the inbox's own app, in the same process: the
 * cookie, the schemas, the ETags, on the inbox's test numbers. The inbox is
 * another repository: where it is not beside this one (a checkout of this
 * repository alone, as CI makes) the whole file is skipped, and says so.
 */
const inbox = path.resolve(import.meta.dir, "../../../ravenpost/inbox");
const here = existsSync(path.join(inbox, "src", "app.ts")) && existsSync(path.join(inbox, "node_modules"));

if (!here) {
  test("the inbox is not beside this repository: contract on its real app SKIPPED", () => {
    console.warn("contract on the inbox's app SKIPPED: ../ravenpost/inbox (with its node_modules) is not beside this repository");
  });
} else {
  const { app } = await import(path.join(inbox, "src/app"));
  const { signAs } = await import(path.join(inbox, "src/auth"));
  const store = await import(path.join(inbox, "src/store"));
  const { forgetAsked, setGitHubFetch } = await import(path.join(inbox, "src/github"));
  const { resetLimits } = await import(path.join(inbox, "src/ratelimit"));
  const fx = await import(path.join(inbox, "test/fixtures/dashboard"));

  const OWNER = "Namzar#21586";
  const now = () => Math.floor(Date.now() / 1000);
  const cookie = () => ({ cookie: `rp_stats=${signAs("stats", { tag: OWNER, exp: now() + 600 })}` });
  const k = { down: false, out: false };

  beforeEach(async () => {
    process.env.INBOX_DIR = mkdtempSync(path.join(tmpdir(), "inbox-contract-"));
    process.env.STATS_BATTLETAGS = OWNER;
    for (const key of ["OWNER_API_OFF", "OWNER_REVOKED_BEFORE", "INBOX_DEV"]) delete process.env[key];
    setSystemTime(new Date(fx.NOW));
    resetLimits();
    forgetAsked();
    setGitHubFetch(async () => new Response("", { status: 404 }));
    const w = (name: string, v: unknown) => store.write(name, JSON.stringify(v));
    await w("stats/history.json", fx.history);
    await w("stats/today.json", fx.today);
    await w("stats/unique.json", fx.unique);
    await w("releases/latest.json", fx.releases);
    await w("releases/github.json", fx.github);
    await w("events/recent.json", fx.events);
    await w("events/resolved.json", fx.resolved);
    await w("comments/recent.json", { threads: fx.threads });
  });
  afterEach(() => {
    rmSync(process.env.INBOX_DIR!, { recursive: true, force: true });
    setSystemTime();
  });

  const viaApp = ((u: string, init?: RequestInit) => {
    if (k.down) return Promise.reject(new TypeError("network"));
    return app.request(u, { ...init, headers: { ...(init?.headers as Record<string, string>), ...(k.out ? {} : cookie()) } });
  }) as unknown as typeof fetch;

  dataLayerContract("remote on the inbox's own app, with the cookie", {
    make: () => remote({ fetch: viaApp }),
    down: (on) => void (k.down = on),
    signedOut: (on) => void (k.out = on),
  });

  describe("the real answers", () => {
    test("every part parses against this repository's schemas, and a second read is a 304 the layer takes as the same", async () => {
      k.down = false;
      k.out = false;
      const d = remote({ fetch: viaApp });
      for (const part of ["summary", "players", "comments", "activity", "releases"] as const) {
        const a = await d[part]();
        expect(ENDPOINTS[part].schema.safeParse(a.data).success, part).toBe(true);
        expect((await d[part]()).stale).toBe(false);
      }
    });
  });
}
