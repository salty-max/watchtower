import { useState } from "react";
import { fmt, niceMax, shortDay } from "./format";

/**
 * One bar chart: a bar for each day (or hour), the tallest rounded up so no
 * bar touches the top, gold ticks under the days with a release. The labels
 * are real text (not SVG scaled down on a phone), the bars are boxes. Touch or
 * hover a bar and the line above tells its value.
 */
export type Bar = { key: string; value: number | null; label: string; faded?: boolean };
export type Mark = { index: number; text: string };

export function BarChart({ bars, marks = [], axis, unit, what }: { bars: Bar[]; marks?: Mark[]; axis: [number, string][]; unit: string; what: string }) {
  const [at, setAt] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...bars.map((b) => b.value ?? 0)));
  const n = bars.length;
  const here = at === null ? null : bars[at];
  return (
    <div>
      <p className="mt-2 min-h-5 text-[13px] text-dim" aria-live="polite">
        {here ? `${here.label}: ${here.value === null ? "no count" : `${fmt(here.value)} ${unit}`}` : ""}
      </p>
      <div className="relative mt-1 ml-0 flex" role="img" aria-label={`${what}, ${n} bars, tallest ${fmt(Math.max(0, ...bars.map((b) => b.value ?? 0)))}`}>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-px w-full bg-edge" />
          ))}
        </div>
        <span className="absolute -top-5 right-0 text-xs text-faint" aria-hidden>
          {fmt(top)}
        </span>
        <div className="relative flex h-40 w-full items-end gap-[3px] max-sm:h-32" onPointerLeave={() => setAt(null)}>
          {bars.map((b, i) => (
            <div key={b.key} className="flex h-full min-w-0 flex-1 items-end" onPointerEnter={() => setAt(i)} onPointerDown={() => setAt(i)}>
              <div className={`w-full rounded-[2px] ${i === n - 1 ? "bg-gold" : at === i ? "bg-gold-soft" : b.faded ? "bg-gold-soft/35" : "bg-gold-soft/70"}`} style={{ height: `${b.value ? Math.max(1, (b.value / top) * 100) : 0}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-1 h-3" aria-hidden>
        {marks.map((m) => (
          <span key={`${m.index}-${m.text}`} title={m.text} className="absolute top-0 size-0 -translate-x-1/2 border-x-4 border-b-[7px] border-x-transparent border-b-gold" style={{ left: `${((m.index + 0.5) / n) * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-5 text-xs text-faint" aria-hidden>
        {axis.map(([i, text], k) => (
          <span key={`${i}-${text}`} className="absolute whitespace-nowrap" style={k === axis.length - 1 ? { right: 0 } : { left: `${(i / n) * 100}%` }}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Five labels along the days: about evenly spaced, the last at the right edge. */
export function dayAxis(days: string[]): [number, string][] {
  if (days.length < 2) return days.map((d, i) => [i, shortDay(d)]);
  const steps = Math.min(4, days.length - 1);
  const out: [number, string][] = [];
  for (let k = 0; k < steps; k++) out.push([Math.round((k * (days.length - 1)) / steps), shortDay(days[Math.round((k * (days.length - 1)) / steps)])]);
  out.push([days.length - 1, shortDay(days[days.length - 1])]);
  return out;
}
