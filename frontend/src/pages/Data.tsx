import { ExternalLink } from "lucide-react";
import { DispatcherBar, FixSlot } from "@/components/FixButton";
import { NavLink } from "@/components/Row";
import { Dot, PageHeader, Panel } from "@/components/ui";
import { useApp, type Dict, type Light } from "@/lib/api";
import { ago } from "@/lib/format";
import { addonIds, nameOf, queue } from "@/lib/queue";

const RANK: Record<string, number> = { red: 0, amber: 1, grey: 2, green: 3 };
const KIND: Record<string, number> = { players: 0, pins: 1, "game-data": 2, other: 3 };

/** Data: the pull requests the daily jobs opened, then the jobs, then the game's builds against the pins. */
export function Data({ go }: { go: (id: string) => void }) {
  const { state, open } = useApp();
  const s = state!;
  const d = s.data;
  const ids = addonIds(s);
  const items = queue(s);
  const said = (id: string) => items.find((i) => i.id === id);
  const prs = [...(d.prs as Dict[])].sort((a, b) => KIND[a.kind] - KIND[b.kind] || RANK[a.verdict.light] - RANK[b.verdict.light]);
  const jobs = [...(d.jobs as Dict[])].sort((a, b) => RANK[a.verdict.light] - RANK[b.verdict.light]);
  // (launch night says Forever's build: it is said here too, so this panel never calls the builds fine over it)
  const forever = (s.launch?.build?.reasons ?? []) as string[];
  const builds = [...items.filter((i) => i.id.startsWith("build/") || i.id.startsWith("read/") || i.id.startsWith("err/")), ...forever.map((r, n) => ({ id: `forever/${n}`, light: (s.launch?.build?.light ?? "amber") as Light, who: "", what: r, fix: undefined as Dict | undefined }))];
  const who = (repo: string) =>
    ids.includes(repo) ? (
      <NavLink to={`addon:${repo}`} go={go} className="font-semibold">
        {nameOf(s, repo)}
      </NavLink>
    ) : (
      <b className="font-semibold">{repo}</b>
    );
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Data" intro="The game data the addons are built from is refreshed by daily jobs, which open pull requests when something changes." />
      <DispatcherBar fixes={[...prs.map((p) => p.fix), ...jobs.map((j) => j.fix)]} />
      <Panel title="Pull requests" note="A Players pull request holds strangers' facts. Read it before it is merged: it is never merged by itself.">
        {prs.length === 0 ? (
          <p className="mt-3 text-sm text-dim">{d.verdict.light === "grey" ? "Watchtower has not read them yet." : "No pull request is open."}</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
            {prs.map((p) => {
              const item = said(`pr/${p.repo}/${p.number}`);
              return (
                <li key={`${p.repo}#${p.number}`} className="flex items-start gap-3 py-2.5">
                  <Dot light={p.verdict.light} className="mt-[7px]" />
                  <p className="min-w-0 flex-1 text-parchment select-text">
                    {who(p.repo)} {item ? item.what : `has pull request #${p.number} (${p.title}). It will merge by itself when its checks pass.`}
                    {p.createdAt && <span className="ml-2 text-sm text-faint">Opened {ago(Date.parse(p.createdAt), s.now)}.</span>}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {/^https:\/\//.test(p.url ?? "") && (
                      <button type="button" className="rounded p-1 text-faint hover:text-parchment" aria-label="Open the pull request on GitHub" onClick={() => open(p.url)}>
                        <ExternalLink className="size-4" />
                      </button>
                    )}
                    <FixSlot id={`pr/${p.repo}/${p.number}`} prompt={p.fix ? p.prompt : undefined} fix={p.fix} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Daily jobs">
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-dim">Watchtower has not read them yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
            {jobs.map((j) => {
              const light = j.verdict.light as Light;
              return (
                <li key={`${j.repo}:${j.workflow}`} className="flex items-center gap-3 py-2">
                  <Dot light={light} />
                  <span className="min-w-0 flex-1 text-parchment">
                    {who(j.repo)} <span className="text-dim">{String(j.label).replace(/ \(.*\)/, "").toLowerCase()}</span>
                  </span>
                  <span className={`text-sm ${light === "red" ? "text-blood" : "text-dim"}`}>{j.text}</span>
                  {light !== "green" && /^https:\/\//.test(j.run?.url ?? "") && (
                    <button type="button" className="rounded p-1 text-faint hover:text-parchment" aria-label="Open the run on GitHub" onClick={() => open(j.run.url)}>
                      <ExternalLink className="size-4" />
                    </button>
                  )}
                  {light !== "green" && <FixSlot id={`job/${j.repo}/${j.workflow}`} fix={j.fix} />}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Game builds">
        <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
          {builds.length === 0 && (
            <li className="py-2 text-dim">
              <Dot light="green" className="mr-3" />
              Classic and Forever are on the builds the addons are pinned to.
            </li>
          )}
          {builds.map((i) => (
            <li key={i.id} className="flex items-start gap-3 py-2.5">
              <Dot light={i.light} className="mt-[7px]" />
              <p className="min-w-0 flex-1 text-parchment select-text">
                {i.who && <b className="font-semibold">{i.who} </b>}
                {i.what}
              </p>
              <FixSlot id={i.id} fix={i.fix} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
