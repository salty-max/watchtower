import { labelOf } from "../nav";
import { Notice, PageHeader } from "../look/primitives";
import { useShell } from "../shell";

/** A page of the plan that is not made yet: its place is in the bar, and it says so plainly, with the way to the page that has it. */
export function Pending({ id }: { id: string }) {
  const shell = useShell();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labelOf(id)} />
      <Notice
        title="Not in the new app yet"
        action={
          shell.oldPage && (
            <button type="button" className="btn" onClick={() => shell.open(shell.oldPage!)}>
              Open the page you used until now
            </button>
          )
        }
      >
        {labelOf(id)} still lives on the page you used until now.
      </Notice>
    </div>
  );
}
