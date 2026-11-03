import { ExternalLink } from "lucide-react";
import { DispatcherBar, FixSlot } from "@/components/FixButton";
import { Dot, useNow } from "@/components/ui";
import { useApp } from "@/lib/api";
import { PAGE_NAME, queue, quiet, type Item } from "@/lib/queue";
import { ago } from "@/lib/format";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What is left to the launch, in words (not a ticking clock: the Launch page has the clock). */
function untilLaunch(launch: string | undefined, now: number): string | undefined {
  if (!launch) return undefined;
  const s = Math.round((Date.parse(launch) - now) / 1000);
  if (s <= 0) return "Forever has launched";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `Forever launches in ${d ? `${d} d ` : ""}${h} h ${m} min`;
}

/** The first page: what needs the user now, red first, everything green said once at the foot. */
export function Overview({ go }: { go: (id: string) => void }) {
  const { state, open } = useApp();
  const s = state!;
  const now = useNow(60_000);
  const items = queue(s);
  const red = items.filter((i) => i.light === "red");
  const amber = items.filter((i) => i.light === "amber");
  const grey = items.filter((i) => i.light === "grey");
  const q = quiet(s);
  const oldest = Math.min(...Object.values(s.ages).filter((a) => !a.paused).map((a) => a.at));
  const head = items.length === 0 ? "Nothing needs you" : [red.length && `${red.length} in the way`, amber.length && `${amber.length} to look at`, grey.length && `${grey.length} not read`].filter(Boolean).join(", ");
  const day = new Date(s.now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const launch = untilLaunch(s.launch?.launch, s.now);
  return (
    <div>
      <h1 className="title text-[26px] leading-tight text-parchment">{head}</h1>
      <p className="mt-1.5 text-dim">{[day, launch].filter(Boolean).join(". ")}.</p>
      <DispatcherBar />
      <Band title="In the way" tone="text-blood" items={red} go={go} open={open} />
      <Band title="To look at" tone="text-amber" items={amber} go={go} open={open} />
      <Band title="Not read" tone="text-faint" items={grey} go={go} open={open} />
      <p className="mt-8 flex items-start gap-2.5 border-t border-edge pt-3.5 text-[13px] text-faint">
        <Dot light="green" className="mt-1" />
        <span>
          {items.length ? "Quiet: " : "All quiet: "}
          {q.stores} of {q.storesOf} store pages match their files, {q.zips} of {q.zipsOf} test zips are current, {q.reposOf ? `${q.repos} of ${q.reposOf} repositories have nothing wrong` : "no repositories read"}, {q.jobs} of {q.jobsOf} daily jobs passed, {s.data.prs.length ? plural(s.data.prs.length, "pull request") + " open" : "no pull request open"}. Oldest reading {ago(oldest, now)}.
        </span>
      </p>
    </div>
  );
}

function Band({ title, tone, items, go, open }: { title: string; tone: string; items: Item[]; go: (id: string) => void; open: (url: string) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-7" aria-label={title}>
      <h2 className="mb-1 text-[11px] font-semibold tracking-[0.12em] uppercase">
        <span className={tone}>{title}</span> <span className="ml-1 font-mono font-normal text-faint">{items.length}</span>
      </h2>
      <ul className="border-b border-edge">
        {items.map((i) => (
          <li key={i.id} data-row={i.id} className="grid grid-cols-[1.25rem_minmax(0,11rem)_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-t border-edge py-2.5 max-md:grid-cols-[1.25rem_minmax(0,1fr)]">
            <Dot light={i.light} className="mt-[3px]" />
            <b className="font-semibold text-parchment [overflow-wrap:anywhere] select-text">{i.where}</b>
            <div className="min-w-0 max-md:col-start-2">
              <p className="text-parchment select-text">{i.what}</p>
              {i.names && <p className="mt-0.5 font-mono text-xs text-faint select-text">{i.names.join(" · ")}</p>}
            </div>
            <div className="flex items-center gap-2 max-md:col-start-2">
              <button type="button" className="rounded px-1.5 py-1 font-mono text-xs text-faint hover:text-parchment" onClick={() => go(i.page)}>
                {PAGE_NAME[i.page]} →
              </button>
              {i.url && /^https:\/\//.test(i.url) && (
                <button type="button" className="rounded p-1 text-faint hover:text-parchment" aria-label="Open on GitHub" onClick={() => open(i.url!)}>
                  <ExternalLink className="size-3.5" />
                </button>
              )}
              <FixSlot id={i.id} prompt={i.prompt} fix={i.fix} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
