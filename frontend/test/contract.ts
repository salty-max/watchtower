import { describe, expect, test } from "bun:test";
import { Outdated, SignedOut, type OwnerData } from "../src/shared/data";
import { ENDPOINTS, Ranges } from "../src/shared/schema";

/**
 * The data layer's contract, run against every layer (the demo, the phone's
 * remote layer on a fake server, and in the inbox's tests the remote layer on
 * the inbox's own app): each part comes back as a checked answer, an older one
 * is marked stale when the server is down, and signed out is its own error.
 */
export type Knobs = { make: () => OwnerData; down: (on: boolean) => void; signedOut: (on: boolean) => void; outdated?: (on: boolean) => void };

export function dataLayerContract(name: string, k: Knobs) {
  describe(`data layer: ${name}`, () => {
    const parts = (d: OwnerData) => [
      ["summary", () => d.summary(), ENDPOINTS.summary.schema],
      ["players", () => d.players(), ENDPOINTS.players.schema],
      ["comments", () => d.comments(), ENDPOINTS.comments.schema],
      ["activity", () => d.activity(), ENDPOINTS.activity.schema],
      ["releases", () => d.releases(), ENDPOINTS.releases.schema],
      ...Ranges.map((r) => [`numbers ${r}`, () => d.numbers(r), ENDPOINTS.numbers.schema] as const),
    ] as const;

    test("every part is a good answer, read now, and a second read agrees", async () => {
      k.down(false);
      k.signedOut(false);
      const d = k.make();
      for (const [part, get, schema] of parts(d)) {
        const a = await get();
        expect(a.stale, part).toBe(false);
        expect(Number.isFinite(a.at), part).toBe(true);
        expect(schema.safeParse(a.data).success, part).toBe(true);
        const b = await get();
        expect(b.stale, part).toBe(false);
        expect(JSON.stringify(b.data), part).toBe(JSON.stringify(a.data));
      }
    });

    test("with the server down, the last good answer comes back marked stale, and nothing is made up for a part never read", async () => {
      k.down(false);
      k.signedOut(false);
      const d = k.make();
      const first = await d.comments();
      k.down(true);
      const again = await d.comments();
      expect(again.stale).toBe(true);
      expect(JSON.stringify(again.data)).toBe(JSON.stringify(first.data));
      await expect(d.players()).rejects.toThrow();
      k.down(false);
      expect((await d.comments()).stale).toBe(false);
    });

    test("signed out is SignedOut, never an empty page", async () => {
      k.down(false);
      k.signedOut(true);
      const d = k.make();
      for (const [part, get] of parts(d)) await expect(get(), part).rejects.toBeInstanceOf(SignedOut);
      k.signedOut(false);
    });

    if (k.outdated)
      test("a server of another version is Outdated", async () => {
        k.outdated!(true);
        await expect(k.make().summary()).rejects.toBeInstanceOf(Outdated);
        k.outdated!(false);
      });
  });
}
