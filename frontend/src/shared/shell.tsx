import { createContext, useContext, type ReactNode } from "react";

/**
 * What a shell can do. A page or a part of one that needs one of these shows
 * only where the shell has it (`shell.can.has(...)`): the phone's app has no local lights and no fix sessions, so a
 * page of the package that named one would be a bug (test/pages.test.tsx
 * greps the pages for those words).
 */
export type Cap = "localLights" | "fixSessions" | "pull" | "launchNight" | "quietHours" | "webPush" | "nativeNotify";

/**
 * What a shell gives the pages (the plan's seams: the data layer is the
 * DataContext beside it, the layout is the shell's own chrome drawn from
 * nav.ts). The notifications seam is not here yet: it arrives with the
 * Settings page.
 */
export type Shell = {
  can: ReadonlySet<Cap>;
  auth: {
    /** Whether the shell knows the owner has no sign-in at all (the Mac before its first one). The phone cannot know: its cookie is not readable, so a 401 says it. */
    signedIn: boolean;
    signIn(): void;
  };
  /** Opens an address in the shell's way (a new tab, the system browser). An https address or a path of the same site, nothing else. */
  open(url: string): void;
  /** Goes to a page by its id (nav.ts). */
  go(id: string): void;
  /** The old page the owner used until now, for what has not been brought across yet. */
  oldPage?: string;
  /** The clock, for a demo that has to read the same every time. */
  now?: () => number;
};

const ShellContext = createContext<Shell | null>(null);
export const ShellProvider = ({ shell, children }: { shell: Shell; children: ReactNode }) => <ShellContext.Provider value={shell}>{children}</ShellContext.Provider>;
export const useShell = (): Shell => {
  const s = useContext(ShellContext);
  if (!s) throw new Error("no shell");
  return s;
};
export const useNow = (): number => useShell().now?.() ?? Date.now();
