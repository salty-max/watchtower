/** "2 minutes ago", "3 h ago": from epoch milliseconds. */
export function ago(at: number | undefined, now = Date.now()): string {
  if (!at) return "never";
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 90 ? `${s} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`;
}

export const WORD = { green: "ready", amber: "to look at", red: "in the way", grey: "not read" } as const;

const GB = { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
export const when = (iso: string) => new Date(iso).toLocaleString("en-GB", GB);
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
