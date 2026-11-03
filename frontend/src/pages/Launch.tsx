import { ClipboardCopy, X } from "lucide-react";
import { useState } from "react";
import { NavLink } from "@/components/Row";
import { Dot, PageHeader, Panel, Reasons, Switch, useNow } from "@/components/ui";
import { call, useApp, type Dict, type Light } from "@/lib/api";
import { ago, hhmm, when } from "@/lib/format";
import { num } from "@/lib/queue";

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

const STATUSES = ["waiting-test", "waiting-review", "ready-to-push", "done"];
const READY: Record<Light, string> = { green: "Ready", amber: "Check first", red: "Not ready", grey: "Not read yet" };
const tone = (l: Light) => ({ green: "text-ok", amber: "text-gold", red: "text-blood", grey: "text-faint" })[l];

/** Launch night, top to bottom: the clock and how ready things are, the steps of the night, the addons and their checks, the systems, and the notes. The checks, the notes and the steps are the page. */
export function Launch({ go }: { go: (id: string) => void }) {
  const { state, refreshAll, toast } = useApp();
  const L = state!.launch as Dict;
  return (
    <div className="flex flex-col gap-5">
      <Band L={L} onRefresh={refreshAll} />
      <Steps L={L} />
      <Addons L={L} go={go} />
      <Systems L={L} toast={toast} />
      <Forever L={L} />
      <Notes L={L} />
    </div>
  );
}

/** T−1:23:45, counting to launch by the server's clock (the machine's may be off). */
function Clock({ launch, serverNow }: { launch: string; serverNow: number }) {
  const [offset] = useState(() => serverNow - Date.now());
  const now = useNow(1000);
  const s = Math.round((now + offset - Date.parse(launch)) / 1000);
  const a = Math.abs(s);
  const p = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(a / 86400);
  const h = Math.floor((a % 86400) / 3600);
  return (
    <div>
      <p className="title text-[34px] leading-none tabular-nums">{`T${s < 0 ? "−" : "+"}${days ? `${days}d ` : ""}${days ? p(h) : h}:${p(Math.floor((a % 3600) / 60))}:${p(a % 60)}`}</p>
      <p className="mt-1.5 text-sm text-faint">{when(launch)} on this computer</p>
    </div>
  );
}

function Band({ L, onRefresh }: { L: Dict; onRefresh: () => void }) {
  const { state } = useApp();
  const s = state!;
  const lights: Light[] = [L.build.light, L.chain.light, L.infra.light, L.board.light, L.sources.light, ...L.addons.map((a: Dict) => a.light)];
  const red = lights.filter((l) => l === "red").length;
  const amber = lights.filter((l) => l === "amber").length;
  const word = (n: number, what: string) => `${num(n)} ${n === 1 ? "thing" : "things"} ${what}`;
  const at = (_: string, o: Intl.DateTimeFormatOptions) => new Date(L.launch).toLocaleString("en-GB", { timeZone: "Europe/Paris", ...o });
  const title = L.overall === "green" ? "Everything Watchtower can check is ready." : L.overall === "grey" ? "Watchtower is still reading." : cap(red ? `${word(red, "to fix")} before launch.` : `${word(amber, "to check")} before launch.`);
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Dot light={L.overall} className="mt-0.5" />
            {title}
          </span>
        }
        intro={`Forever launches on ${at("weekday", { weekday: "long" })} at ${at("time", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} CET.`}
        action={
          <button type="button" className="btn btn-gold shrink-0" onClick={onRefresh} disabled={s.busy.length > 0}>
            {s.busy.length ? `Reading ${s.busy[0]}…` : "Read everything again"}
          </button>
        }
      />
      <section className="panel flex flex-wrap items-center justify-between gap-x-10 gap-y-3 p-5">
        <Clock launch={L.launch} serverNow={s.now} />
        <p className="max-w-xs text-sm text-faint select-text">
          Forever is pinned to {L.build.pin ?? "an unknown build"}. wago.tools has {L.build.latest ?? "an unknown build"}. Our TOC files say {L.build.toc}.
        </p>
      </section>
    </>
  );
}

