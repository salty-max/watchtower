import { Gate } from "./gate";
import { useLoad } from "../data";
import { ago, word } from "../format";
import { Dot, PageHeader, Panel } from "../look/primitives";
import type { Comments as Answer } from "../schema";
import { useNow, useShell } from "../shell";

type Thread = Answer["threads"][number];

/** The ones still waiting for an answer first, each group newest first. */
export const orderOf = (threads: Thread[]) => [...threads].sort((a, b) => Number(a.answered) - Number(b.answered) || b.last.localeCompare(a.last));

export function Comments() {
  const shell = useShell();
  const now = useNow();
  const load = useLoad((d) => d.comments(), "comments");
  return (
    <div className="flex flex-col gap-4">
      <Gate load={load}>
        {({ data }) => (
          <>
            <PageHeader
              title="Comments"
              intro={data.waiting ? `${word(data.waiting)} ${data.waiting === 1 ? "comment waits" : "comments wait"} for your answer.` : data.threads.length ? "Every comment has your answer." : "No comments yet."}
            />
            {data.threads.length > 0 && (
              <Panel>
                <ul className="flex flex-col divide-y divide-white/[0.05] sm:max-h-[34rem] sm:overflow-auto">
                  {orderOf(data.threads).map((t) => (
                    <li key={t.url} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                      <Dot tone={t.answered ? "faint" : "gold"} className="mt-[7px]" />
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="select-text">
                          <b className="font-semibold">{t.author}</b> on {t.addon}
                        </p>
                        <p className="mt-0.5 line-clamp-3 text-dim select-text">{t.text}</p>
                        <p className="mt-1 text-sm text-faint">
                          {ago(t.at, now)}
                          {t.replies.some((r) => r.owner) ? ", you answered" : ""}
                        </p>
                      </div>
                      <button type="button" className={`btn shrink-0 max-sm:ml-[22px] ${t.answered ? "btn-ghost" : ""}`} onClick={() => shell.open(t.url)} title="Opens CurseForge">
                        {t.answered ? "Open" : "Answer"}
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </>
        )}
      </Gate>
    </div>
  );
}
