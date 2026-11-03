import { Card, LinkButton, CopyButton, PageHeader, PageNote, Reasons, Said, Section } from "@/components/ui";
import { useApp, type Dict } from "@/lib/api";

/** Data: the daily jobs, the pull requests they open, and the game's builds against the pins. */
export function Data() {
  const d = useApp().state!.data;
  const b = d.builds;
  // (what the cards below already say is not said twice on top)
  const own = [...d.builds.reasons, ...d.prs.flatMap((p: Dict) => p.verdict.reasons), ...d.jobs.flatMap((j: Dict) => j.verdict.reasons)];
  const top = { light: d.verdict.light, reasons: [...d.verdict.reasons.filter((x: string) => !own.includes(x)), ...d.errors.map((e: Dict) => `${e.repo}: ${e.error}`)] };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Data" intro="Wow-data's daily jobs and each addon's game data pull request. A Players pull request is strangers' data: amber until you have read it, never merged by itself." />
      <div>
        <PageNote v={top} />
        <Section title="Open pull requests" empty="None open.">
          {d.prs.map((p: Dict) => (
            <Card
              key={`${p.repo}#${p.number}`}
              light={p.verdict.light}
              title={`${p.repo} #${p.number}`}
              small={p.kind}
              tools={
                <>
                  <CopyButton text={p.prompt} />
                  <LinkButton url={p.url} label="Open the pull request" />
                </>
              }
            >
              <Said>{p.title}</Said>
              <Reasons v={p.verdict} />
            </Card>
          ))}
        </Section>
        <Section title="The game's builds">
          <Card light={b.light} title="Builds against the pins">
            {b.reasons.length ? <Reasons v={b} /> : <Said>Classic and Forever are on the pinned builds.</Said>}
          </Card>
        </Section>
        <Section title="The daily jobs" empty="No job has been read yet.">
          {d.jobs.map((j: Dict) => (
            <Card key={`${j.repo}:${j.workflow}`} light={j.verdict.light} title={j.repo} small={j.label} tools={<LinkButton url={j.run?.url} label="Open the run" />}>
              <Said>{j.text}</Said>
              <Reasons v={j.verdict} />
            </Card>
          ))}
        </Section>
      </div>
    </div>
  );
}
