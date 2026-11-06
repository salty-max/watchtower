import { mkdirSync } from "node:fs";
import path from "node:path";
import { launch, serve } from "./browser";
import { NAV } from "../src/shared/nav";

/**
 * Screenshots of every page of the built app on the demo numbers, at the widths
 * given: `bun scripts/shots.ts <built app folder> <out folder> [width,width] [scenario]`.
 * Build first (`bun run build`, or `bunx vite build --outDir <folder>`).
 */
const [dir, out, widths = "1180,390", scenario = "usual"] = Bun.argv.slice(2);
if (!dir || !out) throw new Error("usage: bun scripts/shots.ts <built app folder> <out folder> [widths] [scenario]");
mkdirSync(out, { recursive: true });
const server = serve(path.resolve(dir));
const browser = await launch();
try {
  for (const w of widths.split(",").map(Number)) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: w > 700 ? 800 : 844, deviceScaleFactor: 2, isMobile: w < 700, hasTouch: w < 700 });
    for (const n of NAV.filter((n) => !n.needs)) {
      await page.goto(`http://localhost:${server.port}/stats/next/?demo=${scenario}#/${n.id}`, { waitUntil: "networkidle0" });
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(out, `${n.id}-${w}-${scenario}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.stop(true);
}
