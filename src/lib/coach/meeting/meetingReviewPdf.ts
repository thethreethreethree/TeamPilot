// meetingReviewPdf.ts — a SHAREABLE, colour-coded PDF of a meeting review (founder 2026-09-03: "export to PDF …
// visually appealing … clear indicators … broken apart so the reader easily understands all the important info").
//
// Approach (founder 2026-09-09 "bulletproof real-PDF"): generate a REAL .pdf FILE client-side, DEPENDENCY-FREE
// (reusing the schedule system's raw-PDF primitives — assemblePdf/strBytes/concat/pdfText), and download it. This
// has ZERO reliance on the browser's print dialog — so it works on iOS Safari, Android, and desktop identically
// (the earlier window.open + window.print() path was blank on some browsers and flaky on mobile). `buildMeetingReviewPdf`
// is a PURE bytes builder (unit-tested); `exportMeetingReviewPdf` is the thin browser download action.

import { assemblePdf, strBytes, concat, pdfText } from "@/lib/schedule/writePdf";

export type MeetingReviewDissect = {
  decisions?: { decision: string; context?: string }[];
  actions?: { action: string; owner: string | null }[];
  open_items?: { item: string; why?: string }[];
  openItems?: { item: string; why?: string }[];
  effectiveness?: { focused: boolean; note: string } | null;
  balance?: { balanced: boolean; note: string; dominantSharePct?: number } | null;
  agenda?: {
    goal: string;
    goalAttained: "yes" | "partial" | "no" | "unknown";
    note: string;
    topics: { text: string; covered: boolean }[];
  } | null;
  overall?: string | null;
};

export type MeetingReviewMeta = { title?: string | null; dateISO?: string | null };

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/** The COLOR palette — deliberately chosen (not defaults), consistent indicators the reader learns once. */
const C = {
  ink: "#0f172a", muted: "#64748b", line: "#e2e8f0", card: "#f8fafc",
  brand: "#1e3a5f", brandBar: "#208aef", white: "#ffffff", eyebrow: "#9fc3ee", dateInk: "#cfe0f3",
  good: "#059669", goodBg: "#ecfdf5", warn: "#b45309", warnBg: "#fffbeb", bad: "#dc2626", badBg: "#fef2f2",
};

const PAGE = { w: 595, h: 842 } as const; // A4 portrait, points
const M = 42; // page margin
const CW = PAGE.w - 2 * M; // content width

