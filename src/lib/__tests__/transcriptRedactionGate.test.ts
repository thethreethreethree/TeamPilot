import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { transcriptTextForStorage, REDACTED } from "@/lib/coach/remote/redact";

/**
 * EVERY TRANSCRIPT WRITER REDACTS (D15; 2026-11-23). Number redaction ran only in appendTranscriptSegment; the uploaded-
 * recording / recovery path (replace_session_transcript) and the line-correction route (edit_transcript_line) stored
 * text as heard, so a card number read out on an uploaded call was kept in full. A file that sends transcript text to
 * the database through any of these must also call transcriptTextForStorage.
 */
const WRITERS = /rpc\(\s*["'](replace_session_transcript|edit_transcript_line)["']|from\(\s*["']coaching_transcript_segments["']\s*\)\s*\.insert/;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("transcript number redaction on every write path", () => {
  it("the helper removes a card number and leaves short numbers alone", () => {
    expect(transcriptTextForStorage("my card is 4111 1111 1111 1111 and it costs 49.99")).toBe(`my card is ${REDACTED} and it costs 49.99`);
  });
  it("every file that writes transcript text uses transcriptTextForStorage", () => {
    const root = process.cwd();
    const missing: string[] = [];
    let writers = 0;
    for (const f of files(join(root, "src"))) {
      const src = readFileSync(f, "utf8");
      if (!WRITERS.test(src)) continue;
      writers += 1;
      if (!src.includes("transcriptTextForStorage(")) missing.push(relative(root, f));
    }
    expect(writers).toBeGreaterThanOrEqual(2); // salesCoach.ts (append + replace) and the transcript-edit route
    expect(missing).toEqual([]);
  });
});
