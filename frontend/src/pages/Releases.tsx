import { Card, Chip, Chips, CopyButton, PageHeader, PageNote, Reasons, Said, Section } from "@/components/ui";
import { useApp, type Dict } from "@/lib/api";
import { WORD } from "@/lib/format";

/** Releases: what each addon would ship, and what each repository has not pushed. */
export function Releases() {
  const r = useApp().state!.releases;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Releases" intro="Preflight's word on each addon, and every repository's unpushed commits and last run. The push wave's order is the wow-releasing skill's: shown here, never decided." />
      <div>
        <PageNote v={r.verdict} />
        <Section title="Addons before a release" empty="preflight has not answered yet.">
          {r.addons.map((a: Dict) => (
            <Card key={a.name} light={a.verdict.light} title={a.name} small={a.tag || "no tag"} tools={<CopyButton text={a.prompt} label="Copy release prompt" />}>
              <Said>{a.said}</Said>
              <Chips>
                <Chip>{`${a.ships} ship${a.ships === 1 ? "" : "s"} since ${a.tag || "the start"}`}</Chip>
                <Chip light={a.verdict.light}>{WORD[a.verdict.light as keyof typeof WORD]}</Chip>
              </Chips>
              <Reasons v={a.verdict} />
            </Card>
          ))}
        </Section>
        <Section title="Every repository" empty="status has not answered yet.">
          {r.repos.map((p: Dict) => (
            <Card key={p.name} light={p.verdict.light} title={p.name} small={String(p.head).split(" ")[0]} tools={<CopyButton text={p.prompt} label="Copy push prompt" />}>
              {(p.ahead || p.behind || p.dirty || p.ci || p.cards.length > 0) && (
                <Chips>
                  {p.ahead > 0 && <Chip light="amber">{p.ahead} unpushed</Chip>}
                  {p.behind > 0 && <Chip light="amber">{p.behind} behind</Chip>}
                  {p.dirty > 0 && <Chip>{p.dirty} uncommitted</Chip>}
                  {p.ci && <Chip light={p.ci === "success" ? "green" : "red"}>CI {p.ci}</Chip>}
                  {p.cards.map((c: Dict) => (
                    <Chip key={c.id}>{`card ${c.id} (${c.status})`}</Chip>
                  ))}
                </Chips>
              )}
              <Reasons v={p.verdict} />
            </Card>
          ))}
        </Section>
      </div>
    </div>
  );
}
