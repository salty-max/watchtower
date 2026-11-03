import { ExternalLink } from "lucide-react";
import { DispatcherBar, FixSlot } from "@/components/FixButton";
import { Dot, PageNote } from "@/components/ui";
import { useApp, type Dict } from "@/lib/api";
import { ago } from "@/lib/format";

const KIND_ORDER: Record<string, number> = { players: 0, pins: 1, "game-data": 2, other: 3 };
const KIND_NAME: Record<string, string> = { players: "Players", pins: "Pins", "game-data": "Game data", other: "Other" };
const RANK: Record<string, number> = { red: 0, amber: 1, grey: 2, green: 3 };

/** A reason in the rules' words begins with the pull request's own name and title, which the row already shows. */
const own = (p: Dict) => (p.verdict.reasons as string[]).map((r) => r.replace(`${p.repo} #${p.number} ${p.title}: `, "")).join(" · ");

/** Data: the pull requests the daily jobs opened as a review queue, then the jobs themselves, then the game's builds against the pins. */
export function Data() {
  const { state, open } = useApp();
  const d = state!.data;
  const prs = [...(d.prs as Dict[])].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || RANK[a.verdict.light] - RANK[b.verdict.light] || a.number - b.number);
  const jobs = [...(d.jobs as Dict[])].sort((a, b) => RANK[a.verdict.light] - RANK[b.verdict.light]);
  const b = d.builds;
  // (what the rows below already say is not said twice on top)
  const said = [...b.reasons, ...prs.flatMap((p) => p.verdict.reasons), ...jobs.flatMap((j) => j.verdict.reasons)];
  const top = { light: d.verdict.light, reasons: (d.verdict.reasons as string[]).filter((x) => !said.includes(x)) };
  const loud = jobs.filter((j) => j.verdict.light !== "green");
  const quiet = jobs.filter((j) => j.verdict.light === "green");
  return (
    <div>
      <h1 className="title text-[26px] leading-tight text-parchment">Data</h1>
      <p className="mt-1.5 text-dim">The pull requests the daily jobs opened, and the jobs. A Players pull request is strangers' data: read before merging, never merged by itself.</p>
      <DispatcherBar page="data" />
      <PageNote v={top} />

      <section className="mt-7" aria-label="Review queue">
        <h2 className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
          Review queue <span className="ml-1 font-mono font-normal">{prs.length}</span>
        </h2>
        {prs.length === 0 ? (
          <p className="text-[13px] text-faint">{d.verdict.light === "grey" ? "Not read yet." : "No pull request is open."}</p>
        ) : (
          <ul className="border-b border-edge">
            {prs.map((p) => (
              <li key={`${p.repo}#${p.number}`} data-row={`pr/${p.repo}/${p.number}`} className="grid grid-cols-[1.25rem_5.5rem_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-edge py-2.5">
                <Dot light={p.verdict.light} className="mt-[3px]" />
                <span className={`pt-px text-[11px] font-semibold tracking-[0.1em] uppercase ${p.kind === "players" ? "text-amber" : "text-faint"}`}>{KIND_NAME[p.kind] ?? p.kind}</span>
                <div className="min-w-0">
                  <p className="text-parchment select-text">
                    <b className="font-semibold">{p.repo}</b> <span className="font-mono text-xs text-faint">#{p.number}</span> <span className="text-dim">{p.title}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-dim select-text">
                    {p.kind === "players" ? "Read it line by line against the databases before the go. " : ""}
                    {own(p) || p.next}
                    {p.createdAt && <span className="ml-2 font-mono text-xs text-faint">opened {ago(Date.parse(p.createdAt), state!.now)}</span>}
                  </p>
                  <Diff p={p} />
                </div>
                <div className="flex items-center gap-2">
                  {/^https:\/\//.test(p.url ?? "") && (
                    <button type="button" className="rounded p-1 text-faint hover:text-parchment" aria-label="Open the pull request" onClick={() => open(p.url)}>
                      <ExternalLink className="size-3.5" />
                    </button>
                  )}
                  {p.verdict.light !== "green" && <FixSlot id={`pr/${p.repo}/${p.number}`} prompt={p.prompt} fix={p.fix} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-9" aria-label="Daily jobs">
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
          Daily jobs <span className="ml-1 font-mono font-normal">{jobs.length}</span>
        </h2>
        {jobs.length === 0 ? (
          <p className="text-[13px] text-dim">Not read yet.</p>
        ) : (
          <>
            {loud.length > 0 && (
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {loud.map((j) => (
                  <li key={`${j.repo}:${j.workflow}`} data-row={`job/${j.repo}/${j.workflow}`} className={`border-l-2 pl-3 ${j.verdict.light === "red" ? "border-blood" : "border-amber"}`}>
                    <p className="flex items-center gap-2">
                      <Dot light={j.verdict.light} />
                      <b className="font-semibold text-parchment">{j.repo}</b>
                      <span className="text-xs text-faint">{j.label}</span>
                    </p>
                    <p className={`mt-0.5 pl-[19px] text-[13px] select-text ${j.verdict.light === "red" ? "text-blood" : "text-dim"}`}>{j.text}</p>
                    <p className="mt-1.5 flex items-center gap-2 pl-[19px]">
                      {/^https:\/\//.test(j.run?.url ?? "") && (
                        <button type="button" className="rounded px-1 py-0.5 font-mono text-xs text-faint hover:text-parchment" onClick={() => open(j.run.url)}>
                          the run →
                        </button>
                      )}
                      <FixSlot id={`job/${j.repo}/${j.workflow}`} fix={j.fix} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {quiet.length > 0 && (
              <ul className={`grid grid-cols-1 gap-x-6 text-[13px] sm:grid-cols-2 ${loud.length ? "mt-4" : ""}`}>
                {quiet.map((j) => (
                  <li key={`${j.repo}:${j.workflow}`} data-row={`job/${j.repo}/${j.workflow}`} className="flex items-center gap-2 border-t border-edge py-1.5">
                    <Dot light="green" />
                    <span className="text-dim">{j.repo}</span>
                    <span className="text-xs text-faint">{j.label}</span>
                    <span className="ml-auto font-mono text-xs text-faint">{j.text}</span>
                    {/^https:\/\//.test(j.run?.url ?? "") && (
                      <button type="button" className="rounded p-0.5 text-faint hover:text-parchment" aria-label={`Open the ${j.repo} run`} onClick={() => open(j.run.url)}>
                        <ExternalLink className="size-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <p className="mt-9 flex items-start gap-2.5 border-t border-edge pt-3.5 text-[13px]">
        <Dot light={b.light} className="mt-1" />
        <span className={b.light === "green" ? "text-faint" : "text-dim select-text"}>{b.reasons.length ? b.reasons.join(" · ") : "Classic and Forever are on the pinned builds."}</span>
      </p>
      {(d.errors as Dict[]).map((e, n) => (
        <p key={n} className="mt-2 flex items-start gap-2.5 text-[13px] text-dim select-text">
          <Dot light="grey" className="mt-1" />
          {e.repo}: {e.error}
        </p>
      ))}
    </div>
  );
}

/** The diff's shape (the share added and removed, the counts beside it), when the tool says it (additions, deletions, changed files: data-prs.ts does not yet, so it is drawn only if present). */
function Diff({ p }: { p: Dict }) {
  const a = Number(p.additions), r = Number(p.deletions);
  if (!Number.isFinite(a) || !Number.isFinite(r) || a + r === 0) return null;
  return (
    <p className="mt-1.5 flex items-center gap-2 font-mono text-xs text-faint" aria-label={`${a} added, ${r} removed${p.changedFiles ? `, ${p.changedFiles} files` : ""}`}>
      <span className="text-ok">+{a}</span>
      <span aria-hidden className="flex h-1.5 w-32 overflow-hidden rounded-sm bg-stone-3">
        <span className="bg-ok/70" style={{ width: `${(a / (a + r)) * 100}%` }} />
        <span className="bg-blood/70" style={{ width: `${(r / (a + r)) * 100}%` }} />
      </span>
      <span className="text-blood">−{r}</span>
      {p.changedFiles ? <span>{p.changedFiles} files</span> : null}
    </p>
  );
}
