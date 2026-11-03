import { CheckCircle2, Copy, ExternalLink, X, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useApp, type Light, type Verdict } from "@/lib/api";
import { WORD } from "@/lib/format";

/** A light's mark: its shape says what its colour says. */
export function Dot({ light, className = "" }: { light: Light; className?: string }) {
  return <span role="img" aria-label={WORD[light]} title={WORD[light]} className={`mark mark-${light} ${className}`} />;
}

/** A page's title and what it is for. */
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

export function Section({ title, empty, children }: { title: string; empty?: string; children?: ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="mb-3 text-xs font-semibold tracking-[0.12em] text-faint uppercase">{title}</h2>
      {has ? <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{children}</div> : <p className="text-dim">{empty ?? "Nothing here."}</p>}
    </section>
  );
}

/** A row of the page: a light, a name, and what it says. */
export function Card({ light, title, small, children, tools }: { light: Light; title: string; small?: string; children?: ReactNode; tools?: ReactNode }) {
  const edge = { green: "border-l-ok", amber: "border-l-amber", red: "border-l-blood", grey: "border-l-faint" }[light];
  return (
    <article className={`panel min-w-0 border-l-[3px] px-4 py-3.5 ${edge}`}>
      <div className="flex items-center gap-2.5">
        <Dot light={light} />
        <h3 className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere] text-parchment">
          {title}
          {small && <span className="ml-2 font-mono text-xs font-normal text-faint select-text">{small}</span>}
        </h3>
      </div>
      {children}
      {tools && <div className="mt-3 flex flex-wrap gap-2">{tools}</div>}
    </article>
  );
}

export function Said({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-[13px] text-dim select-text">{children}</p>;
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>;
}

export function Chip({ children, light, title }: { children: ReactNode; light?: Light; title?: string }) {
  const tone = light ? { green: "border-ok/40 text-ok", amber: "border-amber/45 text-amber", red: "border-blood/55 text-blood", grey: "" }[light] : "";
  return (
    <span title={title} className={`tag ${tone}`}>
      {children}
    </span>
  );
}

/** Why a light is what it is. */
export function Reasons({ v }: { v: Verdict }) {
  if (!v.reasons.length) return null;
  const tone = v.light === "red" ? "text-blood" : "text-dim";
  return (
    <ul className={`mt-2.5 flex flex-col gap-1 text-[13px] select-text ${tone}`}>
      {v.reasons.map((r, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-current opacity-60" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

/** What a page could not read or read late (a failed or cached source, a source that has not answered): a flat line under the page's intro, so old numbers are never taken for new ones. */
export function PageNote({ v }: { v: Verdict }) {
  if (!v.reasons.length) return null;
  const edge = { green: "border-edge", amber: "border-amber", red: "border-blood", grey: "border-faint" }[v.light];
  return (
    <ul className={`mt-4 flex flex-col gap-0.5 border-l-2 pl-3 text-[13px] text-dim select-text ${edge}`}>
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
    <button type="button" className="btn btn-ghost h-8 border-edge px-2.5 text-[13px]" onClick={() => copy(text, "Copied: paste it in a session")}>
      <Copy className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

export function LinkButton({ url, label }: { url?: string; label: string }) {
  const { open } = useApp();
  if (!/^https:\/\//.test(url ?? "")) return null;
  return (
    <button type="button" className="btn btn-ghost h-8 border-edge px-2.5 text-[13px]" onClick={() => open(url!)}>
      <ExternalLink className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}

/** A window over the page: a store page's dry run. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-8" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="panel fade-in flex max-h-full w-full max-w-3xl flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-edge px-5 py-3">
          <h2 className="title text-lg">{title}</h2>
          <button type="button" className="btn btn-ghost h-8 px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

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

/** Now, every `every` ms: for "2 minutes ago" and the clock to stay true. */
export function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** The place at the right end of every red or amber row for the "start a fix session" button (ideas/watchtower-fix-sessions.md). It holds the copy-prompt button today. `fix` is the server's preview for the row (server/fix.ts), absent when the light is not one a session can fix. */
export function FixSlot({ id, prompt, fix, label = "Copy prompt" }: { id: string; prompt?: string; fix?: Record<string, unknown>; label?: string }) {
  return (
    <span data-fix-slot={id} data-fixable={fix ? "true" : undefined} className="inline-flex items-center gap-2">
      <CopyButton text={prompt} label={label} />
    </span>
  );
}
