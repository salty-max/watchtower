import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";

/**
 * A headless Chrome and a server for the built phone app, for the phone check
 * (test/phone.test.ts) and for looking at the pages (scripts/shots.ts). Chrome is
 * found where macOS and the CI images keep it, or at CHROME_PATH; with none the
 * check says it was skipped, never that it passed.
 */
export function chromePath(): string | null {
  const wanted = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return wanted.find((p): p is string => !!p && existsSync(p)) ?? null;
}

export async function launch(): Promise<Browser> {
  const exe = chromePath();
  if (!exe) throw new Error("no Chrome found (set CHROME_PATH)");
  return puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
}

const TYPES: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".webmanifest": "application/manifest+json" };

/** The built app's folder served as the deploy serves it: files under /app/, the page at /stats/next (any path below it). */
export function serve(dir: string) {
  return Bun.serve({
    port: 0,
    fetch(req) {
      const p = new URL(req.url).pathname;
      const f = p.startsWith("/app/") ? path.join(dir, p.slice(5)) : /^\/stats\/next(\/.*)?$/.test(p) ? path.join(dir, "index.html") : "";
      if (f && f.startsWith(dir) && existsSync(f)) return new Response(readFileSync(f), { headers: { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" } });
      return new Response("not found", { status: 404 });
    },
  });
}
