import "./dom";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataContext, SummaryProvider } from "../src/shared/data";
import { demo, NOW, numbersFor, summaryFor, type Scenario } from "../src/shared/demo";
import { niceMax } from "../src/shared/format";
import { PAGES } from "../src/shared/pages";
import { Comments, orderOf } from "../src/shared/pages/Comments";
import { viewOf } from "../src/shared/pages/Downloads";
import { figuresOf, itemsOf, title, toLookAt } from "../src/shared/pages/Overview";
import { pageOf } from "../src/pwa/App";
import { opener } from "../src/pwa/open";
import { navFor, phoneBar } from "../src/shared/nav";
import { ShellProvider, type Cap, type Shell } from "../src/shared/shell";
import { commentsFor } from "../src/shared/demo";

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

type Opts = { scenario?: Scenario; can?: Cap[]; signedIn?: boolean; down?: boolean; signedOut?: boolean; outdated?: boolean };
async function show(id: string, o: Opts = {}) {
  const calls = { go: mock((_: string) => {}), open: mock((_: string) => {}), signIn: mock(() => {}) };
  const shell: Shell = { can: new Set(o.can ?? []), auth: { signedIn: o.signedIn ?? true, signIn: calls.signIn }, open: calls.open, go: calls.go, oldPage: "/stats", now: () => NOW };
  const data = demo(o.scenario ?? "usual", { down: false, signedOut: !!o.signedOut, outdated: !!o.outdated });
  const Page = PAGES[id];
  const el: ReactElement = (
    <ShellProvider shell={shell}>
      <DataContext.Provider value={data}>
        <SummaryProvider>
          <Page />
        </SummaryProvider>
      </DataContext.Provider>
    </ShellProvider>
  );
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(el);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
  return { host, calls, text: () => host.textContent ?? "", data };
}
const click = async (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const button = (host: HTMLElement, label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;

describe("Overview", () => {
  test("says how many things to look at, with a row for each and the four figures", async () => {
    const { text, host } = await show("overview");
    expect(text()).toContain("Four things to look at");
    expect(text()).toContain("Two comments wait for your answer.");
    expect(text()).toContain("Mealbook 0.2.0 isn't on CurseForge yet.");
    expect(text()).toContain("CurseForge's people counts are old.");
    expect(text()).toContain("The last ones are from 2 November.");
    for (const f of ["Downloads", "Ravenpost in use", "Facts shared", "Visitors"]) expect(text()).toContain(f);
    expect(host.querySelectorAll("li").length).toBe(4);
  });
  test("Open comments goes to the comments page", async () => {
    const { host, calls } = await show("overview");
    await click(button(host, "Open comments"));
    expect(calls.go).toHaveBeenCalledWith("comments");
  });
  test("a quiet day is a short page", async () => {
    const { text, host } = await show("overview", { scenario: "quiet" });
    expect(text()).toContain("Nothing waits for you");
    expect(text()).toContain("Last word 3 h ago");
    expect(host.querySelectorAll("li").length).toBe(0);
  });
  test("a failed job is red and first, on a shell with no lights of its own", async () => {
    const { host } = await show("overview", { scenario: "trouble" });
    const first = host.querySelector("li")!;
    expect(first.textContent).toContain("A job failed.");
    expect(first.querySelector(".bg-blood")).toBeTruthy();
  });
  test("on a shell with its own lights the standing is not said twice", async () => {
    const { text } = await show("overview", { scenario: "trouble", can: ["localLights"] });
    expect(text()).not.toContain("A job failed");
  });
  test("itemsOf: red first, then in the order told; a good word is green", () => {
    const s = summaryFor("trouble");
    s.warnings = [{ key: "spike", level: "good", title: "Ravenpost installs are up", line: "Many." }];
    const items = itemsOf(s, NOW, true);
    expect(items.map((i) => i.tone)).toEqual(["blood", "gold", "ok"]);
    expect(toLookAt(items)).toBe(2);
    expect(title(0)).toBe("Nothing waits for you");
    expect(title(1)).toBe("One thing to look at");
  });
  test("figuresOf says 'not counted yet' rather than a zero it does not know", () => {
    const s = summaryFor("usual");
    s.figures.installs = { last: null, today: null };
    expect(figuresOf(s)[1]).toEqual({ label: "Ravenpost in use", value: "–", note: "not counted yet" });
  });
});

describe("Downloads", () => {
  test("30 days by default: four figures, the chart, the table of eleven", async () => {
    const { text, host } = await show("downloads");
    expect(text()).toContain("In 30 days");
    expect(host.querySelectorAll("tbody tr").length).toBe(11);
    expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("30 bars");
    expect(host.querySelectorAll('[role="group"] button').length).toBe(5);
  });
  test("the range is one control: 24 h draws hours from CurseForge, 7 d draws seven days", async () => {
    const { host, text } = await show("downloads");
    await click(button(host, "24 hours"));
    expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("24 bars");
    expect(text()).toContain("Best hour");
    expect(text()).toContain("CurseForge only");
    await click(button(host, "7 days"));
    expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("7 bars");
  });
  test("viewOf adds up what the server sent and nothing else", () => {
    const n = numbersFor("30");
    const v = viewOf(n, "30");
    const byHand = n.days.reduce((t, _, i) => t + Object.values(n.downloads.daily).reduce((u, xs) => u + (xs[i] ?? 0), 0), 0);
    expect(v.figures[0].value).toBe(byHand.toLocaleString("en-GB"));
    expect(v.rows.length).toBe(11);
    expect(v.rows.every((r, i, a) => i === 0 || (a[i - 1].span ?? -1) >= (r.span ?? -1))).toBe(true);
    expect(v.figures[2].note).toContain("Yonder 0.15.0");
    expect(v.marks.length).toBe(4);
    const people = Object.values(n.periods).reduce((t, p) => t + p["30"].unique, 0);
    expect(v.figures[1].value).toBe(people.toLocaleString("en-GB"));
  });
  test("the chart's top is a round number above the tallest bar", () => {
    expect(niceMax(858)).toBe(1000);
    expect(niceMax(1206)).toBe(1500);
    expect(niceMax(0)).toBe(1);
    for (const m of [1, 7, 99, 100, 101, 4999, 12345]) expect(niceMax(m)).toBeGreaterThanOrEqual(m);
  });
});

describe("Comments", () => {
  test("the ones waiting first, each with its button, answered ones quieter", async () => {
    const { host, text, calls } = await show("comments");
    expect(text()).toContain("Two comments wait for your answer.");
    const rows = [...host.querySelectorAll("li")];
    expect(rows.length).toBe(4);
    expect(rows[0].textContent).toContain("Thalindra");
    expect(rows[2].textContent).toContain("you answered");
    await click(button(host, "Answer"));
    expect(calls.open.mock.calls[0][0]).toMatch(/^https:\/\/www\.curseforge\.com\//);
  });
  test("every comment answered says so", async () => {
    const { text } = await show("comments", { scenario: "quiet" });
    expect(text()).toContain("Every comment has your answer.");
  });
  test("orderOf: waiting first, newest first within each", () => {
    const o = orderOf(commentsFor("usual").threads).map((t) => t.author);
    expect(o).toEqual(["Thalindra", "Kragnok", "Brewmistress", "Ysolde"]);
  });
  test("exported for the shells", () => expect(typeof Comments).toBe("function"));
});

describe("what a page says when there are no numbers", () => {
  test("signed out (an answer said 401): one Sign in panel, and the button signs in", async () => {
    const { text, host, calls } = await show("overview", { signedOut: true });
    expect(text()).toContain("Sign in with Battle.net");
    expect(host.querySelectorAll("li").length).toBe(0);
    await click(button(host, "Sign in with Battle.net"));
    expect(calls.signIn).toHaveBeenCalled();
  });
  test("a shell that knows there is no sign-in shows the panel on every built page", async () => {
    for (const id of ["overview", "downloads", "comments"]) expect((await show(id, { signedIn: false })).text()).toContain("Sign in with Battle.net");
  });
  test("another version of the API is a plain sentence", async () => {
    expect((await show("downloads", { outdated: true })).text()).toContain("Not the same version");
  });
  test("a page not made yet says so and points to the old page", async () => {
    const { text, host, calls } = await show("players");
    expect(text()).toContain("Not in the new app yet");
    await click(button(host, "Open the page you used until now"));
    expect(calls.open).toHaveBeenCalledWith("/stats");
  });
});

describe("an answer that stops being good", () => {
  test("a page that had numbers shows the sign-in when the next read says signed out", async () => {
    const { host, text, data } = await show("overview");
    expect(text()).toContain("Four things");
    data.control.signedOut = true;
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(host.textContent).toContain("Sign in with Battle.net");
  });
});

describe("opening an address on the phone", () => {
  test("https in a tab, a path of the site in place, nothing else, however it is hidden", () => {
    const seen: string[] = [];
    const open = opener("https://inbox.test/stats/next/", (u) => seen.push(`here ${u}`), (u) => seen.push(`tab ${u}`));
    for (const u of ["https://www.curseforge.com/x", "/stats", "//evil.test/", "/\\evil.test/x", "/\t/evil.test/x", "/\n/evil.test", "http://x.test/", "javascript:alert(1)", "data:text/html,x", "mailto:a@b.c", ""]) open(u);
    expect(seen).toEqual(["tab https://www.curseforge.com/x", "here /stats"]);
  });
});

describe("the phone's addresses", () => {
  test("a Mac-only page in the hash is the Overview, a phone page is itself", () => {
    expect(pageOf("#/launch", new Set())).toBe("overview");
    expect(pageOf("#/data", new Set())).toBe("overview");
    expect(pageOf("#/comments", new Set())).toBe("comments");
    expect(pageOf("#/launch", new Set<Cap>(["launchNight"]))).toBe("launch");
    expect(pageOf("", new Set())).toBe("overview");
  });
});

describe("downloads with no days counted yet", () => {
  test("says so plainly, not 'since 0 undefined'", () => {
    const n = numbersFor("all");
    n.days = [];
    for (const a of Object.keys(n.downloads.daily)) n.downloads.daily[a] = [];
    n.downloads.early = [];
    for (const k of ["curseforge", "wago", "github"] as const) n.downloads.stores[k] = [];
    for (const a of Object.keys(n.rank)) n.rank[a] = [];
    for (const a of Object.keys(n.unique)) n.unique[a] = [];
    n.marks = [];
    const v = viewOf(n, "all");
    expect(v.figures[0].note).toBe("no days counted yet");
    expect(JSON.stringify(v.figures)).not.toContain("undefined");
  });
});

describe("the bars", () => {
  test("a phone gets five tabs, no lights and no launch night; the Mac's list has more", () => {
    expect(phoneBar(new Set()).map((n) => n.id)).toEqual(["overview", "addons", "downloads", "players", "comments"]);
    expect(navFor(new Set()).map((n) => n.id)).not.toContain("data");
    expect(navFor(new Set<Cap>(["localLights", "launchNight"])).map((n) => n.id)).toEqual(["overview", "addons", "data", "launch", "downloads", "players", "comments", "settings"]);
  });
});

describe("the package's words", () => {
  const src = path.join(import.meta.dir, "..", "src");
  const shared = path.join(src, "shared");
  const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [path.join(d, e.name)] : []));
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
  test("the pages name no light, fix session or pull (Watchtower's own pages stay in Watchtower)", () => {
    for (const f of files(path.join(shared, "pages"))) expect(strip(readFileSync(f, "utf8")), f).not.toMatch(/\b(light|fix session|pull button|git pull)\b/i);
  });
  test("what the owner reads says Watchtower, never Ravenpost's inbox", () => {
    for (const f of [...files(shared), ...files(path.join(src, "pwa")), path.join(src, "..", "pwa", "index.html"), path.join(src, "..", "pwa", "public", "manifest.webmanifest")]) {
      const s = strip(readFileSync(f, "utf8"));
      expect(s, f).not.toMatch(/the inbox|ravenpost inbox|ravenpost-inbox/i);
    }
    expect(readFileSync(path.join(src, "..", "pwa", "public", "manifest.webmanifest"), "utf8")).toContain('"name": "Watchtower"');
  });
  test("no chips and no pills: no rounded-full label in the pages", () => {
    for (const f of files(path.join(shared, "pages"))) expect(readFileSync(f, "utf8"), f).not.toMatch(/rounded-full[^"]*px-/);
  });
});
