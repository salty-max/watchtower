import { Download, Home, MessageSquare, Puzzle, Users, Settings as Gear } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useSummary } from "../shared/data";
import { navFor, phoneBar, type NavItem } from "../shared/nav";
import { useShell } from "../shared/shell";

const ICONS: Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = { overview: Home, addons: Puzzle, downloads: Download, players: Users, comments: MessageSquare, settings: Gear };

/** How many comments wait, for the badge: from the one summary the app reads. */
function useWaiting(): number {
  const s = useSummary();
  return s.state === "ready" ? s.result.data.commentsWaiting : 0;
}

/**
 * The phone app's chrome, drawn from nav.ts: Watchtower's sidebar from 900 px
 * up (the Mac's own, in the same two runs and a hairline), and under that a
 * bar of five along the bottom. The pages inside never know which they are in.
 */
export function Chrome({ page, children }: { page: string; children: ReactNode }) {
  const shell = useShell();
  const waiting = useWaiting();
  const items = navFor(shell.can);
  const link = (n: NavItem, className: string, body: ReactNode) => (
    <a key={n.id} href={`#/${n.id}`} aria-current={page === n.id ? "page" : undefined} className={`${className} ${page === n.id ? "bg-gold/10 text-gold" : "text-dim hover:text-parchment"}`}>
      {body}
    </a>
  );
  return (
    <div className="min-h-dvh min-[900px]:flex">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-edge bg-stone/80 pt-12 min-[900px]:flex">
        <div className="flex items-center gap-2.5 px-5 pb-6">
          <img src="/app/icons/brand-64.png" alt="" width={36} height={36} className="size-9 rounded-[8px]" />
          <p className="title text-lg leading-tight">Watchtower</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-3" aria-label="Watchtower">
          {[1, 2].map((run) => {
            const here = items.filter((n) => n.run === run);
            if (!here.length) return null;
            return (
              <div key={run} className={`flex flex-col gap-0.5 ${run > 1 ? "mt-2.5 border-t border-edge pt-2.5" : ""}`}>
                {here.map((n) =>
                  link(
                    n,
                    "flex items-center gap-3 rounded-lg px-3 py-2",
                    <>
                      <span className="flex-1">{n.label}</span>
                      {n.id === "comments" && waiting > 0 && <span className="text-xs text-faint tabular-nums">{waiting}</span>}
                    </>,
                  ),
                )}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto px-5 pb-5">
          {items.filter((n) => n.run === 3).map((n) => link(n, "block rounded-lg px-3 py-2 -mx-3", n.label))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pt-6 pb-28 min-[900px]:px-6 min-[900px]:py-12">
        <div className="mx-auto max-w-[780px]">{children}</div>
      </main>
      <nav aria-label="Watchtower" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-edge bg-stone/95 px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur min-[900px]:hidden">
        {phoneBar(shell.can).map((n) => {
          const Icon = ICONS[n.id];
          return (
            <a key={n.id} href={`#/${n.id}`} aria-current={page === n.id ? "page" : undefined} className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-xs ${page === n.id ? "text-gold" : "text-dim"}`}>
              <Icon className="size-[18px]" aria-hidden />
              {n.label}
              {n.id === "comments" && waiting > 0 && <span className="absolute top-1 right-[22%] rounded-full bg-gold px-1.5 text-xs font-semibold text-[#22170a]">{waiting}</span>}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
