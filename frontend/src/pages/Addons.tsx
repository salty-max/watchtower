import { FixButton, type Fix } from "@/components/FixButton";
import { DispatcherBar } from "@/components/FixButton";
import { NavLink, Rows } from "@/components/Row";
import { Dot } from "@/components/ui";
import { useApp, type Dict, type Light } from "@/lib/api";
import { ago, WORD } from "@/lib/format";
import { addonIds, queue } from "@/lib/queue";

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">{children}</h2>;
const tone = (l: Light) => ({ green: "text-ok", amber: "text-amber", red: "text-blood", grey: "text-faint" })[l];

/** Addons: the nine, one line each, every name a way to its page. (A tool such as wow-locker is not one of them.) */
export function Addons({ go }: { go: (id: string) => void }) {
  const s = useApp().state!;
  const ids = addonIds(s);
  const items = queue(s);
  const rows = ids.map((id) => {
    const la = (s.launch?.addons as Dict[] | undefined)?.find((a) => a.id === id);
    const rel = (s.releases.addons as Dict[]).find((a) => a.name === id);
    const repo = (s.releases.repos as Dict[]).find((r) => r.name === id);
    const own = items.filter((i) => i.where === id || i.names?.includes(id));
    return { id, la, rel, repo, own };
  });
  return (
    <div>
      <h1 className="title text-[26px] leading-tight text-parchment">Addons</h1>
      <p className="mt-1.5 text-dim">The {ids.length} of launch night. Open one to see everything about it in one place.</p>
      <section className="mt-7" aria-label="The addons">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
              <th className="pb-2 font-semibold">Addon</th>
              <th className="pb-2 font-semibold">Release</th>
              <th className="px-3 pb-2 font-semibold">Version</th>
              <th className="px-3 pb-2 text-right font-semibold">Ships</th>
              <th className="px-3 pb-2 text-right font-semibold">Ahead</th>
              <th className="px-3 pb-2 font-semibold">In game</th>
              <th className="pb-2 text-right font-semibold">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, la, rel, repo, own }) => {
              const done = la ? la.checks.filter((c: Dict) => c.tick === "ok").length : 0;
              return (
                <tr key={id} data-row={`addon/${id}`} className="border-t border-edge">
                  <td className="py-2 pr-3">
                    <Dot light={rel?.verdict.light ?? la?.light ?? "grey"} className="mr-2" />
                    <NavLink to={`addon:${id}`} go={go} className="font-semibold text-parchment">
                      {la?.name ?? id}
                    </NavLink>
                    {la?.slash && <span className="ml-2 font-mono text-xs text-faint">{la.slash}</span>}
                  </td>
                  <td className={`pr-3 ${rel ? tone(rel.verdict.light) : "text-faint"}`}>{rel ? WORD[rel.verdict.light as Light] : "not read"}</td>
                  <td className="px-3 font-mono text-xs text-faint">{rel?.tag || la?.tag || ""}</td>
                  <td className="px-3 text-right font-mono text-xs text-faint">{rel?.ships || "·"}</td>
                  <td className={`px-3 text-right font-mono text-xs ${repo?.ahead ? "text-amber" : "text-faint"}`}>{repo?.ahead || "·"}</td>
                  <td className={`px-3 text-xs ${la?.inGame.light === "red" ? "text-blood" : "text-faint"}`}>{la ? (la.inGame.light === "grey" ? "not tested" : la.inGame.light === "red" ? "broken" : `${done}/${la.checks.length} ok`) : ""}</td>
                  <td className="text-right text-xs text-faint">{own.length ? `${own.length} to look at` : "nothing"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** One addon in one place: what needs the user, then the release checks, the repository, the data jobs, the store pages, the test zip, launch night's checks and notes, and any fix. */
export function AddonPage({ id, go }: { id: string; go: (id: string) => void }) {
  const { state } = useApp();
  const s = state!;
  const ids = addonIds(s);
  const la = (s.launch?.addons as Dict[] | undefined)?.find((a) => a.id === id);
  const rel = (s.releases.addons as Dict[]).find((a) => a.name === id);
  const repo = (s.releases.repos as Dict[]).find((r) => r.name === id);
  const jobs = (s.data.jobs as Dict[]).filter((j) => j.repo === id);
  const prs = (s.data.prs as Dict[]).filter((p) => p.repo === id);
  const store = (s.stores.stores as Dict[]).find((x) => x.repo === id);
  const zip = (s.zips.zips as Dict[]).find((z) => z.name === id);
  const items = queue(s).filter((i) => i.where === id || i.where.startsWith(`${id} #`) || i.names?.includes(id));
  const notes = ((s.launch?.notes as Dict[] | undefined) ?? []).filter((n) => n.addon === id);
  const onRows = new Set(items.map((i) => (i.fix as Fix | undefined)?.key));
  // (a fix already offered on one of the rows above is not offered twice)
  const fixes = ((s.fixes ?? []) as unknown as Fix[]).filter((f) => f.repo === id && !onRows.has(f.key));
  const light: Light = rel?.verdict.light ?? la?.light ?? "grey";
  const done = la ? la.checks.filter((c: Dict) => c.tick === "ok").length : 0;
  return (
    <div>
      <p className="text-xs text-faint">
        <NavLink to="addons" go={go} className="hover:text-parchment">
          Addons
        </NavLink>
      </p>
      <h1 className="title mt-1 flex flex-wrap items-baseline gap-x-3 text-[26px] leading-tight text-parchment">
        {la?.name ?? id}
        {la?.slash && <span className="font-mono text-sm font-normal text-faint">{la.slash}</span>}
        {(rel?.tag || la?.tag) && <span className="font-mono text-sm font-normal text-faint">{rel?.tag || la?.tag}</span>}
      </h1>
      <p className="mt-1.5 flex items-center gap-2 text-dim">
        <Dot light={light} />
        <span className={tone(light)}>{WORD[light]}</span>
        {rel?.said && <span>{rel.said}</span>}
      </p>
      <DispatcherBar fixes={items.map((i) => i.fix)} />

      <section className="mt-7" aria-label="Needs you">
        <H2>Needs you</H2>
        {items.length ? <Rows items={items} go={go} addons={ids} here={`addon:${id}`} /> : <p className="text-[13px] text-faint">Nothing needs you for {la?.name ?? id}.</p>}
      </section>

      <div className="mt-9 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
        <section aria-label="Release checks">
          <H2>Release checks</H2>
          {rel?.rows.length ? (
            <ul className="text-[13px]">
              {(rel.rows as Dict[]).map((r) => (
                <li key={`${r.label}/${r.text}`} className="flex gap-2 border-t border-edge py-1.5">
                  <Dot light={r.mark === "✗" ? "red" : "amber"} className="mt-1" />
                  <span className="min-w-0 select-text">
                    <span className="mr-2 font-mono text-xs text-faint">{r.label}</span>
                    {r.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-faint">{rel ? "preflight has nothing to say." : "preflight has not answered yet."}</p>
          )}
          {rel && <p className="mt-2 text-xs text-faint">{rel.ships} commit{rel.ships === 1 ? "" : "s"} ship since {rel.tag || "the start"}.</p>}
        </section>

        <section aria-label="Repository">
          <H2>Repository</H2>
          {repo ? (
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-[13px]">
              <dt className="text-faint">HEAD</dt>
              <dd className="font-mono text-xs select-text">{String(repo.head)}</dd>
              <dt className="text-faint">Unpushed</dt>
              <dd className={repo.ahead ? "text-amber" : "text-dim"}>{repo.ahead || "none"}</dd>
              <dt className="text-faint">Behind</dt>
              <dd className={repo.behind ? "text-amber" : "text-dim"}>{repo.behind || "none"}</dd>
              <dt className="text-faint">Uncommitted</dt>
              <dd className="text-dim">{repo.dirty || "none"}</dd>
              <dt className="text-faint">Last CI</dt>
              <dd className={repo.ci && repo.ci !== "success" ? "text-blood" : "text-dim"}>{repo.ci ?? "none"}{repo.lastRun?.at ? `, ${ago(Date.parse(repo.lastRun.at), s.now)}` : ""}</dd>
              {repo.cards.length > 0 && (
                <>
                  <dt className="text-faint">Cards</dt>
                  <dd className="font-mono text-xs select-text">{(repo.cards as Dict[]).map((c) => `${c.id} (${c.status})`).join(", ")}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-[13px] text-faint">status has not answered yet.</p>
          )}
        </section>

        <section aria-label="Data">
          <H2>Data</H2>
          {jobs.length + prs.length === 0 ? (
            <p className="text-[13px] text-faint">No daily job or pull request for this addon.</p>
          ) : (
            <ul className="text-[13px]">
              {jobs.map((j) => (
                <li key={j.workflow} className="flex items-center gap-2 border-t border-edge py-1.5">
                  <Dot light={j.verdict.light} />
                  <span className="text-dim">{j.label}</span>
                  <span className={`ml-auto font-mono text-xs ${j.verdict.light === "red" ? "text-blood" : "text-faint"}`}>{j.text}</span>
                </li>
              ))}
              {prs.map((p) => (
                <li key={p.number} className="flex items-center gap-2 border-t border-edge py-1.5">
                  <Dot light={p.verdict.light} />
                  <span className="text-dim select-text">#{p.number} {p.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Store pages and test zip">
          <H2>Store pages and test zip</H2>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-[13px]">
            {store?.read ? (
              <>
                <dt className="text-faint">CurseForge</dt>
                <dd className="text-dim">{store.due.includes("CurseForge's page") ? "page would change" : store.due.includes("CurseForge's summary") ? "summary would change" : "matches its file"}</dd>
                <dt className="text-faint">Wago</dt>
                <dd className="text-dim">{"state" in store.wago ? (store.due.includes("Wago's page and summary") ? "would change" : "matches its file") : "not read"}</dd>
                <dt className="text-faint">GitHub</dt>
                <dd className="text-dim">{store.github === "none" ? "no note in the file" : store.due.includes("GitHub's description") ? "would change" : "matches its file"}</dd>
              </>
            ) : (
              <>
                <dt className="text-faint">Stores</dt>
                <dd className="text-dim">{store ? (store.why === "not-on-curseforge" ? "not on CurseForge yet" : "not read") : "not read yet"}</dd>
              </>
            )}
            <dt className="text-faint">Test zip</dt>
            <dd className={`font-mono text-xs select-text ${zip?.file ? "text-dim" : "text-blood"}`}>{zip ? zip.file || "no zip in iCloud" : "not read yet"}</dd>
            {zip && zip.verdict.reasons.length > 0 && (
              <>
                <dt />
                <dd className="text-xs text-dim select-text">{zip.verdict.reasons.join(" · ")}</dd>
              </>
            )}
          </dl>
        </section>
      </div>

      <section className="mt-9" aria-label="Launch night">
        <H2>
          Launch night{" "}
          <NavLink to="launch" go={go} className="ml-2 font-normal tracking-normal normal-case hover:text-parchment">
            tick them there
          </NavLink>
        </H2>
        {la ? (
          <>
            <p className="mb-1 text-[13px] text-dim">
              In game: {la.inGame.light === "grey" ? "not tested" : la.inGame.light === "red" ? "broken" : `${done} of ${la.checks.length} ok`}
            </p>
            <ul className="text-[13px]">
              {(la.checks as Dict[]).map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 border-t border-edge py-1.5">
                  <span className="min-w-0 select-text">{c.look}</span>
                  <span className={`shrink-0 text-xs ${c.tick === "ok" ? "text-ok" : c.tick === "broken" ? "text-blood" : "text-faint"}`}>{c.tick === "ok" ? "ok" : c.tick === "broken" ? "broken" : "untested"}</span>
                </li>
              ))}
            </ul>
            {notes.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
                {notes.map((n) => (
                  <li key={n.id} className="border-l-2 border-edge pl-3 text-dim select-text">
                    <span className={`mr-2 text-xs ${n.severity === "blocker" ? "text-blood" : n.severity === "bug" ? "text-amber" : "text-faint"}`}>{n.severity}</span>
                    {n.text}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-[13px] text-faint">Not one of launch night's addons.</p>
        )}
      </section>

      {fixes.length > 0 && (
        <section className="mt-9" aria-label="Fix sessions">
          <H2>Fix sessions</H2>
          <ul className="text-[13px]">
            {fixes.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 border-t border-edge py-2">
                <span className="min-w-0 text-dim select-text">{f.title}</span>
                <FixButton fix={f} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
