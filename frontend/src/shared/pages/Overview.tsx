import { Gate } from "./gate";
import { useSummary } from "../data";
import { ago, fmt, longDay, word } from "../format";
import { Figures, Footnote, PageHeader, Panel, Todo, TodoRow, type Tone } from "../look/primitives";
import type { Summary } from "../schema";
import { useNow, useShell } from "../shell";

export type Item = { key: string; tone: Tone; text: string; why?: string; to?: [page: string, label: string] };

/**
 * What the numbers say needs a look, in plain sentences, the red ones first.
 * The failed jobs and waiting pull requests are here only for a shell that has
 * no lights of its own (the phone): on the Mac they come from GitHub itself,
 * and the same sentence twice would be noise.
 */
export function itemsOf(s: Summary, now: number, withProblems: boolean): Item[] {
  const out: Item[] = [];
  if (withProblems) {
    if (s.problems.failed) out.push({ key: "failed", tone: "blood", text: `${s.standing.title}.`, why: s.standing.line });
    else if (s.problems.waiting) out.push({ key: "waiting", tone: "gold", text: `${s.standing.title}.`, why: s.standing.line });
    if (s.problems.failed && s.problems.waiting) out.push({ key: "waiting", tone: "gold", text: `${word(s.problems.waiting)} more ${s.problems.waiting === 1 ? "thing waits" : "things wait"} for you.` });
  }
  if (s.commentsWaiting) out.push({ key: "comments", tone: "gold", text: `${word(s.commentsWaiting)} ${s.commentsWaiting === 1 ? "comment waits" : "comments wait"} for your answer.`, to: ["comments", "Open comments"] });
  for (const w of s.warnings) out.push({ key: w.key, tone: w.level === "good" ? "ok" : "gold", text: w.title.replace(/[.]$/, "") + ".", why: w.line });
  if (s.unique.stale && s.unique.at) out.push({ key: "unique", tone: "gold", text: "CurseForge's people counts are old.", why: `The last ones are from ${s.unique.through ? longDay(s.unique.through) : ago(s.unique.at, now)}. Paste a fresh CurseForge cookie into the settings on Vercel.` });
  const rank = (i: Item) => (i.tone === "blood" ? 0 : i.tone === "gold" ? 1 : 2);
  return out.map((i, k) => [i, k] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([i]) => i);
}

/** The figures of the overview: what the numbers said last, and what has come in so far today. */
export function figuresOf(s: Summary): { label: string; value: string; note: string }[] {
  const f = s.figures;
  const pick = (today: number | null, last: number | null, onToday: string, onLast: string) => (today !== null ? { value: fmt(today), note: onToday } : last !== null ? { value: fmt(last), note: onLast } : { value: "–", note: "not counted yet" });
  return [
    { label: "Downloads", value: fmt(f.downloads.total), note: f.downloads.today !== null ? `${fmt(f.downloads.today)} so far today` : "every addon, every store" },
    { label: "Ravenpost in use", ...pick(f.installs.today, f.installs.last, "installs today so far", "installs on the last day counted") },
    { label: "Facts shared", ...pick(f.facts.today, f.facts.last, "facts today so far", "facts on the last day counted") },
    { label: "Visitors", ...pick(f.visitors.today, f.visitors.last, "so far today, on the sites", "on the sites, last day counted") },
  ];
}

/** How many of the items need a look: good news is shown but not counted. */
export const toLookAt = (items: Item[]) => items.filter((i) => i.tone !== "ok").length;

export function title(n: number): string {
  return n === 0 ? "Nothing waits for you" : `${word(n)} ${n === 1 ? "thing" : "things"} to look at`;
}

export function Overview() {
  const shell = useShell();
  const now = useNow();
  const load = useSummary();
  return (
    <div className="flex flex-col gap-4">
      <Gate load={load}>
        {({ data: s, at }) => {
          const items = itemsOf(s, now, !shell.can.has("localLights"));
          return (
            <>
              <PageHeader title={title(toLookAt(items))} intro={toLookAt(items) === 0 ? s.standing.line : undefined} />
              {items.length > 0 && (
                <Panel title="To do" note="The red ones stop a release or a push. The others are worth a look.">
                  <Todo>
                    {items.map((i) => (
                      <TodoRow
                        key={i.key}
                        tone={i.tone}
                        why={i.why}
                        action={
                          i.to && (
                            <button type="button" className="btn" onClick={() => shell.go(i.to![0])}>
                              {i.to[1]}
                            </button>
                          )
                        }
                      >
                        {i.text}
                      </TodoRow>
                    ))}
                  </Todo>
                </Panel>
              )}
              <Figures items={figuresOf(s)} />
              <Footnote>
                {s.through ? `The numbers run through ${longDay(s.through)}. ` : "No daily numbers yet. "}Read {ago(at, now)}.
              </Footnote>
            </>
          );
        }}
      </Gate>
    </div>
  );
}
