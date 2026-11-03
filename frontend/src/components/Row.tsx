import { ExternalLink } from "lucide-react";
import { FixSlot } from "@/components/FixButton";
import { Dot } from "@/components/ui";
import { useApp } from "@/lib/api";
import { nameOf, type Item } from "@/lib/queue";

/** A name that goes somewhere: parchment, a dotted underline on hover. Actions are buttons, the rest is plain words. */
export function NavLink({ to, go, children, className = "" }: { to: string; go: (id: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => go(to)} className={`cursor-pointer text-left hover:underline hover:decoration-dotted hover:underline-offset-4 ${className}`}>
      {children}
    </button>
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
            <FixSlot id={i.id} prompt={i.prompt} fix={i.fix} />
          </div>
        </li>
      ))}
    </ul>
  );
}
