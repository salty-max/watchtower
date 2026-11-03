import { Dot, FixSlot, PageNote } from "@/components/ui";
import { useApp, type Dict } from "@/lib/api";

const RANK: Record<string, number> = { red: 0, amber: 1, grey: 2, green: 3 };

/** Test zips: the zip in iCloud for each addon against its repository's HEAD, one table. A second zip of one addon is on the row: the older one goes to the Trash. */
export function Zips() {
  const z = useApp().state!.zips;
  const rows = [...(z.zips as Dict[])].sort((a, b) => RANK[a.verdict.light] - RANK[b.verdict.light] || a.name.localeCompare(b.name));
  const loud = rows.filter((x) => x.verdict.light !== "green").length;
  const note = z.verdict.reasons.length ? z.verdict : { light: "grey", reasons: z.folderNote ? [z.folderNote] : [] };
  return (
    <div>
      <h1 className="title text-[26px] leading-tight text-parchment">Test zips</h1>
      <p className="mt-1.5 text-dim">{rows.length === 0 ? "One zip per addon in the iCloud test folder, as new as its commit." : loud === 0 ? `All ${rows.length} zips are as new as their commits.` : `${loud} of ${rows.length} zips are behind their commits or missing.`}</p>
      <PageNote v={note} />
      <section className="mt-7" aria-label="Test zips">
        {rows.length === 0 ? (
          <p className="text-dim">Not read yet.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
                <th className="pb-2 font-semibold">Addon</th>
                <th className="pb-2 font-semibold">Zip in iCloud</th>
                <th className="pb-2 pl-3 font-semibold">Version</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.name} data-row={`zip/${x.name}`} className="border-t border-edge align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Dot light={x.verdict.light} className="mr-2" />
                    <b className="font-semibold text-parchment">{x.name}</b>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`font-mono text-xs select-text ${x.file ? "text-dim" : "text-blood"}`}>{x.file || "no zip in iCloud"}</span>
                    {x.verdict.reasons.length > 0 && <p className="mt-0.5 text-xs text-dim select-text">{x.verdict.reasons.join(" · ")}</p>}
                  </td>
                  <td className="py-2 pl-3 font-mono text-xs text-faint">{x.version || ""}</td>
                  <td className="py-1.5 pl-3 text-right">{x.verdict.light !== "green" && <FixSlot id={`zip/${x.name}`} prompt={x.prompt} label="Copy refresh prompt" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
