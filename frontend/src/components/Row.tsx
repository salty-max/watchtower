import { ExternalLink } from "lucide-react";
import { Dot } from "@/components/ui";
import { FixSlot } from "@/components/FixButton";
import { useApp } from "@/lib/api";
import type { Item } from "@/lib/queue";

/** A name that goes somewhere: the one look of navigation in the window (parchment, a dotted underline on hover). Actions are buttons, status is plain words and marks. */
export function NavLink({ to, go, children, className = "" }: { to: string; go: (id: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={() => go(to)} className={`cursor-pointer text-left hover:underline hover:decoration-dotted hover:underline-offset-4 ${className}`}>
      {children}
    </button>
  );
}

/** A repository or addon name: a link to the addon's page when it is one of the addons, plain text when it is a tool (a link to the page you are on would go nowhere). */
export function RepoName({ name, label, ids, go, className = "" }: { name: string; label?: string; ids: string[]; go: (id: string) => void; className?: string }) {
  return ids.includes(name) ? (
    <NavLink to={`addon:${name}`} go={go} className={className}>
      {label ?? name}
    </NavLink>
  ) : (
    <span className={className}>{label ?? name}</span>
  );
}

/** Where a row's name goes: the addon's page for an addon, else the page the row lives on unless that is the page being shown. */
export const target = (i: Item, addons: string[], here: string): string | undefined => (addons.includes(i.where) ? `addon:${i.where}` : i.page !== here ? i.page : undefined);

/** The queue's rows as one list: a mark, the name (a link), what is wrong (the addons it stands for, as links), and at the right the fix slot or what to do by hand. */
export function Rows({ items, go, addons, here }: { items: Item[]; go: (id: string) => void; addons: string[]; here: string }) {
  const { open, state } = useApp();
  const label = (id: string) => (state?.launch?.addons as { id: string; name: string }[] | undefined)?.find((a) => a.id === id)?.name ?? id;
  return (
    <ul className="border-b border-edge">
      {items.map((i) => (
        <li key={i.id} data-row={i.id} className="grid grid-cols-[1.25rem_minmax(0,11rem)_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-t border-edge py-2.5 max-md:grid-cols-[1.25rem_minmax(0,1fr)]">
          <Dot light={i.light} className="mt-[3px]" />
          {target(i, addons, here) ? (
            <NavLink to={target(i, addons, here)!} go={go} className="font-semibold text-parchment [overflow-wrap:anywhere]">
              {i.where}
            </NavLink>
          ) : (
            <b className="font-semibold text-parchment [overflow-wrap:anywhere]">{i.where}</b>
          )}
          <div className="min-w-0 max-md:col-start-2">
            <p className="text-parchment select-text">{i.what}</p>
            {i.names && (
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-faint">
                {i.names.map((n) => (
                  <RepoName key={n} name={n} label={label(n)} ids={addons} go={go} className="hover:text-parchment" />
                ))}
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 max-md:col-start-2 max-md:justify-start">
            {i.url && /^https:\/\//.test(i.url) && (
              <button type="button" className="rounded p-1 text-faint hover:text-parchment" aria-label="Open on GitHub" onClick={() => open(i.url!)}>
                <ExternalLink className="size-3.5" />
              </button>
            )}
            <FixSlot id={i.id} prompt={i.prompt} fix={i.fix} hint={i.hint} />
          </div>
        </li>
      ))}
    </ul>
  );
}
