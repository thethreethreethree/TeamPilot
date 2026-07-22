import { describe, it, expect } from "vitest";
import { extractMentions, tokenizeMentions, stripMentionMarkup } from "../extract";

/**
 * Mention parsing (`@[Name](uuid)`). Untested, but correctness has teeth: extractMentions drives chain-event
 * emission (who gets notified), tokenizeMentions drives rendering, and stripMentionMarkup keeps UUIDs out of
 * audit excerpts. A misparse notifies the wrong person or leaks an id.
 */

const U1 = "7da30c76-1234-4abc-89ab-0123456789ab";
const U2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("extractMentions", () => {
  it("returns [] for empty / mention-free text", () => {
    expect(extractMentions("")).toEqual([]);
    expect(extractMentions("just a plain sentence")).toEqual([]);
  });

  it("pulls a single mention (uuid lowercased)", () => {
    expect(extractMentions(`hi @[Moses Maniquiz](${U1.toUpperCase()}) there`)).toEqual([
      { userId: U1, displayName: "Moses Maniquiz" },
    ]);
  });

  it("dedupes the same user mentioned twice (one event per pair)", () => {
    const r = extractMentions(`@[Mo](${U1}) and again @[Mo](${U1})`);
    expect(r).toHaveLength(1);
    expect(r[0]?.userId).toBe(U1);
  });

  it("returns two distinct mentions in order", () => {
    const r = extractMentions(`@[A](${U1}) @[B](${U2})`);
    expect(r.map((m) => m.userId)).toEqual([U1, U2]);
  });

  it("ignores parenthesized text that isn't a UUID (no accidental matches)", () => {
    expect(extractMentions("@[Bob](not-a-uuid) @[Al](12345)")).toEqual([]);
  });
});

describe("tokenizeMentions", () => {
  it("returns a single text segment for plain text", () => {
    expect(tokenizeMentions("hello world")).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("splits text / mention / text in order", () => {
    const segs = tokenizeMentions(`Hey @[Mo](${U1}) ok`);
    expect(segs).toEqual([
      { type: "text", text: "Hey " },
      { type: "mention", displayName: "Mo", userId: U1 },
      { type: "text", text: " ok" },
    ]);
  });

  it("emits no empty leading text segment when a mention starts the string", () => {
    const segs = tokenizeMentions(`@[Mo](${U1}) hi`);
    expect(segs[0]).toEqual({ type: "mention", displayName: "Mo", userId: U1 });
  });

  it("returns [] for empty text", () => {
    expect(tokenizeMentions("")).toEqual([]);
  });
});

describe("stripMentionMarkup", () => {
  it("reduces markup to plain @Name, preserving surrounding text", () => {
    expect(stripMentionMarkup(`hi @[Moses Maniquiz](${U1})!`)).toBe("hi @Moses Maniquiz!");
  });

  it("leaves text without markup unchanged, and empty as empty", () => {
    expect(stripMentionMarkup("no mentions here")).toBe("no mentions here");
    expect(stripMentionMarkup("")).toBe("");
  });
});