/** T−1h 30m, T, T+2h: a step's time against the launch's. */
function tMark(at: string, launch: string): string {
  const m = Math.round((Date.parse(at) - Date.parse(launch)) / 60000);
  if (m === 0) return "T";
  const a = Math.abs(m);
  const d = Math.floor(a / 1440), h = Math.floor((a % 1440) / 60), r = a % 60;
  return `T${m < 0 ? "−" : "+"}${[d && `${d}d`, h && `${h}h`, r && `${r}m`].filter(Boolean).join(" ")}`;
}

/** The night's steps: the next four that are not done, and every step behind one button. */
function Steps({ L }: { L: Dict }) {
  const { change } = useApp();
  const [all, setAll] = useState(false);
  const steps: Dict[] = L.timeline;
  const done = steps.filter((t) => t.done).length;
  const shown = all ? steps : steps.filter((t) => !t.done).slice(0, 4);
  return (
    <Panel title="Steps for the night" note={`${done} of ${steps.length} done.`}>
      <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
        {shown.map((t: Dict) => (
          <li key={t.id} className={`flex items-start gap-3 py-3 ${t.done ? "opacity-60" : ""}`}>
            <span className="pt-0.5">
              <Switch on={t.done} onChange={(on) => change({ op: "step", id: t.id, done: on })} label={`${t.title}: done`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold text-parchment ${t.done ? "line-through" : ""}`}>{t.title}</p>
              <p className="mt-0.5 text-sm text-dim select-text">{t.detail}</p>
            </div>
            <p className={`shrink-0 text-right text-sm ${t.next ? "text-gold" : "text-faint"}`}>
              <span className="font-mono">{tMark(t.at, L.launch)}</span>
              <span className="block">{t.next ? "Next, " : ""}{when(t.at)}</span>
            </p>
          </li>
        ))}
      </ul>
      {steps.length > shown.length || all ? (
        <button type="button" className="btn mt-3 h-8 px-3 text-[13px]" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show only the next steps" : `Show all ${num(steps.length)} steps`}
        </button>
      ) : null}
    </Panel>
  );
}

/** The nine addons in launch order, each with its checks behind one button. */
function Addons({ L, go }: { L: Dict; go: (id: string) => void }) {
  const [open, setOpen] = useState<string[]>();
  // (until the user opens or closes one, the open one follows the readings: the first that is not ready)
  const shown = open ?? (L.addons as Dict[]).filter((a) => a.light !== "green").slice(0, 1).map((a) => a.id);
  return (
    <Panel title="Addons" note={L.open ? "In the order to test them. Open one to tick its checks." : "These checks start when Forever is out. They are listed in the order to test them."}>
      <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
        {(L.addons as Dict[]).map((a) => (
          <AddonRow key={a.id} a={a} go={go} open={!!L.open} shown={shown.includes(a.id)} toggle={() => setOpen(shown.includes(a.id) ? shown.filter((x) => x !== a.id) : [...shown, a.id])} />
        ))}
      </ul>
    </Panel>
  );
}

function AddonRow({ a, go, shown, toggle, open }: { a: Dict; go: (id: string) => void; shown: boolean; toggle: () => void; open: boolean }) {
  const { change, copy } = useApp();
  const done = a.checks.filter((c: Dict) => c.tick === "ok").length;
  const game = a.inGame.light === "grey" ? (open ? "Not tested" : "Starts at launch") : a.inGame.light === "red" ? "Broken" : `${num(done)} of ${num(a.checks.length)} passed`;
  return (
    <li id={`card-${a.id}`} className="py-2.5">
      <div className="flex items-center gap-3">
        <Dot light={a.light} />
        <NavLink to={`addon:${a.id}`} go={go} className="font-semibold text-parchment">
          {a.name}
        </NavLink>
        <span className={`text-sm ${tone(a.readiness.light)}`}>{READY[a.readiness.light as Light]}</span>
        <span className={`ml-auto text-sm ${a.inGame.light === "red" ? "text-blood" : "text-dim"}`}>{game}</span>
        <button type="button" className="btn h-8 px-3 text-[13px]" aria-expanded={shown} aria-controls={`body-${a.id}`} onClick={toggle}>
          {shown ? "Hide checks" : "Checks"}
        </button>
      </div>
      {shown && (
        <div id={`body-${a.id}`} className="mt-2 ml-5">
          <Reasons v={a.readiness} />
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
            {a.checks.map((c: Dict) => (
              <li key={c.id} className="py-2.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-parchment select-text">{c.look}</p>
                    <p className="mt-0.5 text-sm text-faint select-text">{c.ok}</p>
                  </div>
                  <div role="group" aria-label={c.look} className="flex shrink-0 overflow-hidden rounded-md border border-edge">
                    {(["ok", "broken"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={c.tick === v}
                        onClick={() => change({ op: "tick", key: `${a.id}/${c.id}`, value: c.tick === v ? "untested" : v })}
                        className={`h-8 px-3 text-[13px] transition-colors ${c.tick === v ? (v === "ok" ? "bg-ok/20 text-ok" : "bg-blood/20 text-blood") : "bg-stone-2 text-dim hover:text-parchment"}`}
                      >
                        {v === "ok" ? "Works" : "Broken"}
                      </button>
                    ))}
                  </div>
                </div>
                {c.tick === "broken" && (
                  <div className="mt-2 border-l-2 border-blood pl-3 text-sm text-dim select-text">
                    <p>
                      <b className="text-parchment">If it is broken:</b> {c.todo}
                    </p>
                    <p className="mt-1 text-faint">Fixed by: {c.fix}</p>
                    <button type="button" className="btn mt-2 h-8 px-3 text-[13px]" onClick={() => copy(`${a.name}: ${c.look}: `, "Copied. It starts a note.")}>
                      Copy the start of a note
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-faint select-text">{a.risk}</p>
        </div>
      )}
    </li>
  );
}

function Systems({ L, toast }: { L: Dict; toast: (t: string, tone?: "ok" | "error") => void }) {
  const { reload } = useApp();
  const rows: [string, Dict, string][] = [
    ["Forever build", L.build, "The pinned build is the latest one."],
    ["Data jobs", L.chain, "Every addon's game data job is passing."],
    ["Site and inbox", L.infra, (L.infra.probes ?? []).map((p: Dict) => `${p.name} answered in ${p.ms} ms`).join(", ") + "."],
    ["Watchtower's readings", L.sources, "Everything was read."],
  ];
  const setCard = async (id: string, status: string) => {
    try {
      const r = await call<Dict>("/api/action", { name: "card", id, status });
      if (!r.ok) toast(r.out || "The board said no.", "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
    await reload();
  };
  return (
    <Panel title="Systems">
      <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
        {rows.map(([name, v, fine]) => (
          <li key={name} className="flex items-start gap-3 py-2.5">
            <Dot light={v.light} className="mt-[7px]" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-parchment">{name}</p>
              <div className="text-sm text-dim select-text">{v.reasons.length ? v.reasons.map((r: string, i: number) => <p key={i}>{r}</p>) : <p>{fine}</p>}</div>
            </div>
          </li>
        ))}
      </ul>
      {L.board.cards.length > 0 && (
        <>
          <h3 className="mt-4 text-sm text-dim">Open cards on the board</h3>
          <ul className="mt-1 flex flex-col divide-y divide-white/[0.05]">
            {L.board.cards.map((c: Dict) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-parchment" title={c.title}>
                  {c.title}
                </span>
                <select className="field h-8 shrink-0 text-[13px]" value={c.status} aria-label={`Status of ${c.title}`} onChange={(e) => setCard(c.id, e.target.value)}>
                  {!STATUSES.includes(c.status) && <option disabled>{c.status}</option>}
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Forever({ L }: { L: Dict }) {
  const { state } = useApp();
  const d = L.data;
  const k = d.kinds ?? {};
  const age = state!.ages["launch-data"];
  const rows: [string, unknown][] = [...(d.zones ?? []).map((z: Dict) => [`Quests in ${z.zone}`, z.quests] as [string, unknown]), ["Factions", k.faction], ["Creatures", k.creature], ["Quests in all", k.quest]];
  return (
    <Panel title="Forever data" note={age ? `Read ${ago(age.at)}${age.cached ? " (an old reading)" : ""}.` : "Not read yet."}>
      {d.error && !d.zones ? (
        <p className="mt-3 text-sm text-dim select-text">{d.error}</p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">
            {rows.map(([name, v]) => (
              <li key={name} className="flex items-baseline justify-between py-2">
                <span className="text-dim">{name}</span>
                <span className="text-parchment tabular-nums">{String(v ?? "?")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-faint select-text">
            forever.db was built on {String(d.builtAt ?? "").slice(0, 10)} from build {d.pins ?? "?"}. The second Codex wave and Goodwill's Forever factions wait on these numbers.
          </p>
        </>
      )}
    </Panel>
  );
}

function Notes({ L }: { L: Dict }) {
  const { change, copy } = useApp();
  const [addon, setAddon] = useState(L.addons[0]?.id ?? "other");
  const [severity, setSeverity] = useState("bug");
  const [text, setText] = useState("");
  const [shot, setShot] = useState<string>();
  const name = (id: string) => L.addons.find((a: Dict) => a.id === id)?.name ?? id;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await change({ op: "note", addon, severity, text: text.trim(), ...(shot ? { shot } : {}) });
    setText("");
    setShot(undefined);
  };
  const shots: { name: string }[] = L.shots.list;
  return (
    <Panel title="What broke" note="Write down anything that goes wrong, so a session can fix it in the morning.">
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5">
        <div className="flex gap-2">
          <select className="field min-w-0 flex-1" value={addon} onChange={(e) => setAddon(e.target.value)} aria-label="Which addon">
            {L.addons.map((a: Dict) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="other">Something else</option>
          </select>
          <select className="field" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="How bad">
            {[["blocker", "Blocks play"], ["bug", "A bug"], ["nit", "A small thing"]].map(([v, w]) => (
              <option key={v} value={v}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <textarea className="field h-24 resize-y py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="What you saw, what you did, the error text" aria-label="What went wrong" />
        {L.shots.error ? (
          <p className="text-sm text-faint select-text">{L.shots.error}</p>
        ) : shots.length === 0 ? (
          <p className="text-sm text-faint">There is no screenshot in iCloud Drive from the last hour before launch.</p>
        ) : (
          <div className="grid grid-cols-5 gap-1.5">
            {shots.map((s) => (
              <button key={s.name} type="button" aria-pressed={shot === s.name} aria-label={`Attach ${s.name}`} onClick={() => setShot(shot === s.name ? undefined : s.name)} className={`overflow-hidden rounded-md border-2 ${shot === s.name ? "border-gold" : "border-edge"}`}>
                <img src={`/api/shot?f=${encodeURIComponent(s.name)}`} alt={s.name} loading="lazy" className="aspect-video w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="submit" className="btn btn-gold" disabled={!text.trim()}>
            Add the note
          </button>
          <button type="button" className="btn btn-ghost" onClick={async () => copy(await (await fetch("/api/notes")).text(), "Copied the night's notes.")}>
            <ClipboardCopy className="size-4" aria-hidden />
            Copy all notes
          </button>
        </div>
      </form>
      <ul className="mt-4 flex flex-col divide-y divide-white/[0.05]">
        {L.notes.length === 0 && <li className="py-2 text-sm text-dim">Nothing has gone wrong yet.</li>}
        {[...L.notes].reverse().map((n: Dict) => (
          <li key={n.id} className="py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Dot light={n.severity === "blocker" ? "red" : n.severity === "bug" ? "amber" : "grey"} />
              <b className="font-semibold text-parchment">{name(n.addon)}</b>
              <span className="text-faint">{hhmm(n.at)}</span>
              <button type="button" className="btn btn-ghost -mr-2 ml-auto h-7 px-2" aria-label="Delete this note" onClick={() => change({ op: "drop", id: n.id })}>
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 ml-5 text-sm text-dim select-text">{n.text}</p>
            {n.shot && <img src={`/api/shot?f=${encodeURIComponent(n.shot)}`} alt="A screenshot of what went wrong" loading="lazy" className="mt-2 ml-5 rounded-md border border-edge" />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
