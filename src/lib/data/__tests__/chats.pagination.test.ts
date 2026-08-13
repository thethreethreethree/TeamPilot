import { describe, it, expect, vi } from "vitest";

/**
 * fetchMessages must PAGE past PostgREST's 1000-row cap (audit 2026-08-14). A raw .select() silently returns
 * only the first 1000 rows; with the ascending order that dropped the NEWEST messages, so a busy channel looked
 * frozen in the past. This locks the fix: a >1000-message thread returns ALL of them. A regression to the
 * unbounded read would cap at 1000 and fail this test.
 */

const PAGE = 1000;
// Page 0 = a FULL page (1000 rows) → fetchAllPaged keeps going; page 1 = a short page (5 rows) → the end.
const row = (i: number) => ({
  id: `m${i}`,
  topic_id: "t1",
  author_id: null,
  kind: "message",
  body: "x",
  media_url: null,
  media_type: null,
  reply_to_id: null,
  ai_assisted: false,
  created_at: "2026-01-01T00:00:00Z",
  edited_at: null,
});
const messagePages = [
  Array.from({ length: PAGE }, (_, i) => row(i)), // page 0: exactly 1000 → NOT the end
  Array.from({ length: 5 }, (_, i) => row(PAGE + i)), // page 1: 5 → short page → end (total 1005)
];

vi.mock("@/lib/supabase/client", () => {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "is", "in", "order", "maybeSingle"]) b[m] = () => b;
  // The messages read ends in .range(from,to) — return the page for that window.
  b.range = (from: number) => ({
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: messagePages[Math.floor(from / PAGE)] ?? [], error: null }),
  });
  // pins + author-name reads are awaited directly (no .range) → empty.
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return { supabaseEnabled: true, createClient: () => b };
});

import { fetchMessages } from "../chats";

describe("fetchMessages — pages past the 1000-row cap", () => {
  it("returns ALL messages of a >1000-message thread (not just the first 1000)", async () => {
    const msgs = await fetchMessages("t1");
    expect(msgs).toHaveLength(1005); // 1000 (page 0) + 5 (page 1) — the newest were NOT dropped
    expect(msgs[1004]?.id).toBe(`m${PAGE + 4}`); // the very newest message is present
  });
});
