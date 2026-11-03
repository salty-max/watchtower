import { Card, CopyButton, PageHeader, PageNote, Reasons, Said, Section } from "@/components/ui";
import { useApp, type Dict } from "@/lib/api";

/** Test zips: the zip in iCloud for each addon against its repository's HEAD. */
export function Zips() {
  const z = useApp().state!.zips;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Test zips" intro="One zip per addon in the iCloud test folder, as old as its commit. A second zip of one addon is flagged: the older one goes to the Trash." />
      <div>
        <PageNote v={z.verdict.reasons.length ? z.verdict : { light: "grey", reasons: z.folderNote ? [z.folderNote] : [] }} />
        <Section title="The test zips in iCloud" empty="status has not answered yet.">
          {z.zips.map((x: Dict) => (
            <Card key={x.name} light={x.verdict.light} title={x.name} small={x.version || ""} tools={<CopyButton text={x.prompt} label="Copy refresh prompt" />}>
              <Said>{x.file || "no zip in iCloud"}</Said>
              <Reasons v={x.verdict} />
            </Card>
          ))}
        </Section>
      </div>
    </div>
  );
}
