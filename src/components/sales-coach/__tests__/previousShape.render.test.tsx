// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { survivesWithout, withoutField } from "@/test/previousShape";
import { ReviewFlagQueue } from "../ReviewFlagQueue";
import { PatternActions } from "../PatternActions";
import RepProgressBoard from "../RepProgressBoard";
import type { PatternRow } from "@/lib/coach/patterns/readPatterns";
import type { TeamCards, RepProgressRow } from "@/lib/coach/patterns/repProgress";

/**
 * Every surface that gained a wire field on 2026-09-22, mounted against the response shape it was
 * NOT compiled for.
 *
 * THE CASE THIS COVERS IS NOT HYPOTHETICAL AND IT HAPPENED THREE TIMES IN ONE DAY. A browser
 * holds its JS bundle across a deploy, so a client compiled against today's response is routinely
 * handed yesterday's. Each of the three fields below took a whole surface down through that path
 * before it was hardened:
 *
 *   `events`      → `undefined.filter` inside useMemo — the Rep progress tab
 *   `comparison`  → `undefined.thenMisses` — the "where each pattern stands" table
 *   `reviewFlags` → `undefined.length` — six Coach Assessment board tests
 *
 * Typecheck says the field is there. Over the wire a type is a promise, not a fact.
 *
 * The bar is **renders without throwing**, not "renders correctly". A surface handed an older
 * response cannot show what it does not have; it must degrade, not take the tree with it.
 */

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
});
afterEach(cleanup);

/* ── fixtures at TODAY's shape ─────────────────────────────────────────────────────────────── */

const pattern = (over: Partial<PatternRow> = {}): PatternRow =>
  ({
    id: "p1",
    repId: "rep-1",
    itemId: "intro.trucks",
    itemKind: "element",
    label: "Trucks / neighborhood notice",
    section: "INTRODUCTION",
    firstSeen: "2026-09-10T10:00:00Z",
    missesAtDetection: 3,
    applicableAtDetection: 10,
    costPerPitch: 2.3,
    strip: [],
    coachedAt: "2026-09-11T10:00:00Z",
    fixedAt: null,
    repReviewed: false,
    events: [{ kind: "coached", at: "2026-09-11T10:00:00Z", actorId: "mgr-1", body: "Notice first." }],
    verdict: {
      status: "stalled",
      open: true,
      reason: "Coached 8 days ago with no improvement",
      streak: 0,
      comparison: { thenMisses: 3, thenOf: 5, nowMisses: 3, nowOf: 5, direction: "flat" },
    },
    daysOpen: 9,
    ...over,
  }) as PatternRow;

const CARDS: TeamCards = {
  openPatterns: 3,
  acrossReps: 1,
  fixedThisMonth: 0,
  avgDaysToFix: null,
  stalled: 1,
  awaitingRepReview: 0,
  pointsRecovered: 0,
};

const REP: RepProgressRow = {
  repId: "rep-1",
  fullName: "Anthony A.",
  fixed: 0,
  improving: 0,
  stillOpen: 1,
  openTotal: 1,
  attention: "needs_1_1",
  attentionReason: "1 pattern coached over a week ago with no change since",
};

/* ── the cases ─────────────────────────────────────────────────────────────────────────────── */

describe("a surface handed yesterday's response degrades, it does not throw", () => {
  it("survives every field added on 2026-09-22", async () => {
    const results = await survivesWithout([
      {
        // Took the Rep progress tab down through useMemo when the fixture lacked it.
        field: "PatternRow.events",
        render: () => (
          <RepProgressBoard
            progress={{ cards: CARDS, reps: [REP] }}
            patterns={[withoutField(pattern(), "events")]}
          />
        ),
      },
      {
        // `verdict.comparison` is nested, so the whole verdict is replaced with the older shape.
        field: "StatusVerdict.comparison",
        render: () => (
          <RepProgressBoard
            progress={{ cards: CARDS, reps: [REP] }}
            patterns={[
              pattern({
                verdict: withoutField(pattern().verdict, "comparison") as PatternRow["verdict"],
              }),
            ]}
          />
        ),
      },
      {
        field: "PatternRow.events (PatternActions)",
        render: () => (
          <PatternActions
            pattern={withoutField(pattern(), "events")}
            isManager
            viewerId="mgr-1"
            nameByActor={{}}
            onWritten={() => {}}
          />
        ),
      },
      {
        // The third one, and the reason this file exists.
        field: "reviewFlags",
        render: () => <ReviewFlagQueue flags={undefined} onReviewed={() => {}} />,
      },
    ]);

    const broken = results.filter((r) => r.threw !== null);
    expect(
      broken,
      `these surfaces threw when a field was missing:\n${broken
        .map((b) => `  · ${b.field} — ${b.threw}`)
        .join("\n")}`
    ).toEqual([]);
  });
});

describe("the helper itself can fail", () => {
  it("REPORTS a throw rather than swallowing it", async () => {
    // A harness that cannot fail is a green light with extra steps. This proves the detector
    // detects — the same planted-probe discipline the two audits use.
    const Boom = ({ xs }: { xs: number[] | undefined }) => <div>{xs!.length}</div>;
    const [result] = await survivesWithout([
      { field: "xs", render: () => <Boom xs={undefined} /> },
    ]);
    expect(result!.threw).toMatch(/length/);
  });

  it("does not mutate the caller's fixture", async () => {
    // A helper that deleted a key in place would make the NEXT test in a file fail for a reason
    // that has nothing to do with it — the worst kind of test failure to diagnose.
    const wire = { a: 1, b: 2 };
    const stripped = withoutField(wire, "b");
    expect(stripped).toEqual({ a: 1 });
    expect(wire).toEqual({ a: 1, b: 2 });
  });
});
