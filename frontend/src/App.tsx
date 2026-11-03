import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Toasts } from "@/components/ui";
import { useApp } from "@/lib/api";
import { Overview } from "@/pages/Overview";
import { AddonPage, Addons } from "@/pages/Addons";
import { Data } from "@/pages/Data";
import { Launch } from "@/pages/Launch";

/** The window: the sidebar, one page beside it (it alone scrolls), the toasts. It opens on the overview. */
export function App() {
  const { state, lastOk } = useApp();
  const [chosen, setChosen] = useState<string>();
  if (!state) return null;
  const page = chosen && (["overview", "addons", "data", "launch"].includes(chosen) || chosen.startsWith("addon:")) ? chosen : "overview";
  const lost = Date.now() - lastOk > 60_000;
  return (
    <div className="flex h-full">
      <Sidebar page={page} go={setChosen} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {/* the title bar's height, draggable as the window's own (macOS: the traffic lights' row) */}
        <div className="drag sticky top-0 z-10 h-10 bg-night/90" />
        {state.quiet && <p className="mx-auto mb-4 max-w-4xl border-l-2 border-gold px-3 text-sm text-dim">Launch night is on. Until 06:00 on 5 November (CET) Watchtower only reads what launch night needs, so everything else shows its last answer.</p>}
        {state.fixError && <p className="mx-auto mb-4 max-w-4xl pl-3 text-xs text-faint">Fix sessions are not available: {state.fixError}</p>}
        {lost && <p className="mx-auto mb-4 max-w-4xl border-l-2 border-blood px-3 text-sm text-blood">Watchtower's server has stopped answering. Quit it from the menu bar and open it again.</p>}
        <div key={page} className="fade-in mx-auto max-w-4xl px-8 pb-10">
          {page === "overview" && <Overview go={setChosen} />}
          {page === "addons" && <Addons go={setChosen} />}
          {page.startsWith("addon:") && <AddonPage id={page.slice(6)} go={setChosen} />}
          {page === "launch" && <Launch go={setChosen} />}
          {page === "data" && <Data go={setChosen} />}
        </div>
      </main>
      <Toasts />
    </div>
  );
}
