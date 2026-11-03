import { CheckCircle2, Copy, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp, type Light, type Verdict } from "@/lib/api";

/** A light: a plain dot. The words next to it say what it means. */
export function Dot({ light, className = "" }: { light: Light; className?: string }) {
  const bg = { green: "bg-ok", amber: "bg-gold", red: "bg-blood", grey: "bg-faint" }[light];
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${bg} ${className}`} />;
}

/** An on/off switch (role switch): what a checkbox is, in a window. Ravenpost's own. */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-40 ${on ? "border-gold-soft bg-gold-soft/80" : "border-edge bg-stone-3"}`}
    >
      <span className={`inline-block size-3.5 rounded-full shadow transition-transform ${on ? "translate-x-[18px] bg-night" : "translate-x-[3px] bg-dim"}`} />
    </button>
  );
}

/** A page's title and what it is for. Ravenpost's own. */
export function PageHeader({ title, intro, action }: { title: string; intro?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="title text-2xl">{title}</h1>
        {intro && <p className="mt-1.5 max-w-2xl text-dim">{intro}</p>}
      </div>
      {action}
    </header>
  );
}

/** A panel with a title, and rows inside. */
export function Panel({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="title text-lg">{title}</h2>
          {note && <p className="mt-0.5 max-w-2xl text-sm text-dim">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Why a light is what it is. */
export function Reasons({ v }: { v: Verdict }) {
  if (!v.reasons.length) return null;
  return (
    <ul className={`mt-2 flex flex-col gap-1 text-sm select-text ${v.light === "red" ? "text-blood" : "text-dim"}`}>
      {v.reasons.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ul>
  );
}

export function CopyButton({ text, label = "Copy prompt" }: { text?: string; label?: string }) {
  const { copy } = useApp();
  if (!text) return null;
  return (
    <button type="button" className="btn h-8 px-3 text-[13px]" onClick={() => copy(text, "Copied. Paste it in a session.")}>
      <Copy className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

/** A window over the page (a store page's dry run, a fix's preview). `locked`: a start is in flight, so neither Escape nor a click outside closes it. */
export function Modal({ title, onClose, locked, children }: { title: string; onClose: () => void; locked?: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  // (focus goes back to what opened the window, and Tab stays inside it)
  useEffect(() => {
    const was = document.activeElement as HTMLElement | null;
    return () => {
      if (was?.isConnected) was.focus();
    };
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) return onClose();
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input, textarea, [href]")];
      if (!f.length) return e.preventDefault();
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) (e.preventDefault(), f[f.length - 1].focus());
      else if (!e.shiftKey && (i === -1 || i === f.length - 1)) (e.preventDefault(), f[0].focus());
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose, locked]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-8" onClick={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="panel fade-in flex max-h-full w-full max-w-3xl flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-edge px-5 py-3">
          <h2 className="title text-lg">{title}</h2>
          <button type="button" className="btn btn-ghost h-8 px-2" onClick={onClose} disabled={locked} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** The toasts, bottom right: what was copied, what went wrong. Ravenpost's own. */
export function Toasts() {
  const { toasts } = useApp();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-[22rem] flex-col gap-2">
      {toasts.map((x) => (
        <div key={x.id} className={`panel fade-in flex items-start gap-2.5 px-3.5 py-3 ${x.tone === "error" ? "border-blood/50" : "border-ok/40"}`}>
          {x.tone === "error" ? <XCircle className="mt-px size-4 shrink-0 text-blood" aria-hidden /> : <CheckCircle2 className="mt-px size-4 shrink-0 text-ok" aria-hidden />}
          <span className="select-text">{x.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Now, every 30 s: for "2 minutes ago" to stay true. */
export function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}
