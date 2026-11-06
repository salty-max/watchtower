import { useState } from "react";
import { BarChart, dayAxis, type Bar, type Mark } from "../chart";
import { Gate } from "./gate";
import { useLoad } from "../data";
import { ago, fmt, shortDay } from "../format";
import { Figures, Footnote, PageHeader, Panel, Segmented } from "../look/primitives";
import type { Numbers, Range } from "../schema";
import { useNow } from "../shell";

export type Span = "24h" | Range;
const SPANS = [["24h", "24 hours"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "All"]] as const;
const SPAN_WORDS: Record<Span, string> = { "24h": "In 24 hours", "7": "In 7 days", "30": "In 30 days", "90": "In 90 days", all: "Since the first count" };

const sumOf = (xs: (number | null)[]) => xs.reduce<number>((t, v) => t + (v ?? 0), 0);
const lastOf = (xs: (number | null)[]) => [...xs].reverse().find((v) => v !== null) ?? null;

export type Row = { name: string; span: number | null; people: number | null; all: number; rank: number | null };
export type View = {
  bars: Bar[];
  marks: Mark[];
  axis: [number, string][];
  /** The four figures. */
  figures: { label: string; value: string; note: string }[];
  rows: Row[];
  /** Days of CurseForge's own count alone are in the chart. */
  earlyDays: boolean;
};

/** What the page draws, from one answer: the chart's bars, the four figures and the table's rows. The numbers' own arithmetic is the server's: this only adds up what it sent. */
export function viewOf(n: Numbers, span: Span): View {
  const d = n.downloads;
  const hour = span === "24h";
  const lastHours = Math.max(0, n.hourly.hours.length - 24);
  let bars: Bar[];
  let marks: Mark[] = [];
  let axis: [number, string][];
  if (hour) {
    const series = Object.values(n.hourly.series);
    bars = n.hourly.hours.slice(lastHours).map((h, i) => {
      const vs = series.map((s) => s[lastHours + i]).filter((v): v is number => v !== null);
      return { key: h, value: vs.length ? sumOf(vs) : null, label: `${h.slice(11, 13)}:00` };
    });
    axis = [0, 6, 12, 18, bars.length - 1].filter((i, k, a) => i >= 0 && i < bars.length && a.indexOf(i) === k).map((i) => [i, bars[i].label] as [number, string]);
  } else {
    bars = n.days.map((day, i) => {
      const vs = d.addons.map((a) => d.daily[a]?.[i] ?? null).filter((v): v is number => v !== null);
      return { key: day, value: vs.length ? sumOf(vs) : null, label: shortDay(day), faded: d.early[i] };
    });
    marks = n.marks.map((m) => ({ index: n.days.indexOf(m.day), text: m.text })).filter((m) => m.index >= 0);
    axis = dayAxis(n.days);
  }
  const counted = bars.filter((b) => b.value !== null);
  const best = counted.reduce<Bar | null>((a, b) => (a === null || (b.value ?? 0) > (a.value ?? 0) ? b : a), null);
  const bestMarks = best && !hour ? n.marks.filter((m) => m.day === best.key).map((m) => m.text) : [];
  const total = Object.values(d.totals).reduce((a, b) => a + b, 0);
  const inSpan = span === "all" ? total : sumOf(bars.map((b) => b.value));
  const people = span === "7" || span === "30" || span === "90" ? Object.values(n.periods).reduce((t, p) => t + (p[span]?.unique ?? 0), 0) : null;
  const stores = ["curseforge", "wago", "github"] as const;
  const store = (k: (typeof stores)[number]) => sumOf(d.stores[k]);
  const allStores = stores.reduce((t, k) => t + store(k), 0);
  const first = n.days[0];
  const rows: Row[] = d.addons
    .map((name) => {
      const hourly = n.hourly.series[name];
      return {
        name,
        span: hour ? (hourly ? sumOf(hourly.slice(lastHours)) : null) : span === "all" ? (d.totals[name] ?? null) : sumOf(d.daily[name] ?? []),
        people: span === "7" || span === "30" || span === "90" ? (n.periods[name]?.[span]?.unique ?? null) : null,
        all: d.totals[name] ?? 0,
        rank: lastOf(n.rank[name] ?? []),
      };
    })
    .sort((a, b) => (b.span ?? -1) - (a.span ?? -1) || b.all - a.all);
  return {
    bars,
    marks,
    axis,
    earlyDays: !hour && d.early.some(Boolean),
    figures: [
      { label: SPAN_WORDS[span], value: fmt(inSpan), note: hour ? "CurseForge only" : !first ? "no days counted yet" : span === "all" ? `since ${shortDay(first)}` : `${shortDay(first)} to ${shortDay(n.days.at(-1)!)}` },
      { label: "Different people", value: people === null ? "–" : fmt(people), note: people === null ? "counted over 7, 30 or 90 days" : "CurseForge, added up by addon" },
      { label: hour ? "Best hour" : "Best day", value: best ? fmt(best.value ?? 0) : "–", note: best ? [best.label, ...bestMarks].join(", ") : "nothing counted" },
      { label: "On CurseForge", value: hour || !allStores ? "–" : `${Math.round((store("curseforge") / allStores) * 100)}%`, note: hour ? "an hour's counts are CurseForge only" : "of every store's downloads" },
    ],
    rows,
  };
}

