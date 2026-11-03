import { Dot, useNow } from "@/components/ui";
import { useApp, type Light } from "@/lib/api";
import { addonsLight, PAGE_NAME } from "@/lib/queue";
import { ago } from "@/lib/format";

/** The pages in the window's own order: the answer first, the night last. */
const ORDER = ["overview", "releases", "data", "stores", "zips", "addons", "launch"];

/** The window's left side: the name (under macOS's traffic lights), the pages with their lights, how fresh the readings are. */
export function Sidebar({ page, go }: { page: string; go: (id: string) => void }) {
  const { state, lastOk } = useApp();
  const now = useNow(15_000);
  if (!state) return null;
  const light = (id: string): Light => (id === "overview" ? state.overall : id === "addons" ? addonsLight(state) : (state.pages.find((p) => p.id === id)?.light ?? "grey"));
  const pages = ORDER.filter((id) => id === "overview" || id === "addons" || state.pages.some((p) => p.id === id));
  const oldest = Math.min(...Object.values(state.ages).filter((a) => !a.paused).map((a) => a.at));
  const stale = now - lastOk > 60_000;
  const cached = Object.values(state.ages).filter((a) => a.cached && !a.error && !a.paused);
  return (
    <aside className="drag flex w-48 shrink-0 flex-col border-r border-edge pt-12 max-md:w-40">
      <div className="px-5 pb-6">
        <img src="/icon.png" alt="" width={36} height={36} className="size-9 rounded-md" />
        <p className="title mt-2 text-[15px] leading-tight">Watchtower</p>
      </div>
      <nav className="no-drag flex flex-col" aria-label="Watchtower">
        {pages.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            aria-current={page === id || (id === "addons" && page.startsWith("addon:")) ? "page" : undefined}
            className={`flex items-center justify-between border-l-2 px-5 py-[7px] text-left transition-colors ${page === id || (id === "addons" && page.startsWith("addon:")) ? "border-gold bg-white/[0.03] text-parchment" : "border-transparent text-dim hover:text-parchment"}`}
          >
            {PAGE_NAME[id]}
            <Dot light={light(id)} />
          </button>
        ))}
      </nav>
      <p className="mt-auto flex items-start gap-2 px-5 pb-5 text-xs text-faint">
        <span aria-hidden className={`mt-1 size-1.5 shrink-0 rounded-full ${stale ? "bg-blood" : state.busy.length || cached.length ? "pulse-dot bg-gold" : "bg-ok/60"}`} />
        <span className={stale ? "text-blood" : ""}>{stale ? "Lost the server" : cached.length ? `Cached ${ago(Math.min(...cached.map((a) => a.at)), now)}, reading again` : state.busy.length ? `Reading ${state.busy[0]}` : `Read ${ago(oldest, now)}`}</span>
      </p>
    </aside>
  );
}