function rgb(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(((n >> 16) & 255) / 255).toFixed(3)} ${(((n >> 8) & 255) / 255).toFixed(3)} ${((n & 255) / 255).toFixed(3)}`;
}

// Approximate Helvetica advance widths (em fractions) for line wrapping — no font metrics library. Conservative
// (a slight over-estimate wraps a touch early, never overflows the page).
const HW: Record<string, number> = {
  " ": 0.28, i: 0.22, l: 0.22, j: 0.22, I: 0.28, t: 0.3, f: 0.3, r: 0.33, ".": 0.28, ",": 0.28, ";": 0.28,
  ":": 0.28, "'": 0.19, "!": 0.28, "(": 0.33, ")": 0.33, "|": 0.26, m: 0.83, w: 0.72, M: 0.83, W: 0.94,
};
function tw(s: string, size: number): number {
  let u = 0;
  for (const c of s) u += HW[c] ?? 0.56;
  return u * size;
}
function wrap(s: string, maxW: number, size: number): string[] {
  const words = String(s ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (tw(test, size) > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/**
 * PURE: the review as a complete, dependency-free PDF byte stream (colour-coded, sectioned, paginated). Testable —
 * asserts a valid PDF header + that the content text is present in the stream.
 */
export function buildMeetingReviewPdf(dissect: MeetingReviewDissect, meta: MeetingReviewMeta = {}): Uint8Array {
  const decisions = dissect.decisions ?? [];
  const actions = dissect.actions ?? [];
  const openItems = dissect.openItems ?? dissect.open_items ?? [];
  const eff = dissect.effectiveness ?? null;
  const balance = dissect.balance ?? null;
  const agenda = dissect.agenda ?? null;
  const ownerless = actions.filter((a) => !a.owner).length;
  const GOAL: Record<string, { text: string; c: string; bg: string }> = {
    yes: { text: "Goal achieved", c: C.good, bg: C.goodBg },
    partial: { text: "Goal partially met", c: C.warn, bg: C.warnBg },
    no: { text: "Goal not met", c: C.bad, bg: C.badBg },
    unknown: { text: "Goal outcome unclear", c: C.muted, bg: C.card },
  };

  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE.h; // pen y, from the top; PDF origin is bottom-left so we subtract as we go down

  const fill = (x: number, yy: number, w: number, h: number, hex: string) =>
    ops.push(`${rgb(hex)} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  const text = (x: number, yy: number, size: number, hex: string, s: string, bold = false) =>
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(hex)} rg 1 0 0 1 ${x.toFixed(1)} ${yy.toFixed(1)} Tm (${pdfText(s)}) Tj ET`);
  const newPage = () => { pages.push(ops.join("\n")); ops = []; y = PAGE.h - M; };
  const ensure = (h: number) => { if (y - h < M + 28) newPage(); };

  // ── Header band ──────────────────────────────────────────────────────────
  const title = meta.title || "Meeting Review";
  const titleLines = wrap(title, CW, 19).slice(0, 2);
  const bandH = 74 + titleLines.length * 22;
  fill(0, PAGE.h - bandH, PAGE.w, bandH, C.brand);
  fill(0, PAGE.h - 6, PAGE.w, 6, C.brandBar); // top accent strip
  text(M, PAGE.h - 30, 8.5, C.eyebrow, "MEETING REVIEW");
  titleLines.forEach((ln, i) => text(M, PAGE.h - 52 - i * 22, 19, C.white, ln, true));
  const dateStr = fmtDate(meta.dateISO);
  text(M, PAGE.h - 52 - titleLines.length * 22 + 4, 10, C.dateInk, (dateStr ? dateStr + "  ·  " : "") + "Elostate Sales Coach");
  y = PAGE.h - bandH - 24;

  // ── Summary ──────────────────────────────────────────────────────────────
  if (dissect.overall) {
    const lines = wrap(dissect.overall, CW - 28, 11);
    const h = 30 + lines.length * 15;
    ensure(h);
    fill(M, y - h, CW, h, C.card);
    text(M + 14, y - 18, 8, C.muted, "SUMMARY");
    lines.forEach((ln, i) => text(M + 14, y - 34 - i * 15, 11, C.ink, ln));
    y -= h + 18;
  }

  // ── Indicator chips ──────────────────────────────────────────────────────
  const chips: { t: string; c: string; bg: string }[] = [];
  if (eff) chips.push({ t: eff.focused ? "Focused" : "Drifted", c: eff.focused ? C.good : C.warn, bg: eff.focused ? C.goodBg : C.warnBg });
  if (balance) chips.push({ t: balance.balanced ? "Balanced participation" : "Uneven participation", c: balance.balanced ? C.good : C.warn, bg: balance.balanced ? C.goodBg : C.warnBg });
  if (ownerless > 0) chips.push({ t: `${ownerless} action${ownerless > 1 ? "s" : ""} with no owner`, c: C.bad, bg: C.badBg });
  if (actions.length > 0 && ownerless === 0) chips.push({ t: "Every action owned", c: C.good, bg: C.goodBg });
  if (chips.length) {
    ensure(28);
    let cx = M;
    for (const ch of chips) {
      const w = tw(ch.t, 10) + 20;
      if (cx + w > M + CW) { y -= 26; cx = M; ensure(28); }
      fill(cx, y - 18, w, 18, ch.bg);
      text(cx + 10, y - 13, 10, ch.c, ch.t, true);
      cx += w + 8;
    }
    y -= 34;
  }

  // ── Section helper ────────────────────────────────────────────────────────
  const sectionHead = (title2: string, count: number, accent: string) => {
    ensure(30);
    fill(M, y - 16, 4, 16, accent); // left accent bar
    text(M + 12, y - 13, 12.5, C.ink, title2, true);
    const cntTxt = String(count);
    text(M + CW - tw(cntTxt, 11) - 6, y - 12, 11, accent, cntTxt, true);
    y -= 26;
  };
  const card = (mainLines: string[], subLines: string[], rightPill?: { t: string; c: string; bg: string }) => {
    const h = 12 + mainLines.length * 14 + (subLines.length ? subLines.length * 13 + 2 : 0);
    ensure(h + 6);
    fill(M, y - h, CW, h, C.card);
    const innerW = rightPill ? CW - 28 - (tw(rightPill.t, 9.5) + 20) : CW - 28;
    // (mainLines were wrapped to innerW by the caller)
    void innerW;
    mainLines.forEach((ln, i) => text(M + 14, y - 16 - i * 14, 11.5, C.ink, ln));
    subLines.forEach((ln, i) => text(M + 14, y - 16 - mainLines.length * 14 - 2 - i * 13, 10, C.muted, ln));
    if (rightPill) {
      const pw = tw(rightPill.t, 9.5) + 18;
      fill(M + CW - pw - 10, y - 24, pw, 17, rightPill.bg);
      text(M + CW - pw - 1, y - 19.5, 9.5, rightPill.c, rightPill.t, true);
    }
    y -= h + 8;
  };

  const nothing = decisions.length === 0 && actions.length === 0 && openItems.length === 0 && !eff && !agenda;
  if (nothing) {
    const lines = wrap("This meeting didn't produce clear decisions or actions to capture - a short or exploratory discussion. That's an honest read, not a failure.", CW - 28, 11);
    const h = 24 + lines.length * 15;
    ensure(h);
    fill(M, y - h, CW, h, C.card);
    lines.forEach((ln, i) => text(M + 14, y - 20 - i * 15, 11, C.muted, ln));
    y -= h + 16;
  }

  // ── Agenda coverage ───────────────────────────────────────────────────────
  if (agenda) {
    sectionHead("Agenda coverage", agenda.topics.length, C.brandBar);
    if (agenda.goal) card(wrap("Goal: " + agenda.goal, CW - 28, 11.5), []);
    const g = GOAL[agenda.goalAttained] ?? GOAL.unknown!;
    const gt = g.text + (agenda.note ? " - " + agenda.note : "");
    for (const ln of wrap(gt, CW - 28, 10.5)) { ensure(18); text(M + 2, y - 12, 10.5, g.c, ln, true); y -= 16; }
    y -= 2;
    for (const t of agenda.topics) {
      const tl = wrap(t.text, CW - 70, 11);
      const rowH = Math.max(16, tl.length * 13 + 3);
      ensure(rowH);
      fill(M + 3, y - 13, 8, 8, t.covered ? C.good : C.bad); // colored status dot (covered = green, missed = red)
      tl.forEach((ln, i) => text(M + 22, y - 12 - i * 13, 11, t.covered ? C.ink : C.muted, ln));
      if (!t.covered) text(M + CW - tw("missed", 9) - 12, y - 11, 9, C.bad, "missed", true);
      y -= rowH;
    }
    y -= 10;
  }

  // ── Decisions ─────────────────────────────────────────────────────────────
  if (decisions.length) {
    sectionHead("Decisions reached", decisions.length, C.good);
    decisions.forEach((d, i) => card(wrap(`${i + 1}.  ${d.decision}`, CW - 28, 11.5), d.context ? wrap(d.context, CW - 28, 10) : []));
    y -= 4;
  }

  // ── Action items ──────────────────────────────────────────────────────────
  if (actions.length) {
    sectionHead("Action items", actions.length, C.brandBar);
    for (const a of actions) {
      const pill = a.owner
        ? { t: (a.owner as string), c: C.good, bg: C.goodBg }
        : { t: "No owner", c: C.bad, bg: C.badBg };
      const mainW = CW - 28 - (tw(pill.t, 9.5) + 24);
      card(wrap(a.action, mainW, 11.5), [], pill);
    }
    y -= 4;
  }

  // ── Left open ─────────────────────────────────────────────────────────────
  if (openItems.length) {
    sectionHead("Left open", openItems.length, C.warn);
    openItems.forEach((o) => card(wrap(o.item, CW - 28, 11.5), o.why ? wrap(o.why, CW - 28, 10) : []));
  }

  // Footer on the final page.
  text(M, 30, 8.5, C.muted, "Generated " + fmtDate(new Date().toISOString()) + "  ·  Elostate Sales Coach");
  text(M + CW - tw("Confidential · share within your team", 8.5), 30, 8.5, C.muted, "Confidential · share within your team");
  pages.push(ops.join("\n"));

  // ── Assemble the PDF object graph ─────────────────────────────────────────
  // obj 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold, pages 5..4+k, contents 5+k..4+2k
  const k = pages.length;
  const kids = Array.from({ length: k }, (_, i) => `${5 + i} 0 R`).join(" ");
  const bodies: Uint8Array[] = [
    strBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    strBytes(`<< /Type /Pages /Kids [${kids}] /Count ${k} >>`),
    strBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    strBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
  ];
  for (let i = 0; i < k; i++) {
    bodies.push(strBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${5 + k + i} 0 R >>`));
  }
  for (let i = 0; i < k; i++) {
    const cb = strBytes(pages[i]!);
    bodies.push(concat([strBytes(`<< /Length ${cb.length} >>\nstream\n`), cb, strBytes("\nendstream")]));
  }
  return assemblePdf(bodies, 1);
}

/** A filename-safe slug for the download. */
function slug(s?: string | null): string {
  return (s || "meeting-review").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "meeting-review";
}

/**
 * Browser action: build the real PDF and download it. Returns false only if the DOM isn't available or generation
 * throws (the caller surfaces an honest error). No pop-up, no print dialog — so nothing to be "blocked".
 */
export function exportMeetingReviewPdf(dissect: MeetingReviewDissect, meta: MeetingReviewMeta = {}): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const bytes = buildMeetingReviewPdf(dissect, meta);
    const blob = new Blob([bytes.slice()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(meta.title)}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}
