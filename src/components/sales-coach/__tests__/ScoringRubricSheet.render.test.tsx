// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ScoringRubricSheet } from "../ScoringRubricSheet";
import {
  BASE_MAX,
  BONUSES,
  BONUS_CAP,
  MAX_SCORE,
  SECTIONS,
  VIOLATIONS,
  elementsForSection,
} from "@/lib/coach/pitchScore/rubric";

/**
 * The guide's requirement for this screen is "read-only, rendered from rubric_config so it never
 * goes stale", and the launch checklist repeats it as "Scoring rubric screens match the live
 * config".
 *
 * So these tests iterate the CONFIG and assert the screen shows it, rather than listing labels.
 * A hard-coded expectation would rot in exactly the same way the screen would, and pass while the
 * two drifted apart. Add a bonus to the rubric and this file already covers it.
 */

afterEach(cleanup);

const open = () => render(<ScoringRubricSheet onClose={vi.fn()} />);

/**
 * Find a section's expand toggle by its label.
 *
 * Deliberately NOT getByRole("button", { name: /Close/ }): the rubric has a section called Close
 * AND the sheet has a dismiss button, so a name query matches two different controls. Scoping to
 * the elements that carry aria-expanded picks the toggles and nothing else.
 */
const sectionToggle = (label: string): HTMLElement => {
  // queryAllByRole, not getAllByRole: the latter THROWS on zero matches, and with every section
  // collapsed there are no expanded:true buttons at all.
  const match = screen
    .queryAllByRole("button", { expanded: false })
    .concat(screen.queryAllByRole("button", { expanded: true }))
    .find((b) => b.textContent?.startsWith(label));
  if (!match) throw new Error(`no section toggle labelled ${label}`);
  return match;
};

