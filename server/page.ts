/**
 * The page, one HTML document (control.ts serves it): the markup here, the look
 * in web/page.css, the drawing in web/page.js. No build step, no font or
 * script from elsewhere. The key rides in the script, so another site open in
 * the browser can't press a button.
 */
import css from "../web/page.css" with { type: "text" };
import js from "../web/page.js" with { type: "text" };

export function page(key: string, demo: boolean): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Watchtower</title>
<style>${css}</style></head><body>
<div class="stale" id="stale" hidden>Lost the server. Start it again: bun watchtower/server/control.ts</div>
<div class="wrap">
<header class="panel band">
  <div class="verdict"><div class="beacon grey" id="beacon" aria-hidden="true"></div><div><h1>Watchtower</h1><span id="oneline">Reading…</span></div></div>
  <div class="side-actions"><span class="age" id="age"></span><button class="btn" id="refresh-all" type="button">Refresh all</button></div>
</header>
<div class="banner" id="quiet" hidden>Launch night's window: nothing is being read from 4 November 22:00 to 5 November 06:00 CET. The last answers stay.</div>
<nav class="tabs" id="tabs" role="tablist" aria-label="Pages"></nav>
<main id="main" tabindex="-1"></main>
</div>
<script>const KEY=${JSON.stringify(key)};const DEMO=${demo ? "true" : "false"};${js}</script></body></html>`;
}
