import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Browser } from "puppeteer-core";
import { chromePath, launch, serve } from "../scripts/browser";
import { NAV } from "../src/shared/nav";

/**
 * The phone check (the plan's "Checking it at phone width"): every page of the
 * built app on the demo numbers in a real Chrome at 375 and 390 px, a touch
 * phone. No sideways scroll, no button or link under 40 px high, no text under
 * 12 px, and a screenshot of each in frontend/.shots/ for the session to LOOK at (the
 * assertions cannot see a sentence squeezed into a five-line column). Skipped,
 * and said so, where there is no Chrome.
 */
const chrome = chromePath();
const out = path.join(import.meta.dir, "..", ".shots");
let tmp = "";
let browser: Browser;
let server: ReturnType<typeof serve>;

describe.skipIf(!chrome)("phone width", () => {
  beforeAll(async () => {
    tmp = mkdtempSync(path.join(tmpdir(), "watchtower-app-"));
    const build = Bun.spawnSync(["bunx", "vite", "build", "--config", "vite.pwa.config.ts", "--outDir", tmp, "--emptyOutDir"], { cwd: path.join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" });
    if (build.exitCode !== 0) throw new Error(`the build failed: ${build.stderr.toString()}`);
    mkdirSync(out, { recursive: true });
    server = serve(tmp);
    browser = await launch();
  }, 120_000);
  afterAll(async () => {
    await browser?.close();
    server?.stop(true);
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  const cases = NAV.filter((n) => !n.needs).flatMap((n) => [375, 390].flatMap((w) => (n.id === "overview" ? ["usual", "quiet", "trouble"] : ["usual"]).map((s) => [n.id, w, s] as const)));
  for (const [id, width, scenario] of cases)
    test(`${id} at ${width} (${scenario})`, async () => {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.goto(`http://localhost:${server.port}/stats/next/?demo=${scenario}#/${id}`, { waitUntil: "networkidle0" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, `${id}-${width}-${scenario}.png`), fullPage: true });
      const r = await page.evaluate(() => {
        const visible = (e: Element) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden";
        };
        const small: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()) || !visible(el)) continue;
          if (parseFloat(getComputedStyle(el).fontSize) < 12) small.push(`${el.tagName} ${el.textContent!.trim().slice(0, 30)}`);
        }
        const short = [...document.querySelectorAll("button, a")].filter(visible).filter((e) => e.getBoundingClientRect().height < 40).map((e) => `${e.tagName} ${e.textContent!.trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().height)}`);
        return { width: document.documentElement.scrollWidth, inner: innerWidth, small, short, hasBar: !!document.querySelector("nav.fixed") && getComputedStyle(document.querySelector("nav.fixed")!).display !== "none", sidebar: [...document.querySelectorAll("aside")].some(visible) };
      });
      await page.close();
      expect(r.width, "sideways scroll").toBe(r.inner);
      expect(r.short, "targets under 40 px").toEqual([]);
      expect(r.small, "text under 12 px").toEqual([]);
      expect(r.hasBar, "the bottom bar").toBe(true);
      expect(r.sidebar, "no sidebar on a phone").toBe(false);
    }, 30_000);

  test("at a wide window the sidebar is there and the bottom bar is not", async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1180, height: 800 });
    await page.goto(`http://localhost:${server.port}/stats/next/?demo#/downloads`, { waitUntil: "networkidle0" });
    const r = await page.evaluate(() => ({ aside: getComputedStyle(document.querySelector("aside")!).display, bar: getComputedStyle(document.querySelector("nav.fixed")!).display, w: document.documentElement.scrollWidth }));
    await page.close();
    expect(r.aside).not.toBe("none");
    expect(r.bar).toBe("none");
    expect(r.w).toBe(1180);
  }, 30_000);
});

test("says when it was skipped", () => {
  if (!chrome) console.warn("phone check SKIPPED: no Chrome found (set CHROME_PATH)");
});
