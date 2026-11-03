import { useEffect, useRef, useState } from "react";
import { CopyButton, Modal } from "@/components/ui";
import { call, useApp, type Dict } from "@/lib/api";

/** The server's view of a fixable light (server/fix.ts FixView). Every string in it is untrusted text: drawn as text, never as markup or a link. */
export type Fix = { key: string; kind: string; repo: string; repos: string[]; title: string; page: string; state: "offered" | "refused" | "running" | "waiting" | "ready-to-push" | "tried"; reason?: string; id?: string; card?: { id: string; status: string }; again?: boolean; attach?: string };

type Preview = { token: string; title: string; model: string; repos: string[]; prompt: string; reportsTo: string; launchLine?: string; expiresAt: number };

const MODEL: Record<string, string> = { opusplan: "opusplan (Sonnet, Opus in plan mode)", opus: "opus (Opus)" };

/** What the "start a fix session" button of a red or amber row is, by the fix's state (ideas/watchtower-fix-sessions.md). It starts nothing itself: the dialog previews the exact prompt, and only its second press starts a session. */
export function FixButton({ fix }: { fix: Fix }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState<string>();
  const quiet = "text-xs text-faint";
  // (the dialog stays mounted whatever the row's state becomes under it: a poll that turns the row to "running" must not swallow a start's error)
  const dialog = open && <FixDialog fix={fix} onClose={() => setOpen(false)} onStarted={(id) => setStarted(id)} />;
  const body = (() => {
  if (fix.state === "offered") {
    return (
      <>
        <button type="button" className="btn h-8 border-edge-gold px-3 text-[13px] text-gold" onClick={() => setOpen(true)}>
          Fix…
        </button>
      </>
    );
  }
  if (fix.state === "refused") return <span className={`${quiet} max-w-[16rem] text-right`}>{fix.reason}</span>;
  if (fix.state === "tried") {
    return fix.again ? (
      <>
        <span className={quiet}>Tried, still red</span>
        <button type="button" className="btn h-8 px-3 text-[13px]" onClick={() => setOpen(true)}>
          Start again
        </button>
      </>
    ) : (
      <span className={`${quiet} max-w-[16rem] text-right`}>{fix.reason}</span>
    );
  }
  return <Running fix={fix} />;
  })();
  return (
    <>
      {body}
      {started !== undefined && <span className={quiet}>Started as {started || "a new session"}</span>}
      {dialog}
    </>
  );
}

function Running({ fix }: { fix: Fix }) {
  const { copy } = useApp();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // (the route is the fix build's F4: until the server serves it the call answers an error, shown here)
  const attach = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await call("/api/fix/attach", { key: fix.key });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const word = fix.state === "ready-to-push" ? "fix ready to push" : `fix ${fix.card?.status ?? "starting"}`;
  return (
    <span className="flex flex-wrap items-center justify-end gap-2" data-fix-state={fix.state}>
      <span className={`rounded border px-2 py-0.5 text-xs ${fix.state === "ready-to-push" ? "border-ok/50 text-ok" : "border-edge text-dim"}`}>
        {fix.id && <span className="mr-1.5 font-mono select-text">{fix.id}</span>}
        {word}
      </span>
      {fix.attach && (
        <>
          <button type="button" className="btn btn-ghost h-7 border-edge px-2 text-xs" disabled={busy} onClick={attach}>
            Attach
          </button>
          <button type="button" className="btn btn-ghost h-7 border-edge px-2 text-xs" onClick={() => copy(fix.attach!, "Copied: paste it in Terminal")}>
            Copy attach command
          </button>
        </>
      )}
      {error && <span className="basis-full text-right text-xs text-blood select-text">{error}</span>}
    </span>
  );
}

