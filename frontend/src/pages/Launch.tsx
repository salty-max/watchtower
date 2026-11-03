import { Check, ClipboardCopy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Chip, Chips, Dot, Modal, Reasons, useNow } from "@/components/ui";
import { call, useApp, type Dict, type Light } from "@/lib/api";
import { ago, hhmm, when, WORD } from "@/lib/format";

const VERDICT: Record<Light, [string, string, string]> = {
  green: ["Ready for launch", "Everything the tools can check is green.", "text-ok"],
  amber: ["Look at the amber", "", "text-amber"],
  red: ["Fix the red first", "", "text-blood"],
  grey: ["Gathering", "The first answers are still coming in.", "text-faint"],
};
const STATUSES = ["waiting-test", "waiting-review", "ready-to-push", "done"];

/** Launch night: the nine addons' readiness and the in-game checks, the night's timeline, the systems, the notes and the open questions. One page with the others, and the same ticks and notes file launch.ts keeps. */
export function Launch() {
  const { state, refreshAll, toast } = useApp();
  const L = state!.launch as Dict;
  return (
    <div className="flex flex-col gap-5">
      <Band L={L} onRefresh={refreshAll} />
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-3" aria-label="The nine addons">
          {L.addons.map((a: Dict) => (
            <AddonCard key={a.id} a={a} />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Timeline L={L} />
          <Systems L={L} toast={toast} />
          <Notes L={L} />
          <Questions L={L} />
          <ForeverData L={L} />
        </div>
      </div>
    </div>
  );
}

function Box({ title, age, children }: { title: string; age?: string; children: React.ReactNode }) {
  return (
    <section className="panel px-4 py-3.5">
      <h2 className="mb-3 flex items-baseline justify-between gap-3 text-xs font-semibold tracking-[0.12em] text-faint uppercase">
        {title}
        {age && <span className="text-[11px] font-normal tracking-normal normal-case">{age}</span>}
      </h2>
      {children}
    </section>
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
      <p className="title text-[26px] leading-none tabular-nums">{`T${s < 0 ? "−" : "+"}${days ? `${days}d ` : ""}${days ? p(h) : h}:${p(Math.floor((a % 3600) / 60))}:${p(a % 60)}`}</p>
      <p className="mt-1.5 text-xs text-faint">Launch {when(launch)}</p>
    </div>
  );
}

function Band({ L, onRefresh }: { L: Dict; onRefresh: () => void }) {
  const { state } = useApp();
  const s = state!;
  const lights: Light[] = [L.build.light, L.chain.light, L.infra.light, L.board.light, L.sources.light, ...L.addons.map((a: Dict) => a.light)];
  const red = lights.filter((l) => l === "red").length;
  const amber = lights.filter((l) => l === "amber").length;
  const [title, sub, tone] = VERDICT[L.overall as Light];
  const detail = sub || `${[red && `${red} red`, amber && `${amber} amber`].filter(Boolean).join(", ")} below.`;
  return (
    <section className="panel relative flex flex-wrap items-center justify-between gap-5 overflow-hidden px-6 py-5">
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-10 size-56 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative">
        <Clock launch={L.launch} serverNow={s.now} />
      </div>
      <div className="relative flex min-w-0 flex-1 items-center gap-4">
        <span aria-hidden className={`grid size-12 shrink-0 place-items-center rounded-full border-2 ${tone} bg-current/10`}>
          <span className="size-5 rounded-full bg-current" />
        </span>
        <div className="min-w-0">
          <h1 className={`title text-[22px] leading-tight ${tone}`}>{title}</h1>
          <p className="text-dim">{detail}</p>
        </div>
      </div>
      <div className="relative flex flex-col items-end gap-2.5">
        <p className="flex gap-4 text-xs text-faint">
          <span>
            Forever pin <b className="font-semibold text-parchment select-text">{L.build.pin ?? "?"}</b>
          </span>
          <span>
            wago.tools <b className="font-semibold text-parchment select-text">{L.build.latest ?? "?"}</b>
          </span>
          <span>
            TOCs <b className="font-semibold text-parchment select-text">{L.build.toc}</b>
          </span>
        </p>
        <button type="button" className="btn btn-gold" onClick={onRefresh} disabled={s.busy.length > 0}>
          {s.busy.length ? `Reading ${s.busy[0]}…` : "Refresh all"}
        </button>
      </div>
    </section>
  );
}

function AddonCard({ a }: { a: Dict }) {
  const { change, copy } = useApp();
  const done = a.checks.filter((c: Dict) => c.tick === "ok").length;
  const game = a.inGame.light === "grey" ? "not tested" : a.inGame.light === "red" ? "broken" : `${done}/${a.checks.length} ok`;
  const edge = { green: "border-l-ok", amber: "border-l-amber", red: "border-l-blood", grey: "border-l-faint" }[a.light as Light];
  return (
    <article id={`card-${a.id}`} className={`panel border-l-[3px] px-5 py-4 ${edge}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-edge text-xs text-faint">{a.rank}</span>
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold text-parchment">
          {a.name}
          <span className="ml-2 font-mono text-xs font-normal text-faint select-text">{a.slash}</span>
        </h3>
        <Dot light={a.light} />
      </div>
      <Chips>
        <Chip light={a.readiness.light}>{WORD[a.readiness.light as Light]}</Chip>
        {a.version && <Chip>v{a.version}</Chip>}
        {a.ci && <Chip light={a.ci === "success" ? "green" : "red"}>CI {a.ci === "success" ? "✓" : a.ci}</Chip>}
        {a.zip && (
          <Chip light={a.zip.mark === "✓" ? "green" : "amber"} title={a.zip.text}>
            {a.zip.mark === "✓" ? "zip current" : /^none/.test(a.zip.text) ? "no zip" : "zip behind"}
          </Chip>
        )}
        <Chip light={a.inGame.light === "grey" ? undefined : a.inGame.light}>in game: {game}</Chip>
      </Chips>
      <Reasons v={a.readiness} />
      <ul className="mt-3 flex flex-col divide-y divide-edge/70 border-t border-edge/70">
        {a.checks.map((c: Dict) => (
          <li key={c.id} className="py-2.5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-parchment select-text">{c.look}</p>
                <p className="mt-0.5 text-[13px] text-faint select-text">{c.ok}</p>
              </div>
              <div role="group" aria-label={c.look} className="flex shrink-0 overflow-hidden rounded-lg border border-edge">
                {(["ok", "broken"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={c.tick === v}
                    onClick={() => change({ op: "tick", key: `${a.id}/${c.id}`, value: c.tick === v ? "untested" : v })}
                    className={`h-8 px-3 text-[13px] transition-colors ${c.tick === v ? (v === "ok" ? "bg-ok/20 text-ok" : "bg-blood/20 text-blood") : "bg-stone-2 text-dim hover:text-parchment"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {c.tick === "broken" && (
              <div className="mt-2 rounded-lg border border-blood/30 bg-blood/5 px-3 py-2 text-[13px] text-dim select-text">
                <b className="text-parchment">If it's broken:</b> {c.todo}
                <p className="mt-1 text-faint">Fixed by: {c.fix}</p>
                <button type="button" className="btn btn-ghost mt-1.5 h-7 px-2 text-xs" onClick={() => copy(`${a.name}: ${c.look}: `, "Copied: it starts a note")}>
                  Copy a note start
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-faint select-text">{a.risk}</p>
      <div className="mt-3 flex gap-2">
        <StoreDry repo={a.id} />
      </div>
    </article>
  );
}

function StoreDry({ repo }: { repo: string }) {
  const { toast } = useApp();
  const [run, setRun] = useState<string>();
  const go = async () => {
    setRun("Reading CurseForge, Wago and GitHub. Nothing is saved…");
    try {
      const r = await call<Dict>("/api/action", { name: "store-dry", repo });
      setRun((r.ok ? "" : "(exit non-zero)\n") + r.out);
    } catch (e) {
      setRun(undefined);
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };
  return (
    <>
      <button type="button" className="btn btn-ghost h-8 border-edge px-3 text-[13px]" onClick={go}>
        Store page dry run
      </button>
      {run !== undefined && (
        <Modal title={`Store page dry run: ${repo}`} onClose={() => setRun(undefined)}>
          <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-dim select-text">{run}</pre>
        </Modal>
      )}
    </>
  );
}

function Timeline({ L }: { L: Dict }) {
  const { change } = useApp();
  return (
    <Box title="Timeline">
      <ol className="flex flex-col gap-3">
        {L.timeline.map((t: Dict) => (
          <li key={t.id} className={`flex gap-3 ${t.done ? "opacity-50" : t.past && !t.next ? "opacity-80" : ""}`}>
            <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#c9a227]" checked={t.done} onChange={(e) => change({ op: "step", id: t.id, done: e.target.checked })} aria-label={t.title} />
            <div className="min-w-0">
              <p className={`text-xs ${t.next ? "text-gold" : "text-faint"}`}>
                {when(t.at)}
                {t.next ? " · next" : ""}
              </p>
              <p className={`font-medium text-parchment ${t.done ? "line-through" : ""}`}>{t.title}</p>
              <p className="text-[13px] text-dim select-text">{t.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Box>
  );
}

function Systems({ L, toast }: { L: Dict; toast: (t: string, tone?: "ok" | "error") => void }) {
  const { state, reload } = useApp();
  const ages = state!.ages;
  const age = (k: string) => (ages[k] ? (ages[k].error ? "failed" : ago(ages[k].at)) : "not read yet");
  const rows: [string, Dict, string[]?][] = [
    ["Forever build", L.build],
    ["Data chain", L.chain],
    ["Site and inbox", L.infra, L.infra.reasons.length ? undefined : (L.infra.probes ?? []).map((p: Dict) => `${p.name} ${p.status} · ${p.ms} ms`)],
    ["Board", L.board],
    ["Readings", L.sources],
  ];
  const setCard = async (id: string, status: string) => {
    try {
      const r = await call<Dict>("/api/action", { name: "card", id, status });
      if (!r.ok) toast(r.out || "The board said no", "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
    await reload();
  };
  return (
    <Box title="Systems" age={`build ${age("latest")} · runs ${age("status")} · preflight ${age("preflight")}`}>
      <ul className="flex flex-col gap-3">
        {rows.map(([name, v, extra]) => (
          <li key={name} className="flex gap-3">
            <Dot light={v.light} className="mt-1.5" />
            <div className="min-w-0">
              <p className="font-medium text-parchment">{name}</p>
              <div className="text-[13px] text-dim select-text">{(extra ?? (v.reasons.length ? v.reasons : ["all clear"])).map((r: string, i: number) => <p key={i}>{r}</p>)}</div>
            </div>
          </li>
        ))}
      </ul>
      {L.board.cards.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-edge/70 pt-3">
          {L.board.cards.map((c: Dict) => (
            <li key={c.id} className="flex items-center justify-between gap-3 text-[13px] text-dim">
              <span className="min-w-0 truncate" title={c.title}>
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
      )}
    </Box>
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
    <Box title="What broke">
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <div className="flex gap-2">
          <select className="field min-w-0 flex-1" value={addon} onChange={(e) => setAddon(e.target.value)} aria-label="Addon">
            {L.addons.map((a: Dict) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="other">Something else</option>
          </select>
          <select className="field" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
            {["bug", "blocker", "nit"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <textarea className="field h-24 resize-y py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="What you saw, what you did, the error text" aria-label="What broke" />
        {L.shots.error ? (
          <p className="text-xs text-faint select-text">{L.shots.error}</p>
        ) : shots.length === 0 ? (
          <p className="text-xs text-faint">No screenshot in iCloud Drive since an hour before launch.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
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
          <button type="button" className="btn btn-ghost px-2.5 text-[13px]" onClick={async () => copy(await (await fetch("/api/notes")).text(), "The night's notes are copied")}>
            <ClipboardCopy className="size-3.5" aria-hidden />
            Copy the notes
          </button>
        </div>
      </form>
      <ul className="mt-4 flex flex-col gap-2.5">
        {L.notes.length === 0 && <li className="text-[13px] text-faint">Nothing broken yet.</li>}
        {[...L.notes].reverse().map((n: Dict) => (
          <li key={n.id} className="rounded-lg border border-edge bg-black/20 px-3 py-2 text-[13px] text-dim">
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className={`rounded-full border px-1.5 ${n.severity === "blocker" ? "border-blood/60 text-blood" : n.severity === "bug" ? "border-amber/50 text-amber" : "border-edge text-faint"}`}>{n.severity}</span>
              <b className="font-semibold text-parchment">{name(n.addon)}</b>
              <span className="text-faint">{hhmm(n.at)}</span>
              <button type="button" className="btn btn-ghost -mr-1 ml-auto h-6 px-1.5" aria-label="Delete note" onClick={() => change({ op: "drop", id: n.id })}>
                <X className="size-3.5" />
              </button>
            </div>
            <p className="select-text">{n.text}</p>
            {n.shot && <img src={`/api/shot?f=${encodeURIComponent(n.shot)}`} alt="screenshot" loading="lazy" className="mt-2 rounded-md border border-edge" />}
          </li>
        ))}
      </ul>
    </Box>
  );
}

function Questions({ L }: { L: Dict }) {
  return (
    <Box title="Open questions">
      <ul className="flex flex-col gap-4">
        {L.questions.map((q: Dict) => (
          <Question key={q.id} q={q} />
        ))}
      </ul>
    </Box>
  );
}

function Question({ q }: { q: Dict }) {
  const { change } = useApp();
  // (typed here and saved when the field is left, so a reading never eats a word)
  const [text, setText] = useState(q.text);
  useEffect(() => setText(q.text), [q.text]);
  return (
    <li>
      <label className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#c9a227]" checked={q.done} onChange={(e) => change({ op: "answer", id: q.id, done: e.target.checked, text })} />
        <span className="font-medium text-parchment">{q.title}</span>
      </label>
      <p className="mt-1 text-[13px] text-dim select-text">{q.ask}</p>
      <p className="mt-0.5 flex items-start gap-1.5 text-[13px] text-faint select-text">
        <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {q.ok}
      </p>
      <input className="field mt-2 w-full" value={text} maxLength={1000} placeholder="What you saw" aria-label={`Answer: ${q.title}`} onChange={(e) => setText(e.target.value)} onBlur={() => text !== q.text && change({ op: "answer", id: q.id, done: q.done, text })} />
    </li>
  );
}

function ForeverData({ L }: { L: Dict }) {
  const { state } = useApp();
  const d = L.data;
  const k = d.kinds ?? {};
  return (
    <Box title="Forever data" age={state!.ages["launch-data"] ? ago(state!.ages["launch-data"].at) : "not read yet"}>
      {d.error && !d.zones ? (
        <p className="text-[13px] text-faint select-text">{d.error}</p>
      ) : (
        <>
          <table className="w-full text-[13px]">
            <tbody>
              {(d.zones ?? []).map((z: Dict) => (
                <tr key={z.zone}>
                  <td className="py-0.5 text-dim">{z.zone} quests</td>
                  <td className={`py-0.5 text-right tabular-nums ${z.quests ? "text-parchment" : "text-faint"}`}>{z.quests}</td>
                </tr>
              ))}
              {(
                [
                  ["Factions", k.faction],
                  ["Creatures", k.creature],
                  ["Quests in all", k.quest],
                ] as const
              ).map(([n, v]) => (
                <tr key={n}>
                  <td className="py-0.5 text-dim">{n}</td>
                  <td className="py-0.5 text-right text-parchment tabular-nums">{v ?? "?"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2.5 text-xs text-faint select-text">
            forever.db built {String(d.builtAt ?? "").slice(0, 10)} at build {d.pins ?? "?"}. These are what Codex wave 2 and Goodwill's Forever factions wait on.
          </p>
        </>
      )}
    </Box>
  );
}