describe("renders the whole rubric from config", () => {
  it("shows the arithmetic the rubric states", () => {
    open();
    expect(screen.getByText(String(BASE_MAX))).toBeTruthy();
    expect(screen.getByText(String(BONUS_CAP))).toBeTruthy();
    expect(screen.getByText(String(MAX_SCORE))).toBeTruthy();
    expect(MAX_SCORE).toBe(130);
  });

  it("lists every section with its max, and no others", () => {
    const { container } = open();
    for (const s of SECTIONS) {
      expect(screen.getByText(s.label), `${s.label} missing`).toBeTruthy();
      expect(screen.getByText(`${s.maxPoints} pts`), `${s.label} points missing`).toBeTruthy();
    }
    // Section count is asserted so a stray hard-coded row would be caught too.
    const toggles = container.querySelectorAll("button[aria-expanded]");
    expect(toggles).toHaveLength(SECTIONS.length);
  });

  it("reveals every element of a section when it is expanded", () => {
    open();
    // Close is the section the boards flag as lowest, and the one whose five elements the mockup
    // prints in full — a good proxy for "the expansion shows real config".
    fireEvent.click(sectionToggle("Close"));
    for (const el of elementsForSection("close")) {
      expect(screen.getByText(el.label), `${el.label} missing`).toBeTruthy();
      expect(screen.getByText(el.whatCounts), `${el.label} description missing`).toBeTruthy();
    }
  });

  it("starts with every section collapsed, so the bonus and violation tables stay reachable", () => {
    const { container } = open();
    for (const t of container.querySelectorAll("button[aria-expanded]")) {
      expect(t.getAttribute("aria-expanded")).toBe("false");
    }
    // An element from a collapsed section must not be on screen yet.
    expect(screen.queryByText(elementsForSection("close")[0]!.label)).toBeNull();
  });

  it("lists ALL 13 bonuses with their points and detection notes", () => {
    open();
    for (const b of BONUSES) {
      expect(screen.getByText(b.label), `${b.label} missing`).toBeTruthy();
      // getAllByText, not getByText: DIRECTV, Wireless and ADT deliberately share the note
      // "An actual pitch, not a passing mention", so a single-match query throws on real config.
      expect(screen.getAllByText(b.detectionNotes).length, `${b.label} notes missing`).toBeGreaterThan(0);
    }
    expect(BONUSES).toHaveLength(13);
  });

  it("marks the repeatable bonus as per-occurrence rather than a flat award", () => {
    // Buying questions are "+2 each, max +6". Printing a bare "+2" would understate it.
    open();
    const repeatable = BONUSES.filter((b) => b.repeatable);
    expect(repeatable).toHaveLength(1);
    expect(screen.getByText(`+${repeatable[0]!.points} ea`)).toBeTruthy();
  });

  it("lists ALL 5 violations with their deduction, trigger and cap", () => {
    open();
    for (const v of VIOLATIONS) {
      expect(screen.getByText(v.label), `${v.label} missing`).toBeTruthy();
      expect(screen.getByText(v.trigger), `${v.label} trigger missing`).toBeTruthy();
    }
    expect(VIOLATIONS).toHaveLength(5);
    // Talking over is "−2 each, max −6" — the cap has to be visible or the number reads as harsher
    // than it is.
    expect(screen.getByText(/−2 ea · max −6/)).toBeTruthy();
  });

  it("states the competition rules, including the two thresholds that decide what counts", () => {
    open();
    expect(screen.getByText(/reaches Discovery and scores 40\+ base points/)).toBeTruthy();
    expect(screen.getByText(/5 counted pitches minimum to be prize eligible/)).toBeTruthy();
    expect(screen.getByText(/never scores below 0/)).toBeTruthy();
  });

  it("says the point does not have to be scripted — the grading rule reps most need to read", () => {
    open();
    expect(screen.getByText(/don't need to say the script word for word/i)).toBeTruthy();
    for (const g of ["HIT", "PARTIAL", "MISSED"]) expect(screen.getByText(g)).toBeTruthy();
  });

  it("says bonuses come from the recording, not from the rep", () => {
    // The rubric is explicit that none come from rep self-reporting, and a rep reading this screen
    // is the person most likely to wonder whether to claim one.
    open();
    expect(screen.getByText(/All bonuses are detected from the recording/)).toBeTruthy();
  });
});

describe("it is a sheet over the boards, not a destination", () => {
  it("closes on the X, on the backdrop and on Escape", () => {
    const onClose = vi.fn();
    const { container } = render(<ScoringRubricSheet onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close rubric" }));
    fireEvent.click(container.querySelector('[role="dialog"]')!);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when the sheet body itself is clicked", () => {
    // Without stopPropagation the backdrop handler fires on every click inside, so expanding a
    // section would dismiss the sheet.
    const onClose = vi.fn();
    render(<ScoringRubricSheet onClose={onClose} />);
    fireEvent.click(screen.getByText("How points work"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("restores body scroll on unmount", () => {
    const { unmount } = open();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("staleness guard", () => {
  it("renders a count of rows that matches the config, not a hard-coded list", () => {
    // The point of the whole file: if someone adds a violation to the rubric and forgets this
    // screen, the count assertion fails rather than the screen quietly omitting it.
    const { container } = open();
    const bonusLabels = BONUSES.map((b) => b.label);
    const violationLabels = VIOLATIONS.map((v) => v.label);
    const body = container.textContent ?? "";
    for (const label of [...bonusLabels, ...violationLabels]) {
      expect(body.includes(label), `config item not rendered: ${label}`).toBe(true);
    }
  });

  it("every element of every section appears once expanded", () => {
    const { container } = open();
    for (const section of SECTIONS) {
      fireEvent.click(sectionToggle(section.label));
    }
    const body = container.textContent ?? "";
    for (const s of SECTIONS) {
      for (const el of elementsForSection(s.id)) {
        expect(body.includes(el.label), `element not rendered: ${el.id}`).toBe(true);
      }
    }
    // Sanity: that is every element in the rubric — 30 of them
    // (Introduction 4, Discovery 5, Consulting 6, Close 5, Transitions 4, Delivery 6).
    const total = SECTIONS.reduce((n, s) => n + elementsForSection(s.id).length, 0);
    expect(total).toBe(30);
  });
});

describe("accessibility basics", () => {
  it("is a labelled modal dialog", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "How points work" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("marks each section toggle with its expanded state", () => {
    open();
    const close = sectionToggle("Close");
    expect(close.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(close);
    expect(sectionToggle("Close").getAttribute("aria-expanded")).toBe("true");
  });
});
