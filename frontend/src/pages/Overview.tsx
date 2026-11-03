import { DispatcherBar, FixSlot } from "@/components/FixButton";
import { NavLink, Todo } from "@/components/Row";
import { Dot, PageHeader, Panel, useNow } from "@/components/ui";
import { useApp } from "@/lib/api";
import { ago } from "@/lib/format";
import { num, queue, quiet, waitingToPush } from "@/lib/queue";

/** What is left to the launch, in words. */
function untilLaunch(launch: string | undefined, now: number): string | undefined {
  if (!launch) return undefined;
  const s = Math.round((Date.parse(launch) - now) / 1000);
  if (s <= 0) return "Forever has launched.";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `Forever launches in ${d ? `${d} day${d === 1 ? "" : "s"} ` : ""}${h} hour${h === 1 ? "" : "s"}${d ? "" : ` ${m} minutes`}.`;
}

const things = (n: number) => `${num(n)} ${n === 1 ? "thing" : "things"}`;
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

/** The first page: what needs doing, red first, what waits to be pushed, and a line for everything that is fine. */
export function Overview({ go }: { go: (id: string) => void }) {
  const { state } = useApp();
  const s = state!;
  const now = useNow(60_000);
  const items = queue(s);
  const red = items.filter((i) => i.light === "red").length;
  const push = waitingToPush(s);
  const q = quiet(s);
  const oldest = Math.min(...Object.values(s.ages).filter((a) => !a.paused).map((a) => a.at));
  const title = items.length === 0 ? "Everything is in order" : cap(red ? `${things(red)} to fix` : `${things(items.length)} to check`);
  const intro = [untilLaunch(s.launch?.launch, s.now), red && items.length > red ? `${cap(things(items.length - red))} more to check.` : undefined].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={title} intro={intro || undefined} />
      <DispatcherBar fixes={[...items.map((i) => i.fix), ...push.map((p) => p.fix)]} />
      {items.length > 0 && (
        <Panel title="To do" note="Red ones stop a release or a push. The others are worth a look first.">
          <Todo items={items} go={go} />
        </Panel>
      )}
      {push.length > 0 && (
        <Panel title="Waiting on this computer" note="Commits and files that are not on GitHub yet.">
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
            {push.map((p) => (
              <li key={p.name} className="flex items-center gap-3 py-2.5">
                <Dot light={p.blocked ? "red" : "green"} />
                <p className="min-w-0 flex-1 text-parchment">
                  {p.addon ? (
                    <NavLink to={`addon:${p.name}`} go={go} className="font-semibold">
                      {p.who}
                    </NavLink>
                  ) : (
                    <b className="font-semibold">{p.who}</b>
                  )}{" "}
                  has {[p.ahead > 0 && `${num(p.ahead)} commit${p.ahead === 1 ? "" : "s"} not pushed`, p.dirty > 0 && `${num(p.dirty)} uncommitted file${p.dirty === 1 ? "" : "s"}`].filter(Boolean).join(" and ")}.
                  {p.cards.length > 0 && <span className="text-sm text-faint"> A card is working on it: {p.cards.join(", ")}.</span>}
                </p>
                {p.ahead > 0 && <FixSlot id={`push/${p.name}`} prompt={p.prompt} fix={undefined} alone label="Copy push prompt" />}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="text-sm text-faint">
        {items.length ? "Everything else is fine: " : "Nothing needs you: "}
        {q.stores} of {q.storesOf} store pages match their files, {q.zips} of {q.zipsOf} test zips are up to date, {q.jobs} of {q.jobsOf} daily jobs passed and {s.data.prs.length ? `${num(s.data.prs.length)} pull request${s.data.prs.length === 1 ? " is" : "s are"} open` : "no pull request is open"}. The oldest reading is {ago(oldest, now)}.
      </p>
    </div>
  );
}
