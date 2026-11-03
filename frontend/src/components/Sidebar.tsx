import { Database, FileArchive, Package, Radio, Rocket, Store } from "lucide-react";
import { Dot, useNow } from "@/components/ui";
import { useApp } from "@/lib/api";
import { ago, WORD } from "@/lib/format";

export const ICONS = { launch: Rocket, releases: Package, data: Database, stores: Store, zips: FileArchive } as const;

/** The window's left side: the tower and the name (under macOS's traffic lights), the pages with their lights, and how fresh the readings are. */
export function Sidebar({ page, go }: { page: string; go: (id: string) => void }) {
  const { state, shell, lastOk } = useApp();
  const now = useNow(15_000);
  if (!state) return null;
  const oldest = Math.min(...Object.values(state.ages).map((a) => a.at));
  const stale = now - lastOk > 60_000;
  const cached = Object.values(state.ages).filter((a) => a.cached && !a.error && !a.paused);
  return (
    <aside className="drag flex w-56 shrink-0 flex-col border-r border-edge bg-stone/80 pt-12">
      <div className="flex items-center gap-3 px-5 pb-6">
        <img src="/icon.png" alt="" width={40} height={40} className="size-10 rounded-[9px] shadow-[0_0_14px_rgb(242_193_78/0.25)]" />
        <div className="min-w-0">
          <p className="title text-lg leading-tight">Watchtower</p>
          <p className="text-xs text-faint">{WORD[state.overall]}</p>
        </div>
      </div>
      <nav className="no-drag flex flex-col gap-0.5 px-3" aria-label="Watchtower">
        {state.pages.map((p) => {
          const Icon = ICONS[p.id as keyof typeof ICONS] ?? Radio;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => go(p.id)}
              aria-current={page === p.id ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${page === p.id ? "bg-gold/10 text-gold" : "text-dim hover:bg-white/[0.04] hover:text-parchment"}`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{p.label}</span>
              <Dot light={p.light} />
            </button>
          );
        })}
      </nav>
      <div className="mt-auto px-5 pb-5">
        <p className="flex items-center gap-2 text-[13px]">
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${stale ? "bg-blood" : state.busy.length ? "pulse-dot bg-gold" : "pulse-dot bg-ok"}`} />
          <span className={stale ? "text-blood" : "text-dim"}>{stale ? "Lost the server" : cached.length ? `Cached ${ago(Math.min(...cached.map((a) => a.at)), now)}, reading again…` : state.busy.length ? `Reading ${state.busy[0]}…` : `Read ${ago(oldest, now)}`}</span>
        </p>
        <p className="mt-2 text-xs leading-snug text-faint">{shell ? "Closing the window keeps Watchtower in the menu bar. Quit is in its menu." : "In a browser: the app itself is in the menu bar."}</p>
      </div>
    </aside>
  );
}