/** The preview (nothing started), then the second press. Closed by Escape or a click outside, never while a start is in flight. */
function FixDialog({ fix, onClose, onStarted }: { fix: Fix; onClose: () => void; onStarted: (id: string) => void }) {
  const { state, reload } = useApp();
  const [pv, setPv] = useState<Preview>();
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [expired, setExpired] = useState(false);
  const asked = useRef(false);
  const seq = useRef(0);
  const dispatchers = ((state as Dict).dispatchers ?? []) as { sessionId: string; name: string; status?: string; likely?: boolean }[];
  const chosen = (state as Dict).dispatcher as string | null | undefined;

  const preview = async () => {
    const mine = ++seq.current; // (an older answer that lands late is a dead token: ignored)
    setPv(undefined);
    setError(undefined);
    setExpired(false);
    try {
      const p = await call<Preview>("/api/fix/preview", { key: fix.key });
      if (mine === seq.current) setPv(p);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : String(e));
    }
  };
  // (once, on open: never on mount of the page, hover, a notification or a timer)
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void preview();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the token lives five minutes: one timeout to its end, not a ticking clock
  useEffect(() => {
    if (!pv) return;
    const left = pv.expiresAt - Date.now();
    if (left <= 0) return setExpired(true);
    const id = setTimeout(() => setExpired(true), left);
    return () => clearTimeout(id);
  }, [pv]);

  const choose = async (session: string) => {
    seq.current++;
    setPv(undefined); // (the old preview names the old dispatcher: it cannot be started while the choice is made)
    try {
      await call("/api/fix/dispatcher", { session });
      await reload();
      await preview();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const start = async () => {
    if (!pv || starting || expired) return;
    setStarting(true);
    try {
      const r = await call<Dict>("/api/fix/start", { token: pv.token });
      onStarted(String(r.id ?? ""));
      void reload();
      onClose();
    } catch (e) {
      // (the token is spent whatever the result: the way on is a new preview)
      setError(e instanceof Error ? e.message : String(e));
      setPv(undefined);
      setStarting(false);
    }
  };

  return (
    <Modal title={fix.title} onClose={onClose} locked={starting}>
      {!pv && !error && <p className="text-dim">Preparing the preview. Nothing is started.</p>}
      {error && (
        <div className="mb-4 border-l-2 border-blood pl-3">
          <p className="text-blood select-text">{error}</p>
          <button type="button" className="btn mt-2 h-8 px-3 text-[13px]" onClick={preview}>
            Preview again
          </button>
        </div>
      )}
      {pv && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2 text-[13px]">
            <dt className="text-faint">Writes to</dt>
            <dd className="flex flex-wrap gap-1.5">
              {pv.repos.map((r) => (
                <span key={r} className="tag select-text">{r}</span>
              ))}
            </dd>
            <dt className="text-faint">Model</dt>
            <dd className="text-parchment select-text">{MODEL[pv.model] ?? pv.model}</dd>
            <dt className="text-faint">Reports to</dt>
            <dd className="flex flex-wrap items-center gap-2 text-parchment">
              <span className="select-text">{pv.reportsTo}</span>
              {dispatchers.length > 1 && (
                <select className="field h-8 text-[13px]" aria-label="Report to another session" value={chosen ?? ""} disabled={starting} onChange={(e) => choose(e.target.value)}>
                  {!chosen && <option value="">choose</option>}
                  {dispatchers.map((d) => (
                    <option key={d.sessionId} value={d.sessionId}>
                      {d.name}
                      {d.likely ? " (likely)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </dd>
          </dl>
          {pv.launchLine && <p className="border-l-2 border-amber pl-3 text-[13px] text-amber select-text">{pv.launchLine}</p>}
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">The prompt, exactly as sent</p>
            <pre className="max-h-72 overflow-auto rounded border border-edge bg-black/30 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-dim select-text">{pv.prompt}</pre>
          </div>
          {expired && (
            <p className="text-[13px] text-amber">
              Preview expired.{" "}
              <button type="button" className="underline" onClick={preview}>
                Preview again
              </button>
            </p>
          )}
        </div>
      )}
      <div className="mt-5 flex items-center justify-end gap-2">
        {pv && <CopyButton text={pv.prompt} label="Copy prompt" />}
        <button type="button" autoFocus className="btn" onClick={onClose} disabled={starting}>
          Cancel
        </button>
        {pv && (
          <button type="button" className="btn btn-gold" disabled={starting || expired} onClick={start}>
            {starting ? "Starting…" : "Start session"}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** The place at the right end of every red or amber row for the "start a fix session" button. `fix` is the server's view of the row's light (server/fix.ts), absent when it is not one a session can fix: then the slot holds the copy-prompt button alone. */
export function FixSlot({ id, prompt, fix, label = "Copy prompt" }: { id: string; prompt?: string; fix?: Record<string, unknown>; label?: string }) {
  const f = fix as Fix | undefined;
  // (a prompt for a fix already under way would start a second one by hand: shown again once it has ended)
  const active = f && (f.state === "running" || f.state === "waiting" || f.state === "ready-to-push");
  return (
    <span data-fix-slot={id} data-fixable={f ? "true" : undefined} data-fix-state={f?.state} className="inline-flex flex-wrap items-center justify-end gap-2">
      {f && <FixButton fix={f} />}
      {!active && <CopyButton text={prompt} label={label} />}
    </span>
  );
}
