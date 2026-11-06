/** Numbers and times as the owner reads them: British grouping, short dates, "3 min ago". Nothing here knows a page. */
export const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-05" as "5 Nov". */
export const shortDay = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
/** "2026-11-03" as "3 November". */
export const longDay = (d: string) => `${Number(d.slice(8, 10))} ${FULL[Number(d.slice(5, 7)) - 1]}`;

export function ago(iso: string | number, now: number): string {
  const m = Math.round((now - (typeof iso === "number" ? iso : Date.parse(iso))) / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}


const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
/** A small count as a word at the start of a sentence ("Two", "11"). */
export const word = (n: number) => WORDS[n] ?? fmt(n);

/** A chart's top: the next 1, 2, 5 or 10 times a power of ten at or above `max` (1,206 gives 1,500), so the tallest bar never touches the label. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 3, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}
