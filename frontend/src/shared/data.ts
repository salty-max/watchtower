import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Activity, Comments, Numbers, Players, Range, Releases, Summary } from "./schema";

/** What every read gives a page: the answer, when it was read, and whether it is an older one because the server did not answer. */
export type Result<T> = { data: T; at: number; stale: boolean };

/**
 * The seam to the numbers (the plan's data layer): one method per owner
 * endpoint. The phone's implementation asks the inbox with the owner's cookie
 * (pwa/remote.ts), Watchtower on the Mac asks its own server, which holds the
 * token and the reading cache, and the demo (demo.ts) makes the numbers up.
 * Each checks every answer against the schemas and throws one of the errors
 * below, so a page only ever sees a good answer or a plain reason.
 */
export type OwnerData = {
  summary(): Promise<Result<Summary>>;
  numbers(range: Range): Promise<Result<Numbers>>;
  players(): Promise<Result<Players>>;
  comments(): Promise<Result<Comments>>;
  activity(): Promise<Result<Activity>>;
  releases(): Promise<Result<Releases>>;
};

/** Not signed in, or the sign-in has run out. */
export class SignedOut extends Error {
  constructor() {
    super("signed out");
  }
}
/** The server speaks another version of the API than this app (a deploy that has not caught up, or an app that is behind). */
export class Outdated extends Error {
  constructor(public readonly server: number | null) {
    super("outdated");
  }
}
/** Nothing came back and there is no earlier answer to show. */
export class Unreachable extends Error {
  constructor(message = "did not answer") {
    super(message);
  }
}

export type Load<T> = { state: "loading" } | { state: "ready"; result: Result<T> } | { state: "signedOut" } | { state: "outdated" } | { state: "failed" };

export const DataContext = createContext<OwnerData | null>(null);
export const useData = (): OwnerData => {
  const d = useContext(DataContext);
  if (!d) throw new Error("no data layer");
  return d;
};

/**
 * Reads one part and reads it again every minute and whenever the page comes
 * back to the front (a phone put down and picked up). An answer that fails
 * after a good one keeps the good one on screen.
 */
export function useLoad<T>(get: (d: OwnerData) => Promise<Result<T>>, key: string, every = 60_000): Load<T> {
  const data = useData();
  const [load, setLoad] = useState<Load<T>>({ state: "loading" });
  const getter = useRef(get);
  getter.current = get;
  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    const run = () =>
      getter.current(data).then(
        (result) => live && setLoad({ state: "ready", result }),
        // (a plain failure keeps a good answer on screen, the layer already marks it stale when it can; being signed out or a version change replaces it)
        (e) => live && setLoad((was) => (e instanceof SignedOut ? { state: "signedOut" } : e instanceof Outdated ? { state: "outdated" } : was.state === "ready" ? was : { state: "failed" })),
      );
    void run();
    const timer = setInterval(run, every);
    const back = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", back);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [data, key, every]);
  return load;
}

const SummaryContext = createContext<Load<Summary> | null>(null);
/** The summary is read once for the whole app (the Overview draws it, the bar's comment count reads it): a shell wraps its pages in this. */
export function SummaryProvider({ children }: { children: ReactNode }) {
  const load = useLoad((d) => d.summary(), "summary");
  return createElement(SummaryContext.Provider, { value: load }, children);
}
export function useSummary(): Load<Summary> {
  const s = useContext(SummaryContext);
  if (!s) throw new Error("no summary provider");
  return s;
}
