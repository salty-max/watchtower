import type { ReactNode } from "react";
import { type Load, type Result } from "../data";
import { ago } from "../format";
import { Notice } from "../look/primitives";
import { useNow, useShell } from "../shell";

/** The one sign-in panel: the page shows it when the owner is not signed in (the shell knows, or an answer said 401). */
export function SignIn() {
  const shell = useShell();
  return (
    <Notice
      title="Sign in"
      action={
        <button type="button" className="btn btn-bnet" onClick={() => shell.auth.signIn()}>
          Sign in with Battle.net
        </button>
      }
    >
      Watchtower's numbers are for their owner. Sign in with Battle.net to see them.
    </Notice>
  );
}

/**
 * What every page does before it has numbers: say it is reading, show the
 * sign-in, say plainly why there is nothing, and above a good answer that is
 * an older one say how old. The page itself only draws a good answer.
 */
export function Gate<T>({ load, children }: { load: Load<T>; children: (r: Result<T>) => ReactNode }) {
  const shell = useShell();
  const now = useNow();
  if (!shell.auth.signedIn || load.state === "signedOut") return <SignIn />;
  if (load.state === "loading")
    return (
      <p className="text-dim" role="status">
        Reading the numbers.
      </p>
    );
  if (load.state === "outdated")
    return (
      <Notice title="Not the same version">The server answers in a different version from the one this app reads. It should clear once the update has reached both.</Notice>
    );
  if (load.state === "failed")
    return (
      <Notice title="No answer">Watchtower's server did not answer, and there is no earlier reading to show. It tries again every minute.</Notice>
    );
  return (
    <>
      {load.result.stale && (
        <p className="text-sm text-gold" role="status">
          This is the reading from {ago(load.result.at, now)}. The server did not answer just now.
        </p>
      )}
      {children(load.result)}
    </>
  );
}
