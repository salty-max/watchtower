// What needs doing, in plain sentences, from /api/state. Each light that is not green becomes a sentence a person would say ("Goodwill is 1 commit behind origin. Pull it before a release."), with the addon's name as a link and, when a session could fix it, the server's fix for it.
// (no import from api.tsx: the server's tests typecheck this file without React)
type Light = "green" | "amber" | "red" | "grey";
type Dict = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type State = Dict;

/** One thing to do: who it is about (a link when it is an addon), what is true and what to do, and the fix a session could start. */
export type Item = {
  id: string;
  light: Light;
  /** The addon's id when the item is about one addon: its name links to the addon's page. */
  addon?: string;
  /** Who it is about, as shown: an addon's name, a repository, "These 8 addons". */
  who: string;
  /** The rest of the sentence. */
  what: string;
  /** The addons a shared item stands for. */
  addons?: string[];
  /** The repository to pull (`git pull --ff-only`) when that is all the item needs: a clean branch that is behind. A session is for thinking, not for this. */
  pull?: string;
  /** The server's fix preview, when a session could start one (server/fix.ts). */
  fix?: Dict;
  /** The hand-over prompt that goes with a fix. */
  prompt?: string;
  url?: string;
};

const ORDER: Record<Light, number> = { red: 0, amber: 1, grey: 2, green: 3 };
const SHARED_FROM = 3;
const NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const num = (n: number) => NUMBERS[n] ?? String(n);
const count = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The ids of the addons (the nine of launch night). A tool, such as wow-locker, is preflighted and listed among the repositories but is not one of them. */
export function addonIds(s: State): string[] {
  const L = s.launch as Dict | undefined;
  return L ? (L.addons as Dict[]).map((a) => a.id as string) : (s.releases.addons as Dict[]).map((a) => a.name as string);
}

/** An addon's name as the user knows it (Lorekeeper's Codex), a repository's as it is. */
export function nameOf(s: State, id: string): string {
  return ((s.launch?.addons as Dict[] | undefined)?.find((a) => a.id === id)?.name as string | undefined) ?? id;
}

/** What is wrong with a repository's git state, as a clause, and what to do about it. */
function gitSentence(r: Dict | undefined, text: string): string {
  if (!r) return `is not ready for a release: ${text.replace(/: release\.sh.*/, "")}.`;
  const parts: string[] = [];
  const todo: string[] = [];
  if (r.behind > 0) (parts.push(`is ${count(r.behind, "commit")} behind origin`), todo.push("Pull it before a release."));
  if (r.ahead > 0) (parts.push(`has ${count(r.ahead, "commit")} that ${r.ahead === 1 ? "is" : "are"} not pushed`), todo.push("Push " + (r.ahead === 1 ? "it" : "them") + " first."));
  if (r.dirty > 0) (parts.push(`has ${count(r.dirty, "uncommitted file")}`), todo.push("Commit or discard " + (r.dirty === 1 ? "it" : "them") + " first."));
  if (!parts.length) return `is not on a clean main branch. Fix that before a release.`;
  return `${parts.join(" and ")}. ${todo.join(" ")}`;
}

/** The kinds of thing most addons share, said once for them all and once for each. */
const SHARED: Record<string, { one: string; many: string }> = {
  "cold read": { one: "has text that changed since its last cold read.", many: "have text that changed since their last cold read." },
  review: { one: "has commits with no review yet.", many: "have commits with no review yet." },
  translations: { one: "has German and Spanish words that are out of date. Those languages are held back from the zips for now.", many: "have German and Spanish words that are out of date. Those languages are held back from the zips for now." },
  ingame: { one: "has not been tested in the game yet.", many: "have not been tested in the game yet." },
};

/** Preflight rows that the pull request, zip and store items already say. */
const DUPLICATES = new Set(["pull req.", "test zip", "live", "stores"]);

type Atom = Item & { kind?: string };

