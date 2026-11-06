import type { ComponentType } from "react";
import { NAV } from "../nav";
import { Comments } from "./Comments";
import { Downloads } from "./Downloads";
import { Overview } from "./Overview";
import { Pending } from "./Pending";

/** Each page of nav.ts, the built ones as themselves and the rest as the plain page that says so. */
const BUILT: Record<string, ComponentType> = { overview: Overview, downloads: Downloads, comments: Comments };
export const PAGES: Record<string, ComponentType> = Object.fromEntries(NAV.map((n) => [n.id, BUILT[n.id] ?? (() => <Pending id={n.id} />)]));
