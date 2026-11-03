import { useState } from "react";
import { RepoName } from "@/components/Row";
import { Dot, Modal, PageNote } from "@/components/ui";
import { call, useApp, type Dict, type Light } from "@/lib/api";
import { addonIds } from "@/lib/queue";

const RANK: Record<string, number> = { red: 0, amber: 1, grey: 2, green: 3 };
const STORES = ["CurseForge", "Wago", "GitHub", "CF summary"] as const;

/** One store's cell: its light and the word when it is not the quiet one. */
function cells(x: Dict): { light: Light; word?: string }[] {
  if (!x.read) return STORES.map(() => ({ light: "grey" as Light, word: x.why === "not-on-curseforge" ? "not listed" : "not read" }));
  const due = (what: string) => (x.due as string[]).includes(what);
  const wago = "state" in x.wago ? (x.wago.state as string) : undefined;
  return [
    due("CurseForge's page") ? { light: "amber", word: String(x.curseforge.page) } : x.semicolon ? { light: "amber", word: "semicolon" } : { light: "green" },
    wago === undefined ? { light: "grey", word: "not read" } : due("Wago's page and summary") ? { light: "amber", word: wago } : { light: "green" },
    due("GitHub's description") ? { light: "amber", word: "would change" } : x.github === "none" ? { light: "grey", word: "no note" } : { light: "green" },
    due("CurseForge's summary") ? { light: "amber", word: "would change" } : { light: "green" },
  ];
}

/** Stores: each addon's pages on CurseForge, Wago and GitHub against its CURSEFORGE.md, as a matrix. The dry run changes nothing: putting a page up stays with a session and the user's go. */
export function Stores({ go }: { go: (id: string) => void }) {
  const { state, toast } = useApp();
  const ids = addonIds(state!);
  const s = state!.stores;
  const [run, setRun] = useState<{ repo: string; out?: string }>();
  const dry = async (repo: string) => {
    setRun({ repo });
    try {
      const r = await call<Dict>("/api/action", { name: "store-dry", repo });
      setRun({ repo, out: (r.ok ? "" : "(exit non-zero)\n") + r.out });
    } catch (e) {
      setRun(undefined);
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };
  const rows = [...(s.stores as Dict[])].sort((a, b) => RANK[a.verdict.light] - RANK[b.verdict.light] || a.repo.localeCompare(b.repo));
  const differ = rows.filter((x) => x.read && x.due.length).length;
  const unread = rows.filter((x) => (!x.read && x.why !== "not-on-curseforge") || (x.read && !("state" in x.wago))).length;
  return (
    <div>
      <h1 className="title text-[26px] leading-tight text-parchment">Stores</h1>
      <p className="mt-1.5 text-dim">{rows.length === 0 ? "Whether the store pages match each addon's CURSEFORGE.md." : differ === 0 && unread === 0 ? `All ${rows.length} pages match their files on CurseForge, Wago and GitHub.` : `${[differ && `${differ} of ${rows.length} pages differ from their files`, unread && `${unread} could not be read in full`].filter(Boolean).join(", ")}. The dry run changes nothing.`}</p>
      <PageNote v={s.verdict.reasons.length ? s.verdict : { light: "green", reasons: [] }} />
      <section className="mt-7" aria-label="Store pages">
        {rows.length === 0 ? (
          <p className="text-dim">Not read yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
                <th className="pb-2 font-semibold">Addon</th>
                {STORES.map((n) => (
                  <th key={n} className="px-3 pb-2 text-center font-semibold">{n}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const c = cells(x);
                return (
                  <tr key={x.repo} data-row={`store/${x.repo}`} className="border-t border-edge align-top">
                    <td className="py-2 pr-3">
                      <RepoName name={x.repo} ids={ids} go={go} className="font-semibold text-parchment" />
                      {x.verdict.reasons.length > 0 && <p className="mt-0.5 text-xs text-dim select-text">{x.verdict.reasons.join(" · ")}</p>}
                    </td>
                    {c.map((k, n) => (
                      <td key={STORES[n]} className="px-3 py-2.5 text-center">
                        <Dot light={k.light} />
                        {k.word && <span className="mt-0.5 block text-[11px] text-faint">{k.word}</span>}
                      </td>
                    ))}
                    <td className="py-1.5 pl-3 text-right whitespace-nowrap">
                      {x.read && (
                        <button type="button" className="btn mr-2 h-8 px-3 text-[13px]" onClick={() => dry(x.repo)}>
                          Dry run
                        </button>
                      )}
                      {x.due?.length > 0 && <span className="text-xs text-faint">goes up on your go</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {run && (
        <Modal title={`Store page dry run: ${run.repo}`} onClose={() => setRun(undefined)}>
          <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-dim select-text">{run.out ?? "Reading CurseForge, Wago and GitHub. Nothing is saved…"}</pre>
        </Modal>
      )}
    </div>
  );
}
