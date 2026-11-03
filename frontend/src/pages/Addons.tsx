import { useState } from "react";
import { DispatcherBar } from "@/components/FixButton";
import { FixSlot } from "@/components/FixButton";
import { NavLink, Todo } from "@/components/Row";
import { Dot, Modal, PageHeader, Panel } from "@/components/ui";
import { call, useApp, type Dict, type Light } from "@/lib/api";
import { ago } from "@/lib/format";
import { addonIds, itemsFor, nameOf, num } from "@/lib/queue";

const Line = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <li className="flex items-baseline justify-between gap-6 py-2">
    <span className="text-dim">{label}</span>
    <span className="min-w-0 text-right text-parchment select-text">{children}</span>
  </li>
);

/** Addons: the nine, one line each, every name the way to its page. (A tool such as wow-locker is not one of them.) */
export function Addons({ go }: { go: (id: string) => void }) {
  const s = useApp().state!;
  const ids = addonIds(s);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Addons" intro={`The ${num(ids.length)} addons for launch night. Open one to see everything about it in one place.`} />
      <Panel title="The nine addons">
        <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
          {ids.map((id) => {
            const rel = (s.releases.addons as Dict[]).find((a) => a.name === id);
            const own = itemsFor(s, id);
            const light: Light = own.some((i) => i.light === "red") ? "red" : own.length ? "amber" : (rel?.verdict.light ?? "grey");
            return (
              <li key={id} data-row={`addon/${id}`} className="flex items-center gap-3 py-2.5">
                <Dot light={light} />
                <NavLink to={`addon:${id}`} go={go} className="font-semibold text-parchment">
                  {nameOf(s, id)}
                </NavLink>
                <span className="text-sm text-faint">{rel?.tag || ""}</span>
                <span className="ml-auto text-sm text-dim">{!rel ? "Not read yet" : own.length ? `${cap(num(own.length))} ${own.length === 1 ? "thing" : "things"} to do` : "Nothing to do"}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

/** One addon, and only that addon: what there is to do about it, then its release, store pages, game data and launch night checks. */
export function AddonPage({ id, go }: { id: string; go: (id: string) => void }) {
  const { state, toast } = useApp();
  const s = state!;
  const la = (s.launch?.addons as Dict[] | undefined)?.find((a) => a.id === id);
  const rel = (s.releases.addons as Dict[]).find((a) => a.name === id);
  const repo = (s.releases.repos as Dict[]).find((r) => r.name === id);
  const jobs = (s.data.jobs as Dict[]).filter((j) => j.repo === id);
  const prs = (s.data.prs as Dict[]).filter((p) => p.repo === id);
  const store = (s.stores.stores as Dict[]).find((x) => x.repo === id);
  const zip = (s.zips.zips as Dict[]).find((z) => z.name === id);
  const own = itemsFor(s, id);
  const notes = ((s.launch?.notes as Dict[] | undefined) ?? []).filter((n) => n.addon === id);
  const [dry, setDry] = useState<{ out?: string }>();
  const runDry = async () => {
    setDry({});
    try {
      const r = await call<Dict>("/api/action", { name: "store-dry", repo: id });
      setDry({ out: (r.ok ? "" : "The dry run did not finish cleanly.\n") + r.out });
    } catch (e) {
      setDry(undefined);
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };
  const done = la ? la.checks.filter((c: Dict) => c.tick === "ok").length : 0;
  const version = rel?.version ? `Version ${rel.version}.` : "";
  const intro = [version, own.length ? `${cap(num(own.length))} ${own.length === 1 ? "thing" : "things"} to do.` : rel ? "Nothing to do." : "Not read yet."].filter(Boolean).join(" ");
  const due = (store?.due ?? []) as string[];
  const storeWord = (what: string) => (due.includes(what) ? "Out of date with CURSEFORGE.md" : "Matches CURSEFORGE.md");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <NavLink to="addons" go={go} className="text-sm text-faint hover:text-parchment">
          ← Addons
        </NavLink>
        <div className="mt-2">
          <PageHeader title={la?.name ?? id} intro={intro} />
        </div>
      </div>
      <DispatcherBar fixes={own.map((i) => i.fix)} />
      {own.length > 0 && (
        <Panel title="To do">
          <Todo items={own} go={go} here={id} />
        </Panel>
      )}

      <Panel title="Release" action={rel?.prompt && !own.some((i) => i.fix) ? <FixSlot id={`release/${id}`} prompt={rel.prompt} alone label="Copy release prompt" /> : undefined}>
        <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
          <Line label="Last release">{rel?.tag || "None yet"}</Line>
          <Line label="Commits since then">{rel ? rel.ships || "None" : "Not read yet"}</Line>
          {repo && <Line label="Not pushed">{repo.ahead || "None"}</Line>}
          {repo && <Line label="Behind origin">{repo.behind || "None"}</Line>}
          {repo && <Line label="Uncommitted files">{repo.dirty || "None"}</Line>}
          {repo && <Line label="Last CI run">{repo.ci ? `${repo.ci === "success" ? "Passed" : cap(repo.ci)}${repo.lastRun?.at ? `, ${ago(Date.parse(repo.lastRun.at), s.now)}` : ""}` : "None"}</Line>}
          <Line label="Test zip">{zip ? zip.file || "None in iCloud" : "Not read yet"}</Line>
        </ul>
      </Panel>

      <Panel
        title="Store pages"
        action={
          store?.read && (
            <button type="button" className="btn h-8 px-3 text-[13px]" onClick={runDry}>
              Preview an update
            </button>
          )
        }
      >
        <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
          {store?.read ? (
            <>
              <Line label="CurseForge">{due.includes("CurseForge's page") ? "Page out of date with CURSEFORGE.md" : due.includes("CurseForge's summary") ? "Summary out of date with CURSEFORGE.md" : store.semicolon ? "Matches, but has a semicolon" : "Matches CURSEFORGE.md"}</Line>
              <Line label="Wago">{"state" in store.wago ? storeWord("Wago's page and summary") : "Not read"}</Line>
              <Line label="GitHub">{store.github === "none" ? "No note in CURSEFORGE.md" : storeWord("GitHub's description")}</Line>
            </>
          ) : (
            <Line label="Stores">{store ? (store.why === "not-on-curseforge" ? "Not on CurseForge yet" : "Not read") : "Not read yet"}</Line>
          )}
        </ul>
      </Panel>

      {(jobs.length > 0 || prs.length > 0) && (
        <Panel title="Game data">
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
            {jobs.map((j) => (
              <Line key={j.workflow} label={`Daily ${String(j.label).replace(/ \(.*\)/, "").toLowerCase()} job`}>
                {j.text}
              </Line>
            ))}
            {prs.map((p) => (
              <Line key={p.number} label={`Pull request #${p.number}`}>
                {p.title}
              </Line>
            ))}
          </ul>
        </Panel>
      )}

      {la && (
        <Panel
          title="Launch night"
          note={la.inGame.light === "grey" ? (s.launch?.open ? "Nothing has been tested in the game yet." : "These checks start when Forever is out.") : la.inGame.light === "red" ? "Something is broken in the game." : `${num(done)} of ${num(la.checks.length)} checks passed in the game.`}
          action={
            <NavLink to="launch" go={go} className="text-sm text-dim hover:text-parchment">
              {s.launch?.open ? "Tick them on the Launch night page" : "See launch night"}
            </NavLink>
          }
        >
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
            {(la.checks as Dict[]).map((c) => (
              <Line key={c.id} label={c.look}>
                {c.tick === "ok" ? "Passed" : c.tick === "broken" ? "Broken" : s.launch?.open ? "Not tested" : "Starts at launch"}
              </Line>
            ))}
          </ul>
          {notes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {notes.map((n) => (
                <li key={n.id} className="border-l-2 border-edge pl-3 text-dim select-text">
                  {n.text}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      {dry && (
        <Modal title={`What an update would change for ${la?.name ?? id}`} onClose={() => setDry(undefined)}>
          <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-dim select-text">{dry.out ?? "Reading CurseForge, Wago and GitHub. Nothing is saved."}</pre>
        </Modal>
      )}
    </div>
  );
}

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