const cell = (n: number | null) => (n === null ? "–" : fmt(n));

export function Downloads() {
  const now = useNow();
  const [span, setSpan] = useState<Span>("30");
  const api: Range = span === "24h" ? "7" : span;
  const load = useLoad((d) => d.numbers(api), `numbers-${api}`);
  return (
    <div className="flex flex-col gap-4">
      <Gate load={load}>
        {({ data: n }) => {
          const v = viewOf(n, span);
          const total = Object.values(n.downloads.totals).reduce((a, b) => a + b, 0);
          const hour = span === "24h";
          return (
            <>
              <PageHeader
                title="Downloads"
                intro={`${fmt(total)} in all${n.hourly.today !== null ? `, ${fmt(n.hourly.today)} so far today` : ""}.`}
                action={<Segmented label="Range" options={SPANS} value={span} onChange={setSpan} />}
              />
              <Figures items={v.figures} />
              <Panel
                title={hour ? "An hour at a time" : "A day at a time"}
                note={hour ? "Every addon on CurseForge, an hour at a time. Wago and GitHub keep daily totals only." : `Every addon, every store.${v.marks.length ? " Gold ticks mark a release." : ""}${v.earlyDays ? " The paler days are CurseForge's own count alone." : ""}`}
              >
                <BarChart bars={v.bars} marks={v.marks} axis={v.axis} unit={hour ? "an hour" : "a day"} what={hour ? "Downloads an hour" : "Downloads a day"} />
              </Panel>
              <Panel title="By addon">
                <table className="tbl mt-2">
                  <thead>
                    <tr>
                      <th>Addon</th>
                      <th>{SPAN_WORDS[span]}</th>
                      <th>People</th>
                      <th>All time</th>
                      <th>Rank on CurseForge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.rows.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td data-label={SPAN_WORDS[span].toLowerCase()}>{cell(r.span)}</td>
                        <td data-label="people" className="text-dim">
                          {cell(r.people)}
                        </td>
                        <td data-label="all time" className="text-dim">
                          {cell(r.all)}
                        </td>
                        <td data-label="rank" className="text-dim">
                          {r.rank === null ? "–" : `#${fmt(r.rank)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
              <Footnote>
                Download events, not players: one person downloading twice counts twice. CurseForge and Wago are read every ten minutes, GitHub every hour.
                {n.checkedAt ? ` Last read ${ago(n.checkedAt, now)}.` : ""}
              </Footnote>
            </>
          );
        }}
      </Gate>
    </div>
  );
}
