/**
 * How the phone shell opens an address: an https address in a new tab, a path of this
 * site in place, and nothing else. The address is resolved the way the browser will
 * resolve it (a backslash or a tab hides `//host` from a pattern, not from the parser),
 * because a thread's url comes from CurseForge.
 */
export const opener = (base: string, assign: (url: string) => void, tab: (url: string) => void) => (url: string) => {
  if (!url.trim()) return;
  let u: URL;
  try {
    u = new URL(url, base);
  } catch {
    return;
  }
  if (u.origin === new URL(base).origin) assign(u.pathname + u.search + u.hash);
  else if (u.protocol === "https:" && /^https:\/\//i.test(url)) tab(u.href);
};
