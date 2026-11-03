// Watchtower's page: polls /api/state, draws the four pages and the launch tab.
// Plain DOM, no build. Everything the server sends is escaped before it is drawn.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LIGHT = { green: "ready", amber: "to look at", red: "in the way", grey: "not read" };
let state = null;
let page = (location.hash || "").slice(1) || null;
let drawn = "";
const opened = new Set();
const outputs = {};

async function call(path, body) {
  const res = await fetch(path, { method: body ? "POST" : "GET", headers: { "x-watchtower-key": KEY, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 400) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const dot = (l) => `<span class="dot ${l}" title="${LIGHT[l]}" role="img" aria-label="${LIGHT[l]}"></span>`;
const reasons = (v) => (v.reasons.length ? `<ul class="reasons ${v.light}">${v.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "");
const copy = (text, label = "Copy prompt") => (text ? `<button class="btn sm" type="button" data-act="copy" data-text="${esc(text)}" data-key="copy:${esc(text.slice(0, 40))}">${label}</button>` : "");
const link = (url, label) => (/^https:\/\//.test(url || "") ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : "");
const card = (key, light, title, small, body, tools = "") =>
  `<article class="panel card ${light}" data-card="${esc(key)}"><div class="head">${dot(light)}<h3>${esc(title)}${small ? `<small>${esc(small)}</small>` : ""}</h3></div>${body}${tools ? `<div class="tools">${tools}</div>` : ""}</article>`;
const chip = (t, l = "") => `<span class="chip ${l}">${esc(t)}</span>`;
const section = (t, inner, empty = "Nothing here.") => `<h2 class="sec">${esc(t)}</h2>${inner ? `<div class="grid">${inner}</div>` : `<p class="empty">${esc(empty)}</p>`}`;
const pageNote = (v) => (v.reasons.length ? `<div class="panel card ${v.light}" style="margin-bottom:12px"><div class="head">${dot(v.light)}<h3>This page</h3></div>${reasons(v)}</div>` : "");

const draw = {
  releases(s) {
    const r = s.releases;
    const top = pageNote(r.verdict);
    const addons = r.addons.map((a) =>
      card(`rel:${a.name}`, a.verdict.light, a.name, a.tag || "no tag", `<p class="said">${esc(a.said)}</p><div class="chips">${chip(`${a.ships} ship${a.ships === 1 ? "" : "s"} since ${a.tag || "the start"}`)}${chip(LIGHT[a.verdict.light], a.verdict.light)}</div>${reasons(a.verdict)}`, copy(a.prompt, "Copy release prompt")),
    ).join("");
    const repos = r.repos.map((p) => {
      const chips = [p.ahead ? chip(`${p.ahead} unpushed`, "amber") : "", p.behind ? chip(`${p.behind} behind`, "amber") : "", p.dirty ? chip(`${p.dirty} uncommitted`) : "", p.ci ? chip(`CI ${p.ci}`, p.ci === "success" ? "green" : "red") : "", ...p.cards.map((c) => chip(`card ${c.id} (${c.status})`))].join("");
      return card(`repo:${p.name}`, p.verdict.light, p.name, p.head.split(" ")[0], `${chips ? `<div class="chips">${chips}</div>` : ""}${reasons(p.verdict)}`, copy(p.prompt, "Copy push prompt"));
    }).join("");
    return `${top}${section("Addons before a release", addons, "preflight has not answered yet.")}${section("Every repository", repos, "status has not answered yet.")}`;
  },
  data(s) {
    const d = s.data;
    const jobs = d.jobs.map((j) => card(`job:${j.repo}:${j.workflow}`, j.verdict.light, `${j.repo}`, j.label, `<p class="said">${esc(j.text)}</p>${reasons(j.verdict)}`, link(j.run?.url, "Open the run"))).join("");
    const prs = d.prs.map((p) => card(`pr:${p.repo}:${p.number}`, p.verdict.light, `${p.repo} #${p.number}`, p.kind, `<p class="said">${esc(p.title)}</p>${reasons(p.verdict)}`, `${copy(p.prompt)}${link(p.url, "Open the pull request")}`)).join("");
    const b = d.builds;
    return `${pageNote({ light: d.verdict.light, reasons: [...d.verdict.reasons.filter((x) => !d.builds.reasons.includes(x) && !d.prs.some((p) => p.verdict.reasons.includes(x)) && !d.jobs.some((q) => q.verdict.reasons.includes(x))), ...d.errors.map((e) => `${e.repo}: ${e.error}`)] })}${section("Open pull requests", prs, "None open.")}${section("The game's builds", card("builds", b.light, "Builds against the pins", "", b.reasons.length ? reasons(b) : `<p class="said">Classic and Forever are on the pinned builds.</p>`))}${section("The daily jobs", jobs, "No job has been read yet.")}`;
  },
  stores(s) {
    const items = s.stores.stores.map((x) => {
      const body = x.read ? `<p class="said">${esc(x.title)}</p><div class="chips">${chip("CurseForge " + x.curseforge.page)}${chip("Wago " + ("state" in x.wago ? x.wago.state : "not read"))}${chip("GitHub " + (x.github === "none" || x.github === "same" ? x.github : "differs"))}</div>` : "";
      return card(`store:${x.repo}`, x.verdict.light, x.repo, "", `${body}${reasons(x.verdict)}${outputs[x.repo] ? `<details data-open="out:${esc(x.repo)}" ${opened.has("out:" + x.repo) ? "open" : ""}><summary>The dry run</summary><pre class="out">${esc(outputs[x.repo])}</pre></details>` : ""}`, `${x.read ? `<button class="btn sm" type="button" data-act="store-dry" data-repo="${esc(x.repo)}" data-key="dry:${esc(x.repo)}">Dry run</button>` : ""}${copy(x.prompt, "Copy store prompt")}`);
    }).join("");
    return `${pageNote(s.stores.verdict.reasons.length ? s.stores.verdict : { light: "green", reasons: [] })}${section("Store pages against their files", items, "store.ts has not answered yet.")}`;
  },
  zips(s) {
    const z = s.zips;
    const items = z.zips.map((x) => card(`zip:${x.name}`, x.verdict.light, x.name, x.version || "", `<p class="said">${esc(x.file || "no zip in iCloud")}</p>${reasons(x.verdict)}`, copy(x.prompt, "Copy refresh prompt"))).join("");
    return `${pageNote(z.verdict.reasons.length ? z.verdict : { light: "grey", reasons: z.folderNote ? [z.folderNote] : [] })}${section("The test zips in iCloud", items, "status has not answered yet.")}`;
  },
  launch() {
    const cmd = "bun addon-kit/launch.ts";
    return `<h2 class="sec">Launch night</h2><article class="panel card grey"><div class="head"><h3>Started from Terminal, not from here</h3></div><p class="said">Launch night's page is its own program and keeps working as it is. Run this from the family folder in your own terminal (it reads the iCloud Drive root, which only your terminal may).</p><p><code>${cmd}</code></p><div class="tools">${copy(cmd, "Copy the command")}</div></article>`;
  },
};

function tabs(s) {
  const all = [...s.pages, { id: "launch", label: "Launch", light: "grey" }];
  $("tabs").innerHTML = all.map((p) => `<button class="tab" role="tab" type="button" data-act="tab" data-page="${p.id}" data-key="tab:${p.id}" aria-selected="${p.id === page}">${p.id === "launch" ? "" : dot(p.light)}${esc(p.label)}</button>`).join("");
}

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function render() {
  const s = state;
  if (!s) return;
  if (!page || (page !== "launch" && !s.pages.some((p) => p.id === page))) page = s.open;
  $("beacon").className = `beacon ${s.overall}`;
  $("oneline").textContent = s.overall === "green" ? "Everything is in order." : `Worst: ${s.pages.filter((p) => p.light === s.overall).map((p) => p.label).join(", ")} (${LIGHT[s.overall]}).`;
  $("quiet").hidden = !s.quiet;
  const oldest = Math.min(...Object.values(s.ages).map((a) => a.at));
  $("age").textContent = Object.keys(s.ages).length ? `read ${ago(oldest)}${s.busy.length ? `, reading ${s.busy.join(", ")}` : ""}` : "";
  const sig = JSON.stringify([s.pages, page, s.releases, s.data, s.stores, s.zips, outputs, [...opened]]);
  if (sig === drawn) return;
  drawn = sig;
  // (focus and scroll survive the redraw: the focused element is found again by its data-key)
  const keep = document.activeElement?.getAttribute?.("data-key");
  const y = window.scrollY;
  tabs(s);
  $("main").innerHTML = draw[page](s);
  window.scrollTo(0, y);
  if (keep) document.querySelector(`[data-key="${CSS.escape(keep)}"]`)?.focus({ preventScroll: true });
}

async function poll() {
  try {
    state = await call("/api/state");
    $("stale").hidden = true;
    render();
  } catch {
    $("stale").hidden = false;
  }
}

async function flash(btn, text) {
  const was = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = was; }, 1600);
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const act = b.dataset.act;
  if (act === "tab") {
    page = b.dataset.page;
    history.replaceState(null, "", `#${page}`);
    drawn = "";
    render();
  } else if (act === "copy") {
    try {
      await navigator.clipboard.writeText(b.dataset.text);
      flash(b, "Copied");
    } catch {
      flash(b, "Could not copy");
    }
  } else if (act === "store-dry") {
    b.disabled = true;
    const r = await call("/api/action", { name: "store-dry", repo: b.dataset.repo }).catch((err) => ({ out: String(err) }));
    outputs[b.dataset.repo] = r.out || r.error || "";
    opened.add(`out:${b.dataset.repo}`);
    drawn = "";
    render();
  }
});
document.addEventListener("toggle", (e) => {
  const k = e.target.dataset?.open;
  if (k) e.target.open ? opened.add(k) : opened.delete(k);
}, true);
$("refresh-all").addEventListener("click", async (e) => {
  e.target.disabled = true;
  await call("/api/refresh", { source: "all" }).catch(() => {});
  e.target.disabled = false;
  poll();
});

addEventListener("hashchange", () => { page = location.hash.slice(1) || null; drawn = ""; render(); });
poll();
setInterval(poll, 10000);
setInterval(() => state && render(), 30000);
