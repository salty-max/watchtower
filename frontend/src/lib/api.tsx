import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** What the server's /api/state says (server/view.ts). Only what the pages draw is typed. */
export type Light = "green" | "amber" | "red" | "grey";
export type Verdict = { light: Light; reasons: string[] };
export type Dict = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type State = {
  now: number;
  quiet: boolean;
  overall: Light;
  open: string;
  pages: { id: string; label: string; light: Light }[];
  releases: Dict;
  data: Dict;
  stores: Dict;
  zips: Dict;
  launch?: Dict;
  cards: { id: string; title: string; status: string; repos?: string[] }[];
  /** `cached`: loaded from disk, no live reading yet. `stale`: and older than its interval. */
  ages: Record<string, { at: number; ms: number; error?: string; paused?: boolean; cached?: boolean; stale?: boolean }>;
  busy: string[];
};
export type Toast = { id: number; tone: "ok" | "error"; text: string };

/** The shell (the Wails window) answers /shell/*: links that open in the browser. Absent in a plain browser. */
export type ShellInfo = { shell: true };

export async function call<T = Dict>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as Dict).error || `HTTP ${res.status}`);
  return data as T;
}

type Ctx = {
  state: State | undefined;
  /** The last time the server answered (the stale banner). */
  lastOk: number;
  shell: ShellInfo | undefined;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
  reload: () => Promise<void>;
  /** A change to launch night's ticks and notes. */
  change: (body: Dict) => Promise<void>;
  refreshAll: () => Promise<void>;
  open: (url: string) => void;
  copy: (text: string, what?: string) => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = (): Ctx => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("no AppProvider");
  return c;
};

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<State>();
  const [lastOk, setLastOk] = useState(() => Date.now());
  const [shell, setShell] = useState<ShellInfo>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = ++n.current;
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      setState(await call<State>("/api/state"));
      setLastOk(Date.now());
    } catch {
      /* the stale banner says so once a minute has passed */
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(reload, 10_000);
    call<ShellInfo>("/shell/info").then(setShell, () => undefined);
    return () => clearInterval(id);
  }, [reload]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      lastOk,
      shell,
      toasts,
      toast,
      reload,
      change: async (body) => {
        try {
          await call("/api/change", body);
          await reload();
        } catch (e) {
          toast(e instanceof Error ? e.message : String(e), "error");
        }
      },
      refreshAll: async () => {
        await call("/api/refresh", { source: "all" }).catch(() => undefined);
        await reload();
      },
      open: (url) => {
        if (shell) call("/shell/open", { url }).catch((e) => toast(String(e), "error"));
        else window.open(url, "_blank", "noopener,noreferrer");
      },
      copy: async (text, what = "Copied") => {
        try {
          await navigator.clipboard.writeText(text);
          toast(what);
        } catch {
          toast("Could not copy", "error");
        }
      },
    }),
    [state, lastOk, shell, toasts, toast, reload],
  );
  return <AppCtx.Provider value={value}>{state ? children : fallback}</AppCtx.Provider>;
}
