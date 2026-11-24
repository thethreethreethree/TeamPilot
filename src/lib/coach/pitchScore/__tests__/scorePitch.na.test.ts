import { describe, it, expect } from "vitest";
import { scorePitch, type GradedElement } from "../scorePitch";
import { DOOR_RUBRIC } from "../rubricRegistry";

/**
 * "Doesn't apply" (0331, ledger F15.5; founder 2026-11-24 "Managers, when correcting"): an N/A item's points leave its
 * section's maximum and the section is scaled back to full — the rubric's rule for Objection handling, for any item.
 */
const allHit = (): GradedElement[] => DOOR_RUBRIC.elements.map((e) => ({ elementId: e.id, grade: "hit" }));
const intro = DOOR_RUBRIC.sections.find((s) => s.id === "introduction")!;

describe("scorePitch — N/A", () => {
  it("no N/A anywhere: identical to before (door regression)", () => {
    const a = scorePitch({ elements: allHit(), objectionOccurred: true, reachedDiscovery: true });
    expect(a.base).toBe(100);
    const withMiss = allHit().map((g) => (g.elementId === "intro.trucks" ? { ...g, grade: "missed" as const } : g));
    expect(scorePitch({ elements: withMiss, objectionOccurred: true, reachedDiscovery: true }).sectionPoints.introduction).toBe(intro.maxPoints - 3);
  });

  it("an N/A item doesn't cost points: the rest of the section is scaled to the section's full value", () => {
    const els = allHit().map((g) => (g.elementId === "intro.trucks" ? { ...g, grade: "na" as const } : g));
    const s = scorePitch({ elements: els, objectionOccurred: true, reachedDiscovery: true });
    expect(s.sectionPoints.introduction).toBe(intro.maxPoints);
    expect(s.base).toBe(100);
    expect(s.elementBreakdown.find((e) => e.elementId === "intro.trucks")).toMatchObject({ grade: "na", points: 0 });
  });

  it("the other items in the section still count, out of what applied", () => {
    // intro: 4 × 3 points = 12. trucks N/A → out of 9; who missed → 6/9 → 8 of 12.
    const els = allHit().map((g) =>
      g.elementId === "intro.trucks" ? { ...g, grade: "na" as const } : g.elementId === "intro.who" ? { ...g, grade: "missed" as const } : g,
    );
    const s = scorePitch({ elements: els, objectionOccurred: true, reachedDiscovery: true });
    expect(s.sectionPoints.introduction).toBe(r1((6 / 9) * intro.maxPoints));
  });

  it("N/A inside Delivery when there was no objection: scaled once, over what applied", () => {
    const els = allHit().map((g) => (g.elementId === "deliv.pace" ? { ...g, grade: "na" as const } : g));
    const s = scorePitch({ elements: els, objectionOccurred: false, reachedDiscovery: true });
    expect(s.sectionPoints.delivery).toBe(35);
    expect(s.deliveryScaled).toBe(true);
  });
});
const r1 = (n: number) => Math.round(n * 10) / 10;
