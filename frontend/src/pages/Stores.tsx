import { useState } from "react";
import { Card, Chip, Chips, CopyButton, Modal, PageHeader, PageNote, Reasons, Said, Section } from "@/components/ui";
import { call, useApp, type Dict } from "@/lib/api";

/** Stores: each addon's store pages against its file, and the dry run that says what an update would change. */
export function Stores() {
  const { state, toast } = useApp();
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
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stores" intro="Whether CurseForge, Wago and GitHub show what each addon's CURSEFORGE.md says. The dry run changes nothing: putting a page up stays with a session and your go." />
      <div>
        <PageNote v={s.verdict.reasons.length ? s.verdict : { light: "green", reasons: [] }} />
        <Section title="Store pages against their files" empty="store.ts has not answered yet.">
          {s.stores.map((x: Dict) => (
            <Card
              key={x.repo}
              light={x.verdict.light}
              title={x.repo}
              tools={
                <>
                  {x.read && (
                    <button type="button" className="btn h-8 px-3 text-[13px]" onClick={() => dry(x.repo)}>
                      Dry run
                    </button>
                  )}
                  <CopyButton text={x.prompt} label="Copy store prompt" />
                </>
              }
            >
              {x.read && (
                <>
                  <Said>{x.title}</Said>
                  <Chips>
                    <Chip>CurseForge {x.curseforge.page}</Chip>
                    <Chip>Wago {"state" in x.wago ? x.wago.state : "not read"}</Chip>
                    <Chip>GitHub {x.github === "none" || x.github === "same" ? x.github : "differs"}</Chip>
                  </Chips>
                </>
              )}
              <Reasons v={x.verdict} />
            </Card>
          ))}
        </Section>
      </div>
      {run && (
        <Modal title={`Store page dry run: ${run.repo}`} onClose={() => setRun(undefined)}>
          <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-dim select-text">{run.out ?? "Reading CurseForge, Wago and GitHub. Nothing is saved…"}</pre>
        </Modal>
      )}
    </div>
  );
}
