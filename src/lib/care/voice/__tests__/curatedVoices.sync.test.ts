import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cross-file drift guard for the curated voice list. It's duplicated: curated-client.ts holds a
 * client-importable mirror (so the settings picker doesn't drag the server-only elevenlabs.ts +
 * its API-key code into the client bundle), and elevenlabs.ts holds the canonical list. The
 * client comment says "IF YOU EDIT the curated list here, edit the canonical list in elevenlabs.ts
 * to match. The two lists are kept in sync by convention." Nothing enforced that convention — a
 * drift shows the tenant a voice picker that doesn't match the server's list. elevenlabs.ts is
 * server-only, so this reads both as text and asserts the id + name sequences are identical.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

function voicesBlock(src: string): string {
  return src.match(/CURATED_VOICES:\s*CuratedVoice\[\]\s*=\s*\[([\s\S]*?)\];/)?.[1] ?? "";
}
const field = (block: string, name: string) =>
  [...block.matchAll(new RegExp(`${name}:\\s*"([^"]+)"`, "g"))].map((m) => m[1]);

const CLIENT = voicesBlock(read("../curated-client.ts"));
const SERVER = voicesBlock(read("../elevenlabs.ts"));

describe("curated voice list stays in sync (client mirror <-> server canonical)", () => {
  it("both files parse to a non-empty CURATED_VOICES block", () => {
    expect(CLIENT.trim().length).toBeGreaterThan(0);
    expect(SERVER.trim().length).toBeGreaterThan(0);
  });

  it("the voice IDs match, in the same order", () => {
    expect(field(CLIENT, "id")).toEqual(field(SERVER, "id"));
  });

  it("the voice NAMES match, in the same order", () => {
    expect(field(CLIENT, "name")).toEqual(field(SERVER, "name"));
  });
});
