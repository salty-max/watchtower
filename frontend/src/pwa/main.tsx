import { createRoot } from "react-dom/client";
import { demo, NOW, type Scenario } from "../shared/demo";
import "../shared/look/index.css";
import type { Shell } from "../shared/shell";
import { App } from "./App";
import { opener } from "./open";
import "./pwa.css";
import { remote } from "./remote";

/** The phone app (and any browser): Watchtower's pages with the owner's cookie. `?demo` (or `?demo=quiet`, `?demo=trouble`) shows made-up numbers instead, and touches nothing. */
const params = new URLSearchParams(location.search);
const asked = params.get("demo");
const scenario = asked === null ? null : (["usual", "quiet", "trouble"].includes(asked) ? (asked as Scenario) : "usual");

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // (private browsing or a full store: the app works without it)
    }
  },
};

const shell: Shell = {
  can: new Set(),
  auth: { signedIn: true, signIn: () => location.assign("/api/login?web=1&next=/stats/next/") },
  open: opener(
    location.href,
    (url) => location.assign(url),
    (url) => void window.open(url, "_blank", "noopener"),
  ),
  go: () => {},
  oldPage: "/stats",
  ...(scenario && { now: () => NOW }),
};

createRoot(document.getElementById("root")!).render(<App shell={shell} data={scenario ? demo(scenario) : remote({ store })} />);

if (!scenario && import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register("/stats/next/sw.js", { scope: "/stats/next/" }).catch(() => {});
