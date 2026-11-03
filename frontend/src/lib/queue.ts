// (no import from api.tsx: the server's tests typecheck this file without React)
type Light = "green" | "amber" | "red" | "grey";
type Dict = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type State = Dict;

/** One row of the overview's queue: a light somewhere that needs the user, said once. */
export type Item = {
  id: string;
  light: Light;
  where: string;
  what: string;
  /** The addons or repositories a shared row stands for. */
  names?: string[];
  /** The page it lives on (the sidebar's ids). */
  page: string;
  /** The server's fix preview for the row, when the light is one a session can fix (server/fix.ts). */
  fix?: Dict;
  prompt?: string;
  url?: string;
};

export const PAGE_NAME: Record<string, string> = { overview: "Overview", releases: "Push wave", data: "Data", stores: "Stores", zips: "Test zips", launch: "Launch night" };
const ORDER: Record<Light, number> = { red: 0, amber: 1, grey: 2, green: 3 };
const SHARED_FROM = 3;
const SAYS: Record<string, string> = {
  "cold read": "Cold read due: authored text changed since the last one",
  review: "No review recorded on HEAD",
  translations: "German and Spanish words stale (held out of the zips)",
};

const first = (s: string) => s.replace(/\s+/g, " ").replace(/: release\.sh wants.*/, "").replace(/\. A cold read of each.*/, "");

/** Everything that is not green, across the pages, red first. A reason most addons share is one row with their names, so the rare thing stands out. */
export function queue(s: State): Item[] {
  const out: Item[] = [];
  const add = (i: Item) => out.push(i);
  const addons: Dict[] = s.releases.addons ?? [];
  const gitBlocked = new Set<string>();

  // Releases: what is in the way of a release, per addon
  const sharedRows: Record<string, Dict[]> = {};
  for (const a of addons)
    for (const r of a.rows as Dict[]) {
      if (r.mark === "✗") {
        if (r.label === "git") gitBlocked.add(a.name);
        add({ id: `rel/${a.name}/${r.label}`, light: "red", where: a.name, what: `${first(r.text)}, so a release cannot run`, page: "releases", fix: a.fix, prompt: a.prompt });
      } else if (r.mark === "!") {
        const key = r.label === "deDE" || r.label === "esES" ? "translations" : r.label;
        if (key === "game data" && s.data.jobs.some((j: Dict) => j.repo === a.name && j.verdict.light === "red")) continue;
        (sharedRows[key] ??= []).push({ a, r });
      }
    }
  for (const [key, list] of Object.entries(sharedRows)) {
    const names = [...new Set(list.map((x) => x.a.name as string))];
    if (names.length >= SHARED_FROM && SAYS[key]) add({ id: `rel/*/${key}`, light: "amber", where: `${names.length} of ${addons.length} addons`, what: SAYS[key], names, page: "releases" });
    else for (const x of list) add({ id: `rel/${x.a.name}/${x.r.label}`, light: "amber", where: x.a.name, what: first(x.r.text), page: "releases", fix: x.a.fix, prompt: x.a.prompt });
  }
  // Releases: repositories
  for (const r of s.releases.repos as Dict[]) {
    if (r.verdict.light === "green") continue;
    for (const why of r.verdict.reasons as string[]) {
      if (gitBlocked.has(r.name) && /behind origin|unpushed|uncommitted|dirty/i.test(why)) continue; // (the git row says it, a red CI or a pull request is not said there)
      if (/game data failure/i.test(why) && s.data.jobs.some((j: Dict) => j.repo === r.name && j.verdict.light === "red")) continue; // (the job row says it)
      add({ id: `repo/${r.name}/${why}`, light: /\bCI\b.*(fail|red)|fail.*\bCI\b/i.test(why) ? "red" : r.verdict.light === "grey" ? "grey" : "amber", where: r.name, what: why, page: "releases", fix: r.fix, prompt: r.prompt });
    }
  }
  // Data
  for (const j of s.data.jobs as Dict[]) if (j.verdict.light !== "green") add({ id: `job/${j.repo}/${j.workflow}`, light: j.verdict.light, where: j.repo, what: `${j.label}: ${j.text}`, page: "data", fix: j.fix, url: j.run?.url });
  for (const p of s.data.prs as Dict[]) if (p.verdict.light !== "green") add({ id: `pr/${p.repo}/${p.number}`, light: p.verdict.light, where: `${p.repo} #${p.number}`, what: `${p.title}${p.verdict.reasons[0] ? `: ${p.verdict.reasons[0]}` : ""}`, page: "data", fix: p.fix, prompt: p.prompt, url: p.url });
  const launchBuild = ((s.launch as Dict | undefined)?.build?.reasons ?? []).length > 0; // (launch night says Forever's, with the pins job: Classic's is only said here)
  for (const why of s.data.builds.reasons as string[]) if (!(launchBuild && /^forever/i.test(why))) add({ id: `build/${why}`, light: s.data.builds.light, where: "Game builds", what: why, page: "data" });
  ((s.data.errors ?? []) as Dict[]).forEach((e, n) => add({ id: `err/${n}/${e.repo}`, light: "grey", where: e.repo, what: String(e.error), page: "data" }));
  // Stores and zips
  for (const x of s.stores.stores as Dict[]) if (x.verdict.light !== "green") for (const why of x.verdict.reasons as string[]) add({ id: `store/${x.repo}/${why}`, light: x.verdict.light, where: x.repo, what: why, page: "stores", prompt: x.prompt });
  for (const x of s.zips.zips as Dict[]) if (x.verdict.light !== "green") for (const why of x.verdict.reasons as string[]) add({ id: `zip/${x.name}/${why}`, light: x.verdict.light, where: x.name, what: why, page: "zips", prompt: x.prompt });
  // Readings that failed or are old: a green on old data is not a green
  for (const id of ["releases", "data", "stores", "zips"] as const) {
    const v = (s as Dict)[id].verdict as Dict;
    for (const why of v.reasons as string[]) if (/failed|cached|not read|has not answered|unread/i.test(why) && !out.some((o) => o.what === why)) add({ id: `read/${id}/${why}`, light: /not read|has not answered|unread/i.test(why) ? "grey" : "amber", where: PAGE_NAME[id], what: why, page: id });
  }
  // Launch night's own lights (its data chain is the Data page's job, said there)
  const L = s.launch as Dict | undefined;
  if (L) {
    for (const [k, name] of [["build", "Forever build"], ["infra", "Site and inbox"], ["sources", "Readings"]] as const)
      for (const why of (L[k].reasons ?? []) as string[]) add({ id: `launch/${k}/${why}`, light: L[k].light, where: name, what: why, page: "launch" });
    const untested = (L.addons as Dict[]).filter((a) => a.inGame.light === "grey");
    if (untested.length) add({ id: "launch/ingame", light: "amber", where: `${untested.length} of ${L.addons.length} addons`, what: "Not yet tried in the game for launch night", names: untested.map((a) => a.name as string), page: "launch" });
  }
  return out.map((o, i) => ({ o, i })).sort((a, b) => ORDER[a.o.light] - ORDER[b.o.light] || a.i - b.i).map((x) => x.o);
}

/** What the queue's silence is made of, for the quiet line. */
export function quiet(s: State) {
  const n = (rows: Dict[] | undefined) => (rows ?? []).filter((r) => r.verdict.light === "green").length;
  return { stores: n(s.stores.stores), storesOf: s.stores.stores.length, zips: n(s.zips.zips), zipsOf: s.zips.zips.length, repos: n(s.releases.repos), reposOf: s.releases.repos.length, jobs: n(s.data.jobs), jobsOf: s.data.jobs.length };
}
