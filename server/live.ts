// The three kinds of event, wired to the engine: changes on this computer
// (watch.ts), CI runs starting and ending (ci.ts), both read through the
// reactor (react.ts), which decides when. The engine's timers carry on as the
// safety net.
import { type Exec } from "./engine";
import { CiWatch, type CiRepo } from "./ci";
import { Reactor, type Reading } from "./react";
import { targets, watchAll, type Target } from "./watch";

type StatusRepo = { name: string; slug?: string };

/** The repositories status read, with their GitHub names. */
export const ciRepos = (status: unknown): CiRepo[] =>
  Array.isArray(status) ? (status as StatusRepo[]).filter((r) => typeof r?.name === "string" && typeof r.slug === "string").map((r) => ({ name: r.name, slug: r.slug as string })) : [];

export function startLive(o: { engine: Reading & { cells: Record<string, { data?: unknown }> }; root: string; run: Exec; log?: (line: string) => void; list?: Target[] }): () => void {
  const log = (line: string) => o.log?.(`watch: ${line}`);
  const reactor = new Reactor(o.engine, { log });
  const ci = new CiWatch({
    repos: () => ciRepos(o.engine.cells.status?.data),
    run: o.run,
    log,
    onChange: ({ repo, ended }) => reactor.trigger(ended ? ["status", "data-prs", "preflight"] : ["status", "data-prs"], `a CI run ${ended ? "ended" : "started"} in ${repo}`),
  });
  const stop = watchAll(
    o.list ?? targets(o.root),
    (sources, why) => {
      reactor.trigger(sources, why);
      // (a repository's refs moving is also when a push may have started a run)
      const m = /^(.+) moved$/.exec(why);
      if (m) ci.poke(m[1]);
    },
    log,
  );
  ci.start();
  return () => {
    stop();
    ci.stop();
    reactor.stop();
  };
}
