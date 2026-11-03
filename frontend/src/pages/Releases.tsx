import { Fragment, useState } from "react";
import { Dot, FixSlot, PageNote } from "@/components/ui";
import { useApp, type Dict, type Light } from "@/lib/api";
import { queue } from "@/lib/queue";

const COLUMNS: [string, string[]][] = [
  ["git", ["git"]],
  ["CI", ["CI"]],
  ["game data", ["game data"]],
  ["languages", ["deDE", "esES"]],
  ["cold read", ["cold read"]],
  ["review", ["review"]],
];
const KNOWN = COLUMNS.flatMap(([, l]) => l);
const RANK: Record<string, number> = { red: 0, amber: 1, grey: 2, green: 3 };

const cell = (a: Dict, labels: string[] | "other"): Light => {
  const rows = (a.rows as Dict[]).filter((r) => (labels === "other" ? !KNOWN.includes(r.label) : labels.includes(r.label)));
  return rows.some((r) => r.mark === "✗") ? "red" : rows.length ? "amber" : "green";
};

/** The push wave: what stands in the way, what waits to go, and every addon's checks as one table to read by column. The order of a wave is the wow-releasing skill's: shown, never decided. */
export function Releases() {
  const { state } = useApp();
  const s = state!;
  const r = s.releases;
  const [shown, setShown] = useState<string[]>([]);
  const toggle = (n: string) => setShown((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]));
  const red = queue(s).filter((i) => i.page === "releases" && i.light === "red");
  // (a repository with commits to push is not safe to push when it is behind, dirty or unread: git would refuse, or nobody knows)
  const blocked = (r.repos as Dict[]).filter((p) => p.ahead > 0 && (p.behind > 0 || p.dirty > 0 || p.verdict.light === "red" || p.verdict.light === "grey") && !red.some((i) => i.where === p.name));
  const inWay = [...red, ...blocked.map((p) => ({ id: `repo/${p.name}/blocked`, light: "red" as const, where: p.name as string, what: `${p.ahead} unpushed, ${[p.behind && `${p.behind} behind`, p.dirty && `${p.dirty} uncommitted`, ...p.verdict.reasons].filter(Boolean).join(", ")}`, page: "releases", fix: p.fix as Dict | undefined, prompt: p.prompt as string | undefined }))];
  const waiting = (r.repos as Dict[]).filter((p) => p.ahead > 0 && !inWay.some((i) => i.where === p.name));
  const addons = [...(r.addons as Dict[])].sort((a, b) => RANK[a.verdict.light as string] - RANK[b.verdict.light as string]);
  const hasOther = addons.some((a) => cell(a, "other") !== "green");
  const tot = (l: string[] | "other") => addons.filter((a) => cell(a, l) !== "green").length;
  const repos = [...(r.repos as Dict[])].sort((a, b) => RANK[a.verdict.light as string] - RANK[b.verdict.light as string] || a.name.localeCompare(b.name));
  return (
    <div>
      <h1 className="title text-[26px] leading-tight text-parchment">Push wave</h1>
      <p className="mt-1.5 text-dim">What stands in the way of a push or a release, and what waits to go. Its order is the wow-releasing skill's.</p>
      <PageNote v={{ light: r.verdict.light === "green" ? "amber" : r.verdict.light, reasons: r.verdict.reasons }} />

      <Band title="In the way" tone="text-blood" count={inWay.length} empty={r.verdict.light === "grey" ? "Not read yet." : "Nothing stands in the way of a push."}>
        {inWay.map((i) => (
          <li key={i.id} data-row={i.id} className="grid grid-cols-[1.25rem_minmax(0,11rem)_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-edge py-2.5">
            <Dot light="red" className="mt-[3px]" />
            <b className="font-semibold text-parchment select-text">{i.where}</b>
            <p className="text-parchment select-text">{i.what}</p>
            <FixSlot id={i.id} prompt={i.prompt} fix={i.fix} />
          </li>
        ))}
      </Band>

      <Band title="Unpushed" tone="text-ok" count={waiting.length} empty={repos.length ? `Nothing unpushed. ${repos.length} repositories read.` : "Not read yet."}>
        {waiting.map((p) => (
          <li key={p.name} data-row={`push/${p.name}`} className="grid grid-cols-[1.25rem_minmax(0,11rem)_minmax(0,1fr)_auto] items-start gap-x-3 border-t border-edge py-2.5">
            <Dot light={p.verdict.light} className="mt-[3px]" />
            <b className="font-semibold text-parchment select-text">{p.name}</b>
            <p className="text-parchment select-text">
              {p.ahead} unpushed commit{p.ahead === 1 ? "" : "s"}
              {p.cards.length > 0 && <span className="ml-2 font-mono text-xs text-faint">{p.cards.map((c: Dict) => `${c.id} (${c.status})`).join(", ")}</span>}
              {p.verdict.reasons.length > 0 && <span className="ml-2 text-dim">{p.verdict.reasons.join(", ")}</span>}
            </p>
            <FixSlot id={`push/${p.name}`} prompt={p.prompt} fix={p.fix} label="Copy push prompt" />
          </li>
        ))}
      </Band>

      <section className="mt-9" aria-label="Addons by check">
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">Addons by check</h2>
        {addons.length === 0 ? (
          <p className="text-dim">preflight has not answered yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
                <th className="pb-2 font-semibold">Addon</th>
                {COLUMNS.map(([n]) => (
                  <th key={n} className="px-2 pb-2 text-center font-semibold">{n}</th>
                ))}
                {hasOther && <th className="px-2 pb-2 text-center font-semibold">other</th>}
                <th className="px-2 pb-2 text-right font-semibold">ships</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {addons.map((a) => (
                <Fragment key={a.name}>
                  <tr data-row={`rel/${a.name}`} className="border-t border-edge">
                    <td className="py-2 pr-3">
                      <button type="button" aria-expanded={shown.includes(a.name)} disabled={!a.rows.length} onClick={() => toggle(a.name)} className="text-left">
                        <b className="font-semibold text-parchment">{a.name}</b> <span className="font-mono text-xs text-faint">{a.tag || "no tag"}</span>
                      </button>
                    </td>
                    {COLUMNS.map(([n, l]) => (
                      <td key={n} className="px-2 text-center">
                        <Dot light={cell(a, l)} />
                      </td>
                    ))}
                    {hasOther && (
                      <td className="px-2 text-center">
                        <Dot light={cell(a, "other")} />
                      </td>
                    )}
                    <td className="px-2 text-right font-mono text-xs text-dim">{a.ships || "·"}</td>
                    <td className="py-1 pl-3 text-right">{(a.prompt || a.verdict.light !== "green") && <FixSlot id={`rel/${a.name}`} prompt={a.prompt} fix={a.fix} label="Copy release prompt" />}</td>
                  </tr>
                  {shown.includes(a.name) && (
                    <tr>
                      <td colSpan={COLUMNS.length + (hasOther ? 1 : 0) + 3} className="pb-3 pl-5">
                        <p className="mb-1 border-l border-edge pl-3 text-[13px] text-dim select-text">{a.said}</p>
                        <ul className="flex flex-col gap-1 border-l border-edge pl-3 text-[13px] select-text">
                          {(a.rows as Dict[]).map((x) => (
                            <li key={`${x.label}/${x.text}`} className={x.mark === "✗" ? "text-blood" : "text-dim"}>
                              <span className="mr-2 font-mono text-xs">{x.label}</span>
                              {x.text}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-edge text-faint">
                <td className="py-2 text-[11px] font-semibold tracking-[0.1em] uppercase">Not green</td>
                {COLUMNS.map(([n, l]) => (
                  <td key={n} className="px-2 text-center font-mono text-xs">{tot(l) || "·"}</td>
                ))}
                {hasOther && <td className="px-2 text-center font-mono text-xs">{tot("other") || "·"}</td>}
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="mt-9" aria-label="Every repository">
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">Every repository</h2>
        {repos.length === 0 ? (
          <p className="text-dim">status has not answered yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
                <th className="pb-2 font-semibold">Repository</th>
                <th className="px-3 pb-2 text-right font-semibold">ahead</th>
                <th className="px-3 pb-2 text-right font-semibold">behind</th>
                <th className="px-3 pb-2 text-right font-semibold">dirty</th>
                <th className="pb-2 pl-4 font-semibold">last CI</th>
                <th className="pb-2 pl-4 font-semibold">cards</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {repos.map((p) => (
                <tr key={p.name} data-row={`repo/${p.name}`} className="border-t border-edge">
                  <td className="py-1.5 pr-3">
                    <Dot light={p.verdict.light} className="mr-2" />
                    <b className="font-semibold text-parchment">{p.name}</b> <span className="font-mono text-xs text-faint select-text">{String(p.head).split(" ")[0]}</span>
                    {p.verdict.reasons.length > 0 && <p className="pl-[19px] text-xs text-dim select-text">{p.verdict.reasons.join(" · ")}</p>}
                  </td>
                  <td className={`px-3 text-right font-mono text-xs ${p.ahead ? "text-amber" : "text-faint"}`}>{p.ahead || "·"}</td>
                  <td className={`px-3 text-right font-mono text-xs ${p.behind ? "text-amber" : "text-faint"}`}>{p.behind || "·"}</td>
                  <td className="px-3 text-right font-mono text-xs text-faint">{p.dirty || "·"}</td>
                  <td className={`pl-4 ${p.ci && p.ci !== "success" ? "text-blood" : "text-faint"}`}>
                    {p.ci ?? (p.verdict.reasons.some((x: string) => /gh gave nothing/.test(x)) ? "unknown" : "none")}
                  </td>
                  <td className="pl-4 font-mono text-xs text-faint select-text">{p.cards.map((c: Dict) => `${c.id} (${c.status})`).join(", ")}</td>
                  <td className="py-1 pl-3 text-right">{p.verdict.light !== "green" && <FixSlot id={`repo/${p.name}`} prompt={p.prompt} fix={p.fix} label="Copy push prompt" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Band({ title, tone, count, empty, children }: { title: string; tone: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="mt-7" aria-label={title}>
      <h2 className="mb-1 text-[11px] font-semibold tracking-[0.12em] uppercase">
        <span className={tone}>{title}</span> <span className="ml-1 font-mono font-normal text-faint">{count}</span>
      </h2>
      {count ? <ul className="border-b border-edge">{children}</ul> : <p className="text-[13px] text-faint">{empty}</p>}
    </section>
  );
}
