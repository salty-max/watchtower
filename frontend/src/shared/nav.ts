import type { Cap } from "./shell";

/**
 * The pages, their order and what each needs. Both shells draw their chrome
 * from this one list: the Mac's sidebar and the phone's sidebar and bottom
 * bar. `run` is the run of the sidebar the page sits in (a hairline between
 * the runs, no group names). A page of the plan that is not made yet still has its
 * place, and pages/index.tsx gives it the plain page that says so.
 */
export type NavItem = { id: string; label: string; run: 1 | 2 | 3; needs?: Cap; phone?: boolean };

export const NAV: readonly NavItem[] = [
  { id: "overview", label: "Overview", run: 1, phone: true },
  { id: "addons", label: "Addons", run: 1, phone: true },
  { id: "data", label: "Data", run: 1, needs: "localLights" },
  { id: "launch", label: "Launch night", run: 1, needs: "launchNight" },
  { id: "downloads", label: "Downloads", run: 2, phone: true },
  { id: "players", label: "Players", run: 2, phone: true },
  { id: "comments", label: "Comments", run: 2, phone: true },
  { id: "settings", label: "Settings", run: 3 },
];

export const navFor = (can: ReadonlySet<Cap>) => NAV.filter((n) => !n.needs || can.has(n.needs));
/** The five of the phone's bottom bar. */
export const phoneBar = (can: ReadonlySet<Cap>) => navFor(can).filter((n) => n.phone);
export const labelOf = (id: string) => NAV.find((n) => n.id === id)?.label ?? id;
