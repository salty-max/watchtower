import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Toasts } from "@/components/ui";
import { useApp } from "@/lib/api";
import { Overview } from "@/pages/Overview";
import { AddonPage, Addons } from "@/pages/Addons";
import { Data } from "@/pages/Data";
import { Launch } from "@/pages/Launch";
import { Releases } from "@/pages/Releases";
import { Stores } from "@/pages/Stores";
import { Zips } from "@/pages/Zips";

/** The window: the sidebar, one page beside it (it alone scrolls), the toasts. It opens on the overview. */
export function App() {
  const { state, lastOk } = useApp();
  const [chosen, setChosen] = useState<string>();
  if (!state) return null;
  const page = chosen && (["overview", "addons"].includes(chosen) || chosen.startsWith("addon:") || state.pages.some((p) => p.id === chosen)) ? chosen : "overview";
  const lost = Date.now() - lastOk > 60_000;
  return (
    <div className="flex h-full">
      <Sidebar page={page} go={setChosen} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {/* the title bar's height, draggable as the window's own (macOS: the traffic lights' row) */}
        <div className="drag sticky top-0 z-10 h-10 bg-night/90" />
        {state.quiet && <p className="mx-auto mb-4 max-w-5xl border-l-2 border-gold px-3 text-sm text-dim">Launch night's window: only what launch night reads is being read, from 4 November 22:00 to 5 November 06:00 CET. Data and Stores keep their last answers (a dry run from its button still works).</p>}
        {state.fixError && <p className="mx-auto mb-4 max-w-5xl pl-3 text-xs text-faint">Fix sessions are unavailable: {state.fixError}</p>}
        {lost && <p className="mx-auto mb-4 max-w-5xl border-l-2 border-blood px-3 text-sm text-blood">The server is not answering. Quit Watchtower from its menu and open it again.</p>}
        <div key={page} className="fade-in mx-auto max-w-5xl px-8 pb-10">
          {page === "overview" && <Overview go={setChosen} />}
          {page === "addons" && <Addons go={setChosen} />}
          {page.startsWith("addon:") && <AddonPage id={page.slice(6)} go={setChosen} />}
          {page === "launch" && <Launch go={setChosen} />}
          {page === "releases" && <Releases go={setChosen} />}
          {page === "data" && <Data go={setChosen} />}
          {page === "stores" && <Stores go={setChosen} />}
          {page === "zips" && <Zips go={setChosen} />}
        </div>
      </main>
      <Toasts />
    </div>
  );
}