/** Every thing to do about one addon or repository, one by one (the addon page's list). The overview joins the shared ones. */
function atoms(s: State): Atom[] {
  const ids = new Set(addonIds(s));
  const out: Atom[] = [];
  const fixGiven = new Set<string>(); // (an addon's release fix sits on its first item only: one press starts one session)
  const once = (a: Dict) => (fixGiven.has(a.name) ? undefined : (fixGiven.add(a.name), a.fix));
  const sourceGiven = new Set<string>();
  const sourceFix = (page: string) => {
    const f = ((s.fixes ?? []) as Dict[]).find((x) => x.kind === "source" && x.page === page && !sourceGiven.has(x.key));
    if (f) sourceGiven.add(f.key);
    return f;
  };
  const repos = new Map<string, Dict>((s.releases.repos as Dict[]).map((r) => [r.name, r]));
  const subject = (name: string) => ({ who: nameOf(s, name), ...(ids.has(name) ? { addon: name } : {}) });
  const gitBlocked = new Set<string>();
  const ciBlocked = new Set<string>();
  const ciItem = new Map<string, Atom>();
  const redJob = (repo: string) => (s.data.jobs as Dict[]).some((j) => j.repo === repo && j.verdict.light === "red");

  // Releases: what preflight says about each addon
  for (const a of s.releases.addons as Dict[]) {
    for (const r of a.rows as Dict[]) {
      if (r.mark === "✗") {
        if (r.label === "git") gitBlocked.add(a.name);
        if (r.label === "CI") ciBlocked.add(a.name);
        if (DUPLICATES.has(r.label)) continue; // (the pull request, zip and store items say it)
        const what = r.label === "git" ? gitSentence(repos.get(a.name), r.text) : r.label === "CI" ? "has failing CI on its latest commit." : `has a problem that stops a release (${r.label}): ${r.text.replace(/\s+/g, " ")}`;
        const rp = repos.get(a.name);
        const pull = r.label === "git" && rp && rp.branch === "main" && rp.behind > 0 && rp.ahead === 0 && rp.dirty === 0 ? a.name : undefined;
        const item: Atom = { id: `rel/${a.name}/${r.label}`, light: "red", ...subject(a.name), what, ...(pull ? { pull } : { fix: once(a), prompt: a.prompt }) };
        if (r.label === "CI") ciItem.set(a.name, item);
        out.push(item);
      } else if (r.mark === "!") {
        const kind = r.label === "deDE" || r.label === "esES" ? "translations" : r.label;
        if (DUPLICATES.has(kind)) continue;
        if (kind === "game data" && redJob(a.name)) continue;
        if (out.some((o) => o.id === `rel/${a.name}/${kind}`)) continue; // (German and Spanish are one thing)
        const shared = SHARED[kind];
        const what = shared ? shared.one : kind === "CI" ? "has no CI run on its latest commit yet." : kind === "game data" ? "had a failed game data run." : `has something to check (${r.label}): ${r.text.replace(/\s+/g, " ")}`;
        out.push({ id: `rel/${a.name}/${kind}`, light: "amber", ...subject(a.name), what, ...(shared ? { kind } : {}), fix: once(a), prompt: a.prompt });
      }
    }
  }
  // Releases: the repositories (addons and tools)
  for (const r of s.releases.repos as Dict[]) {
    const reasons = r.verdict.reasons as string[];
    const sub = subject(r.name);
    const blocked = r.ahead > 0 && !gitBlocked.has(r.name) && (r.behind > 0 || r.dirty > 0 || r.verdict.light === "red" || r.verdict.light === "grey");
    if (blocked) {
      const why = [r.behind && `is ${count(r.behind, "commit")} behind origin`, r.dirty && `has ${count(r.dirty, "uncommitted file")}`].filter(Boolean).join(" and ");
      out.push({ id: `repo/${r.name}/blocked`, light: "red", ...sub, what: `has ${count(r.ahead, "commit")} not pushed${why ? ` but ${why}` : ""}, so it cannot be pushed as it is.`, fix: r.fix, prompt: r.prompt });
    }
    for (const why of reasons) {
      if (blocked && /behind origin/i.test(why)) continue; // (the blocked item says it)
      if (/game data failure/i.test(why) && redJob(r.name)) continue; // (the job's own item says it)
      if (ciBlocked.has(r.name) && /^CI\b/.test(why)) {
        // (preflight's CI item says it, and the CI fix is the repository line's: that item takes it)
        const item = ciItem.get(r.name);
        if (item && r.fix) Object.assign(item, { fix: r.fix, prompt: r.prompt ?? item.prompt });
        continue;
      }
      if (gitBlocked.has(r.name) && /behind origin/i.test(why)) continue; // (the git item says it)
      let what = why;
      let light: Light = r.verdict.light === "grey" ? "grey" : "amber";
      let m: RegExpMatchArray | null;
      if ((m = why.match(/^(\d+) behind origin$/))) what = `is ${count(+m[1], "commit")} behind origin. Pull ${+m[1] === 1 ? "it" : "them"} before pushing.`;
      else if ((m = why.match(/^(\w[\w ]*) is running$/))) what = `has a ${m[1]} run in progress.`;
      else if ((m = why.match(/^(\w[\w ]*) (failure|timed_out|action_required|startup_failure|stale|neutral)$/))) (what = `has a failed ${m[1]} run (${m[2].replace("_", " ")}).`, light = m[1] === "CI" ? "red" : "amber");
      else if ((m = why.match(/^#(\d+) (.*) is open$/))) what = `has pull request #${m[1]} open: ${m[2]}.`;
      else if (/gh gave nothing/.test(why)) what = "has CI and pull requests that Watchtower could not read.";
      else if (/git could not read it/.test(why)) what = "could not be read by git.";
      const pull = /behind origin/i.test(why) && r.branch === "main" && r.ahead === 0 && r.dirty === 0 ? r.name : undefined;
      out.push({ id: `repo/${r.name}/${why}`, light, ...sub, what, ...(pull ? { pull } : { fix: r.fix, prompt: r.prompt }) });
    }
  }
  // Data: the daily jobs and the pull requests they open
  for (const j of s.data.jobs as Dict[]) {
    if (j.verdict.light === "green") continue;
    const job = String(j.label).replace(/ \(.*\)/, "").toLowerCase();
    out.push({ id: `job/${j.repo}/${j.workflow}`, light: j.verdict.light, ...subject(j.repo), what: j.verdict.light === "red" ? `has a failed ${job} job today.` : `has a ${job} job that is not finished or not read yet (${j.text}).`, fix: j.fix, url: j.run?.url });
  }
  for (const p of s.data.prs as Dict[]) {
    if (p.verdict.light === "green") continue;
    const reason = String(p.verdict.reasons[0] ?? "").replace(`${p.repo} #${p.number} ${p.title}: `, "");
    const open = reason.match(/open for (\d+) hours/);
    const pr = `pull request #${p.number} (${p.title})`;
    const what =
      p.kind === "players" ? `has pull request #${p.number} with players' facts. Read it line by line before it is merged.`
      : p.verdict.light === "grey" ? `has ${pr} whose checks Watchtower could not read.`
      : /checks (failure|timed_out|cancelled|\w+)$/.test(reason) ? `has ${pr} with failing checks.`
      : open ? `has ${pr} that has been open for ${open[1]} hours. Merge it or find out why it is stuck.`
      : p.kind === "pins" || p.kind === "game-data" ? `has ${pr}. It merges by itself once its checks pass.`
      : `has ${pr}.`;
    out.push({ id: `pr/${p.repo}/${p.number}`, light: p.verdict.light, ...subject(p.repo), what, fix: p.fix, prompt: p.fix ? p.prompt : undefined, url: p.url });
  }
  const launchBuild = ((s.launch as Dict | undefined)?.build?.reasons ?? []).length > 0; // (launch night says Forever's: Classic's is only said here)
  for (const why of s.data.builds.reasons as string[]) {
    if (launchBuild && /^forever/i.test(why)) continue;
    const m = why.match(/^(\w+): (\S+) is pinned, wago\.tools has (\S+)/);
    if (/has not answered yet|^wago\.tools/.test(why)) continue; // (the reading's own item says it)
    const e = why.match(/^(\w+): (.+)$/);
    out.push({ id: `build/${why}`, light: s.data.builds.light, who: m ? cap(m[1]) : e ? cap(e[1]) : "", what: m ? `has a newer build, ${m[3]}. The pinned build is ${m[2]}.` : e ? `has a build Watchtower could not read: ${e[2]}.` : why });
  }
  ((s.data.errors ?? []) as Dict[]).forEach((e, n) => out.push({ id: `err/${n}/${e.repo}`, light: "grey", ...subject(e.repo), what: `could not be read: ${e.error}`, fix: sourceFix("data") }));
  // Stores and zips
  for (const x of s.stores.stores as Dict[]) {
    if (x.verdict.light === "green" || x.why === "not-on-curseforge") continue;
    if (!x.read) {
      out.push({ id: `store/${x.repo}/unread`, light: "grey", ...subject(x.repo), what: `has store pages that Watchtower could not read: ${x.error ?? "no answer"}.` });
      continue;
    }
    const names: Record<string, string> = { "CurseForge's page": "a CurseForge page", "CurseForge's summary": "a CurseForge summary", "Wago's page and summary": "a Wago page", "GitHub's description": "a GitHub description" };
    for (const d of x.due as string[]) out.push({ id: `store/${x.repo}/${d}`, light: "amber", ...subject(x.repo), what: `has ${names[d] ?? d} that is out of date with CURSEFORGE.md. Update it when you are ready.` });
    if (x.semicolon) out.push({ id: `store/${x.repo}/semicolon`, light: "amber", ...subject(x.repo), what: "has a semicolon in its store page. Take it out." });
    if (!("state" in x.wago)) out.push({ id: `store/${x.repo}/wago`, light: "grey", ...subject(x.repo), what: `has a Wago page that Watchtower could not read: ${x.wago.notRead}.` });
  }
  for (const x of s.zips.zips as Dict[]) {
    if (x.verdict.light === "green") continue;
    const two = (x.extra as string[] | undefined)?.length || /second zip/i.test(x.verdict.reasons.join(" "));
    if (!x.file) out.push({ id: `zip/${x.name}`, light: "red", ...subject(x.name), what: "has no test zip in iCloud. Run bun run package." });
    else if (x.verdict.light === "grey") out.push({ id: `zip/${x.name}`, light: "grey", ...subject(x.name), what: "has a test zip that Watchtower cannot compare with the latest commit." });
    else if (x.verdict.reasons.some((r: string) => /older than HEAD/i.test(r))) out.push({ id: `zip/${x.name}`, light: "amber", ...subject(x.name), what: "has a test zip older than its latest commit. Run bun run package." });
    if (two) out.push({ id: `zip/${x.name}/two`, light: "amber", ...subject(x.name), what: `has two test zips${(x.extra as string[] | undefined)?.length ? ` (${(x.extra as string[]).join(", ")})` : ""}. Move the older one to the Trash.` });
  }
  // Readings that failed or are old: a green on old data is not a green
  const THING: Record<string, string> = { preflight: "preflight's checks", status: "the repositories' state", board: "the board", "data-prs": "the daily jobs and pull requests", latest: "the game's builds", stores: "the store pages", zips: "the test zip folder" };
  for (const id of ["releases", "data", "stores", "zips"] as const) {
    const v = (s as Dict)[id].verdict as Dict;
    for (const why of v.reasons as string[]) {
      let m: RegExpMatchArray | null;
      let src: string, what: string, light: Light = "amber";
      if ((m = why.match(/^(\S+) failed, showing its last answer/))) (src = m[1], what = `could not read ${THING[src] ?? src} just now, so you are seeing the last answer.`);
      else if ((m = why.match(/^(\S+): showing a cached reading/))) (src = m[1], what = `is still showing an old reading of ${THING[src] ?? src} while it reads again.`);
      else if ((m = why.match(/^(\S+) has not answered yet/))) (src = m[1], what = `has not read ${THING[src] ?? src} yet.`, light = "grey");
      else if (v.light === "grey" && (m = why.match(/^(\S+): (.+)$/))) (src = m[1], what = `could not read ${THING[src] ?? src}: ${m[2]}.`, light = "grey");
      else continue;
      if (!out.some((o) => o.id === `read/${src}`)) out.push({ id: `read/${src}`, light, who: "Watchtower", what, fix: sourceFix(id) });
    }
  }
  // Launch night's own lights (its data chain is the Data page's job, said there)
  const L = s.launch as Dict | undefined;
  if (L) {
    for (const k of ["build", "infra", "sources"] as const)
      for (const why of (L[k].reasons ?? []) as string[]) out.push({ id: `launch/${k}/${why}`, light: L[k].light, who: "", what: why }); // (the server writes these as whole sentences)
    // (an in-game check cannot be run before Forever is out: until launch time it is not a thing to do)
    if (L.open) for (const a of L.addons as Dict[]) if (a.inGame.light === "grey") out.push({ id: `launch/ingame/${a.id}`, light: "amber", ...subject(a.id), what: SHARED.ingame.one, kind: "ingame" });
  }
  // (a hand-over prompt is the fallback of a fix a session could start: with no fix there is nothing to copy)
  for (const o of out) if (!o.fix) o.prompt = undefined;
  return out;
}

/** Everything that is not green, red first. A thing most addons share is one item with their names, so the rare thing stands out. */
export function queue(s: State): Item[] {
  const ids = addonIds(s);
  const all = atoms(s);
  const out: Atom[] = [];
  const groups = new Map<string, Atom[]>();
  for (const a of all) {
    if (a.kind && a.addon) groups.set(a.kind, [...(groups.get(a.kind) ?? []), a]);
    else out.push(a);
  }
  for (const [kind, list] of groups) {
    if (list.length >= SHARED_FROM) {
      const everyone = list.length === ids.length;
      out.push({ id: `shared/${kind}`, light: "amber", who: everyone ? `All ${num(list.length)} addons` : `${cap(num(list.length))} of the ${num(ids.length)} addons`, what: SHARED[kind].many, addons: list.map((a) => a.addon as string) });
    } else out.push(...list);
  }
  return out.map((o, i) => ({ o, i })).sort((a, b) => ORDER[a.o.light] - ORDER[b.o.light] || a.i - b.i).map((x) => x.o);
}

/** Everything to do about one addon, one by one. */
export function itemsFor(s: State, id: string): Item[] {
  return atoms(s).filter((a) => a.addon === id).sort((a, b) => ORDER[a.light] - ORDER[b.light]);
}

/** Repositories with commits not pushed yet, or files not committed: what waits on this computer. */
export function waitingToPush(s: State): { name: string; who: string; addon?: boolean; ahead: number; dirty: number; blocked: boolean; cards: string[]; prompt?: string; fix?: Dict }[] {
  const ids = addonIds(s);
  return (s.releases.repos as Dict[])
    .filter((r) => r.ahead > 0 || r.dirty > 0)
    .map((r) => ({ name: r.name, who: nameOf(s, r.name), addon: ids.includes(r.name), ahead: r.ahead, dirty: r.dirty, blocked: r.ahead > 0 && (r.behind > 0 || r.dirty > 0 || r.verdict.light === "red" || r.verdict.light === "grey"), cards: (r.cards as Dict[]).map((c) => c.title as string), prompt: r.prompt, fix: r.fix }));
}

/** The worst light among the addons' own (their release readiness): the Addons page's dot. */
export function addonsLight(s: State): Light {
  const ids = addonIds(s);
  const lights = (s.releases.addons as Dict[]).filter((a) => ids.includes(a.name)).map((a) => a.verdict.light as Light);
  return (["red", "amber", "grey", "green"] as Light[]).find((l) => lights.includes(l)) ?? "grey";
}

/** What the quiet line is made of. */
export function quiet(s: State) {
  const n = (rows: Dict[] | undefined) => (rows ?? []).filter((r) => r.verdict.light === "green").length;
  return { stores: n(s.stores.stores), storesOf: s.stores.stores.length, zips: n(s.zips.zips), zipsOf: s.zips.zips.length, jobs: n(s.data.jobs), jobsOf: s.data.jobs.length };
}
