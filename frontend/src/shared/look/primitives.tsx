import type { ReactNode } from "react";

/* Ravenpost's parts (frontend/src/components/ui.tsx), the ones these pages use,
   written the same way. A new part goes here once the pages need it. */

export type Tone = "ok" | "gold" | "blood" | "faint";

/** A light: a plain dot. The words next to it say what it means. */
export function Dot({ tone, className = "" }: { tone: Tone; className?: string }) {
  const bg = { ok: "bg-ok", gold: "bg-gold", blood: "bg-blood", faint: "bg-faint" }[tone];
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${bg} ${className}`} />;
}

/** A page's title and what it is for. */
export function PageHeader({ title, intro, action }: { title: ReactNode; intro?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-60">
        <h1 className="title text-2xl max-sm:text-xl">{title}</h1>
        {intro && <p className="mt-1.5 max-w-2xl text-dim select-text">{intro}</p>}
      </div>
      {action}
    </header>
  );
}

/** A panel with a title, and what is inside it. */
export function Panel({ title, note, action, children }: { title?: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel p-5 max-sm:p-4">
      {(title || action) && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="title text-lg">{title}</h2>}
            {note && <p className="mt-0.5 max-w-2xl text-sm text-dim">{note}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Figures in one panel divided by hairlines: four across, two by two on a phone. The one big number of a page is the figure's value. */
export function Figures({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <section className="panel grid grid-cols-2 min-[900px]:grid-cols-4">
      {items.map((f, i) => (
        <div key={f.label} className={`min-w-0 px-5 py-4 max-sm:px-4 max-sm:py-3 ${i % 2 === 1 ? "border-l border-white/[0.06]" : ""} ${i >= 2 ? "border-t border-white/[0.06] min-[900px]:border-t-0" : ""} ${i >= 1 ? "min-[900px]:border-l min-[900px]:border-white/[0.06]" : ""}`}>
          <p className="text-[13px] text-dim">{f.label}</p>
          <p className="mt-0.5 text-[26px] leading-tight font-semibold tabular-nums max-sm:text-[22px]">{f.value}</p>
          {f.note && <p className="text-[13px] text-faint">{f.note}</p>}
        </div>
      ))}
    </section>
  );
}

/** What there is to look at, one plain sentence each, the dot's colour saying how much it matters, a button at the right when there is a thing to do (under the sentence on a phone). */
export function Todo({ children }: { children: ReactNode }) {
  return <ul className="mt-3 flex flex-col divide-y divide-white/[0.05]">{children}</ul>;
}
export function TodoRow({ tone, children, why, action }: { tone: Tone; children: ReactNode; why?: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 py-2.5">
      <Dot tone={tone} className="mt-[7px]" />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-parchment select-text">{children}</p>
        {why && <p className="mt-1 text-sm text-faint select-text">{why}</p>}
      </div>
      {action && <div className="shrink-0 max-sm:ml-[22px]">{action}</div>}
    </li>
  );
}

/** One control for a choice of a few (a range): a row of buttons in one frame. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="seg inline-flex overflow-hidden rounded-lg border border-edge">
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)} className={`cursor-pointer px-3 py-1.5 text-[13px] transition-colors ${v === value ? "bg-gold/[0.12] text-gold" : "text-dim hover:text-parchment"}`}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** A quiet line under a page: where the numbers come from and how old they are. */
export const Footnote = ({ children }: { children: ReactNode }) => <p className="text-[13px] text-faint select-text">{children}</p>;

/** A page's one panel when there is nothing to draw yet: a plain sentence, and what to do about it. */
export function Notice({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel p-5 max-sm:p-4">
      <h2 className="title text-lg">{title}</h2>
      <p className="mt-1.5 max-w-xl text-dim select-text">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
