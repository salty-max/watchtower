import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { FixSlot } from "@/components/FixButton";
import { Dot, Modal } from "@/components/ui";
import { call, useApp, type Dict } from "@/lib/api";
import { nameOf, type Item } from "@/lib/queue";

/** A name that goes somewhere: parchment, a dotted underline on hover. Actions are buttons, the rest is plain words. */
export function NavLink({ to, go, children, className = "" }: { to: string; go: (id: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => go(to)} className={`cursor-pointer text-left hover:underline hover:decoration-dotted hover:underline-offset-4 ${className}`}>
      {children}
    </button>
  );
}

/** A plain pull: `git pull --ff-only` in one repository, for a clean branch that is behind. The server checks it again and says in words why it refused. The output is shown. */
export function PullButton({ repo, name }: { repo: string; name: string }) {
  const { reload, toast } = useApp();
  const [run, setRun] = useState<{ out?: string; ok?: boolean }>();
  const go = async () => {
    setRun({});
    try {
      const r = await call<Dict>("/api/action", { name: "pull", repo });
      setRun({ out: r.out, ok: r.ok });
    } catch (e) {
      setRun(undefined);
      toast(e instanceof Error ? e.message : String(e), "error");
    }
    void reload();
  };
  return (
    <>
      <button type="button" className="btn h-8 px-3 text-[13px]" disabled={run !== undefined && run.out === undefined} onClick={go}>
        Pull
      </button>
      {run && (
        <Modal title={`Pull ${name}`} onClose={() => setRun(undefined)} locked={run.out === undefined}>
          <p className={`mb-3 text-sm ${run.ok === false ? "text-blood" : "text-dim"}`}>{run.out === undefined ? "Pulling. Nothing else is touched." : run.ok ? "Pulled." : "It did not pull."}</p>
          {run.out !== undefined && <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-dim select-text">{run.out}</pre>}
        </Modal>
      )}
    </>
  );
}

/** What there is to do, one plain sentence each, red first: a dot, the sentence (the addon's name a link to its page), and at the right a Fix button when a session could start a fix. */
export function Todo({ items, go, here }: { items: Item[]; go: (id: string) => void; here?: string }) {
  const { state, open } = useApp();
  return (
    <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
      {items.map((i) => (
        <li key={i.id} data-row={i.id} className="flex items-start gap-3 py-2.5">
          <Dot light={i.light} className="mt-[7px]" />
          <div className="min-w-0 flex-1">
            <p className="text-parchment select-text">
              {!i.who ? null : i.addon && i.addon !== here ? (
                <NavLink to={`addon:${i.addon}`} go={go} className="font-semibold">
                  {i.who}
                </NavLink>
              ) : i.addon && i.addon === here ? (
                <span>It</span>
              ) : (
                <b className="font-semibold">{i.who}</b>
              )}{i.who ? " " : ""}
              {i.what}
            </p>
            {i.addons && (
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-faint">
                {i.addons.map((a) => (
                  <NavLink key={a} to={`addon:${a}`} go={go} className="hover:text-parchment">
                    {nameOf(state!, a)}
                  </NavLink>
                ))}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {i.url && /^https:\/\//.test(i.url) && (
              <button type="button" className="rounded p-1 text-faint hover:text-parchment" aria-label="Open on GitHub" onClick={() => open(i.url!)}>
                <ExternalLink className="size-4" />
              </button>
            )}
            {i.pull ? <PullButton repo={i.pull} name={nameOf(state!, i.pull)} /> : <FixSlot id={i.id} prompt={i.prompt} fix={i.fix} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
