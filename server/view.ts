// The view the pages draw: the cells' answers run through the rules, one block
// per page, and the summary (the tray's colour, the page the window opens on).
import { staleCache, type Cell } from "./engine";
import { launchView, type Content } from "./launch/night";
import type { State } from "./launch/rules";
import * as rules from "./rules";
import { LAUNCH_END } from "./rules";
import type { Light, PageId, Verdict } from "./rules";

const SOURCES_OF: Record<PageId, string[]> = {
  launch: [],
  releases: ["preflight", "status", "board"],
  data: ["data-prs", "latest"],
  stores: ["stores"],
  zips: ["status", "zips"],
};

const data = <T>(cells: Record<string, Cell>, id: string) => cells[id]?.data as T | undefined;

/** A source that failed after it had answered keeps its old answer: a green on old data is not a green, so it is amber on the pages it feeds. One that never answered is grey where it matters. */
function staleness(cells: Record<string, Cell>, page: PageId, now: number): Verdict {
  const reasons: string[] = [];
  let light: Light = "green";
  for (const id of SOURCES_OF[page]) {
    const c = cells[id];
    if (c?.error && c.data !== undefined) {
      light = rules.worst(light, "amber");
      reasons.push(`${id} failed, showing its last answer: ${c.error}`);
    } else if (staleCache(c, now)) {
      light = rules.worst(light, "amber");
      reasons.push(`${id}: showing a cached reading older than its interval, reading again`);
    }
  }
  return { light, reasons };
}

const seal = (page: PageId, cells: Record<string, Cell>, v: Verdict, now: number): Verdict => {
  const s = staleness(cells, page, now);
  return { light: rules.worst(v.light, s.light), reasons: [...v.reasons, ...s.reasons] };
};

/** `night`: launch night's checklist and its saved ticks and notes, which the Launch page needs. Without it there is no Launch page (the tests of the other pages). */
export function view(cells: Record<string, Cell>, busy: string[], now = Date.now(), night?: { content: Content; state: State }) {
  const preflight = data<rules.Preflight[]>(cells, "preflight");
  const status = data<rules.Repo[]>(cells, "status");
  const board = data<rules.Card[]>(cells, "board") ?? [];
  const dataPrs = data<rules.DataPrs>(cells, "data-prs");
  const latest = data<rules.Latest>(cells, "latest");
  const stores = data<rules.Store[]>(cells, "stores");
  const folder = data<rules.Zip[]>(cells, "zips");

  const need = (id: string) => rules.unread(id, cells[id]?.error);

  // ── Releases
  const addons = (preflight ?? []).map(rules.release).map((a) => ({ ...a, prompt: a.verdict.light === "red" ? undefined : a.ships > 0 ? `Release ${a.name}: preflight says "${a.said}". Run the wow-releasing skill, and ask me for the go before the push.` : undefined }));
  const repos = (status ?? []).map((r) => rules.repoLine(r, board)).map((r) => ({ ...r, prompt: r.ahead > 0 ? `Push wave: ${r.name} has ${r.ahead} unpushed commit${r.ahead > 1 ? "s" : ""}${r.cards.length ? ` (card ${r.cards.map((c) => c.id).join(", ")})` : ""}. Follow wow-releasing, and ask me for the go.` : undefined }));
  const releasesV = !preflight || !status ? need(!preflight ? "preflight" : "status") : !data(cells, "board") ? need("board") : { light: rules.worst(...addons.map((a) => a.verdict.light), ...repos.map((r) => r.verdict.light)), reasons: [] };
  const releases = { verdict: seal("releases", cells, releasesV, now), addons, repos };

  // ── Data
  const d = rules.data(dataPrs, latest, now);
  const prPrompt = (p: rules.DataPr) => (p.kind === "players" ? `Read the Players facts pull request ${p.repo}#${p.number} line by line (wow-data-prs), then ask me for the go.` : `Handle the ${p.kind} pull request ${p.repo}#${p.number} (wow-data-prs): ${p.next}. Merge only on my go.`);
  const dataBlock = d ? { ...d, prs: d.prs.map((p) => ({ ...p, prompt: prPrompt(p) })), verdict: seal("data", cells, d.verdict, now) } : { verdict: seal("data", cells, need("data-prs"), now), jobs: [], prs: [], builds: rules.builds(latest), errors: [] };

  // ── Stores
  const lines = (stores ?? []).map((s) => ({ ...s, verdict: rules.store(s), prompt: s.read && s.due.length ? `Put up ${s.repo}'s store page: store.ts says ${s.due.join(", ")} would change. Show me the dry run, then ask for the go (wow-store-pages).` : undefined }));
  const storesV = stores ? { light: rules.worst(...lines.map((l) => l.verdict.light)), reasons: [] } : need("stores");
  const storesBlock = { verdict: seal("stores", cells, storesV, now), stores: lines };

  // ── Test zips
  const zipLines = (status ? rules.zips(status, folder) : []).map((z) => ({ ...z, prompt: z.verdict.light === "amber" || z.verdict.light === "red" ? `Refresh ${z.name}'s test zip in iCloud (bun run package, the zip alone, the older one to the Trash).` : undefined }));
  const zipsV = !status ? need("status") : !folder ? need("zips") : { light: rules.worst(...zipLines.map((z) => z.verdict.light)), reasons: [] };
  const folderNote = cells.zips?.error ? `the folder could not be listed: ${cells.zips.error}` : undefined;
  const zipsBlock = { verdict: seal("zips", cells, zipsV, now), zips: zipLines, folderNote };

  const launch = night ? launchView(night.content, cells, night.state, busy, now) : undefined;
  const lights: Partial<Record<PageId, Light>> = { releases: releases.verdict.light, data: dataBlock.verdict.light, stores: storesBlock.verdict.light, zips: zipsBlock.verdict.light };
  // (launch night's lights drive the tray only through its own night and the morning after: an open data pull request would turn it red for good once its check time has passed)
  const forTray: Partial<Record<PageId, Light>> = { ...lights };
  if (launch) {
    lights.launch = launch.overall;
    if (now < LAUNCH_END) forTray.launch = launch.overall;
  }
  return {
    now,
    quiet: rules.quiet(now),
    ...rules.summary(forTray),
    pages: rules.PAGES.filter((p) => lights[p.id]).map((p) => ({ ...p, light: lights[p.id] as Light })),
    launch,
    releases,
    data: dataBlock,
    stores: storesBlock,
    zips: zipsBlock,
    cards: board.filter((c) => c.status !== "done").map((c) => ({ id: c.id, title: c.title, status: c.status, repos: c.repos })),
    ages: Object.fromEntries(Object.entries(cells).map(([k, c]) => [k, { at: c.at, ms: c.ms, error: c.error, paused: c.paused, cached: !!c.cached && c.data !== undefined, stale: staleCache(c, now) }])),
    busy,
  };
}
