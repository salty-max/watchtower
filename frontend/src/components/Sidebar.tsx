import { Database, Home, Puzzle, Rocket } from "lucide-react";
import { useNow } from "@/components/ui";
import { Dot } from "@/components/ui";
import { useApp, type Light } from "@/lib/api";
import { addonsLight } from "@/lib/queue";
import { ago } from "@/lib/format";

/** The window's left side, laid out as Ravenpost's: the tower and the name (under macOS's traffic lights), the pages, and at the bottom how fresh the readings are. */
export function Sidebar({ page, go }: { page: string; go: (id: string) => void }) {
  const { state, lastOk } = useApp();
  const now = useNow(15_000);
  if (!state) return null;
  const light = (id: string): Light => (id === "overview" ? state.overall : id === "addons" ? addonsLight(state) : (state.pages.find((p) => p.id === id)?.light ?? "grey"));
  const pages = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "addons", label: "Addons", icon: Puzzle },
    { id: "data", label: "Data", icon: Database },
    ...(state.pages.some((p) => p.id === "launch") ? [{ id: "launch", label: "Launch night", icon: Rocket }] : []),
  ];
  const here = page.startsWith("addon:") ? "addons" : page;
  const oldest = Math.min(...Object.values(state.ages).filter((a) => !a.paused).map((a) => a.at));
  const stale = now - lastOk > 60_000;
  const cached = Object.values(state.ages).filter((a) => a.cached && !a.error && !a.paused);
  return (
    <aside className="drag flex w-56 shrink-0 flex-col border-r border-edge bg-stone/80 pt-12">
      <div className="flex items-center gap-2.5 px-5 pb-6">
        <img src="/icon.png" alt="" width={36} height={36} className="size-9 rounded-[8px]" />
        <p className="title text-lg leading-tight">Watchtower</p>
      </div>
      <nav className="no-drag flex flex-col gap-0.5 px-3" aria-label="Watchtower">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => go(p.id)}
            aria-current={here === p.id ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${here === p.id ? "bg-gold/10 text-gold" : "text-dim hover:bg-white/[0.04] hover:text-parchment"}`}
          >
            <p.icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{p.label}</span>
            <Dot light={light(p.id)} className="size-2" />
          </button>
        ))}
      </nav>
      <div className="mt-auto px-5 pb-5">
        <p className="flex items-center gap-2 text-[13px]">
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${stale ? "bg-blood" : state.busy.length || cached.length ? "pulse-dot bg-gold" : "bg-ok"}`} />
          <span className={stale ? "text-blood" : "text-dim"}>{stale ? "Lost the server" : cached.length ? `Reading again, last read ${ago(Math.min(...cached.map((a) => a.at)), now)}` : state.busy.length ? `Reading ${state.busy[0]}` : `Read ${ago(oldest, now)}`}</span>
        </p>
      </div>
    </aside>
  );
}
