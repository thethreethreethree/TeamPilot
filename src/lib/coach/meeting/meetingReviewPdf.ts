// meetingReviewPdf.ts — build a polished, SHAREABLE PDF of a meeting review (founder 2026-09-03: "export to PDF …
// visually appealing … clear indicators … broken apart so the reader easily understands all the important info").
//
// Approach: a SELF-CONTAINED, print-optimized HTML document (inline CSS, no app theme / tailwind to fight) opened
// in a new window that triggers the browser's Save-as-PDF. Self-contained = full design control + it prints in
// COLOR (print-color-adjust: exact — the AMD-012 lesson: a monochrome export is a failed export when the founder
// asked for color). `buildMeetingReviewHtml` is a PURE function (unit-tested); `exportMeetingReviewPdf` is the thin
// browser action. All user/transcript-derived text is HTML-escaped (it can contain < & and is model output).

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

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/** The COLOR palette — deliberately chosen (not defaults), consistent indicators the reader learns once. */
const C = {
  ink: "#0f172a", muted: "#64748b", line: "#e2e8f0", card: "#f8fafc", page: "#ffffff",
  brand: "#1e3a5f", brandBar: "#208aef",
  good: "#059669", goodBg: "#ecfdf5", warn: "#b45309", warnBg: "#fffbeb", bad: "#dc2626", badBg: "#fef2f2",
};

/** A section header with an icon, title, and a count badge — the "broken apart, clearly indicated" structure. */
function sectionHead(icon: string, title: string, count: number, accent: string): string {
  return `<div class="sec-head" style="border-left-color:${accent}">
    <span class="sec-icon" style="background:${accent}1a;color:${accent}">${icon}</span>
    <h2>${esc(title)}</h2>
    <span class="count" style="background:${accent}1a;color:${accent}">${count}</span>
  </div>`;
}

/** PURE: the complete standalone HTML document for the review. Testable (asserts sections + the owner-less flag). */
export function buildMeetingReviewHtml(dissect: MeetingReviewDissect, meta: MeetingReviewMeta = {}): string {
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

  // Quick-read indicator chips (top of the doc): effectiveness, balance, owner-less-actions alarm.
  const chips: string[] = [];
  if (eff) chips.push(chip(eff.focused ? "Focused" : "Drifted", eff.focused ? C.good : C.warn, eff.focused ? C.goodBg : C.warnBg));
  if (balance) chips.push(chip(balance.balanced ? "Balanced participation" : "Uneven participation", balance.balanced ? C.good : C.warn, balance.balanced ? C.goodBg : C.warnBg));
  if (ownerless > 0) chips.push(chip(`${ownerless} action${ownerless > 1 ? "s" : ""} with no owner`, C.bad, C.badBg));
  if (actions.length > 0 && ownerless === 0) chips.push(chip("Every action owned", C.good, C.goodBg));

  const dateStr = fmtDate(meta.dateISO);
  const nothing = decisions.length === 0 && actions.length === 0 && openItems.length === 0 && !eff && !agenda;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Meeting Review${meta.title ? " — " + esc(meta.title) : ""}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html,body { margin:0; padding:0; background:#eef2f6; color:${C.ink};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .page { max-width: 820px; margin: 24px auto; background:${C.page}; }
  .band { background:${C.brand}; color:#fff; padding: 28px 40px; border-top: 6px solid ${C.brandBar}; }
  .eyebrow { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color:#9fc3ee; margin:0 0 6px; }
  .band h1 { font-size: 26px; margin:0; font-weight: 700; line-height:1.15; }
  .band .meta { margin-top: 8px; font-size: 13px; color:#cfe0f3; }
  .body { padding: 28px 40px 40px; }
  .summary { background:${C.card}; border:1px solid ${C.line}; border-radius: 10px; padding: 16px 18px; margin-bottom: 20px; }
  .summary .lbl { font-size: 11px; letter-spacing:.1em; text-transform:uppercase; color:${C.muted}; margin:0 0 6px; }
  .summary p { margin:0; font-size: 15px; line-height:1.5; color:${C.ink}; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom: 24px; }
  .chip { font-size: 12.5px; font-weight:600; padding: 5px 11px; border-radius: 999px; }
  section { margin-bottom: 22px; page-break-inside: avoid; }
  .sec-head { display:flex; align-items:center; gap:10px; border-left:4px solid; padding-left:12px; margin-bottom:12px; }
  .sec-head h2 { font-size: 15px; margin:0; font-weight:700; letter-spacing:.01em; flex:1; }
  .sec-icon { width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:14px; }
  .count { font-size:12px; font-weight:700; min-width:22px; text-align:center; padding:2px 7px; border-radius:999px; }
  .card { border:1px solid ${C.line}; border-radius:9px; padding:12px 14px; margin-bottom:8px; page-break-inside:avoid; }
  .card .t { font-size:14px; line-height:1.45; color:${C.ink}; margin:0; }
  .card .sub { font-size:12.5px; color:${C.muted}; margin:4px 0 0; line-height:1.4; }
  .act { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .pill { font-size:12px; font-weight:600; padding:4px 10px; border-radius:999px; white-space:nowrap; }
  .num { display:inline-flex; width:20px; height:20px; border-radius:50%; background:${C.brand}; color:#fff; font-size:11px;
    font-weight:700; align-items:center; justify-content:center; margin-right:8px; vertical-align:1px; }
  .topic { display:flex; align-items:center; gap:9px; font-size:13.5px; padding:5px 0; border-bottom:1px solid ${C.line}; }
  .topic:last-child { border-bottom:0; }
  .goal { display:inline-block; font-size:12.5px; font-weight:600; padding:4px 11px; border-radius:999px; margin:8px 0; }
  .foot { border-top:1px solid ${C.line}; margin-top:8px; padding: 16px 40px 26px; font-size:11px; color:${C.muted};
    display:flex; justify-content:space-between; align-items:center; }
  .empty { font-size:14px; color:${C.muted}; background:${C.card}; border:1px dashed ${C.line}; border-radius:10px; padding:18px; }
  @media print { html, body { background:#fff !important; } .page { margin:0; max-width:none; } @page { margin: 12mm; } }
</style></head><body>
<div class="page">
  <div class="band">
    <p class="eyebrow">Meeting Review</p>
    <h1>${esc(meta.title || "Meeting Review")}</h1>
    <div class="meta">${dateStr ? esc(dateStr) + " · " : ""}Elostate Sales Coach</div>
  </div>
  <div class="body">
    ${dissect.overall ? `<div class="summary"><p class="lbl">Summary</p><p>${esc(dissect.overall)}</p></div>` : ""}
    ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
    ${nothing ? `<div class="empty">This meeting didn't produce clear decisions or actions to capture — a short or exploratory discussion. That's an honest read, not a failure.</div>` : ""}
    ${agenda ? `<section>${sectionHead("&#127919;", "Agenda coverage", agenda.topics.length, C.brandBar)}
      ${agenda.goal ? `<p class="card t"><strong>Goal:</strong> ${esc(agenda.goal)}</p>` : ""}
      <div class="goal" style="color:${(GOAL[agenda.goalAttained] ?? GOAL.unknown!).c};background:${(GOAL[agenda.goalAttained] ?? GOAL.unknown!).bg}">${esc((GOAL[agenda.goalAttained] ?? GOAL.unknown!).text)}${agenda.note ? " — " + esc(agenda.note) : ""}</div>
      ${agenda.topics.map((t) => `<div class="topic"><span style="color:${t.covered ? C.good : C.bad};font-weight:700">${t.covered ? "&#10003;" : "&#10007;"}</span><span style="color:${t.covered ? C.ink : C.muted}">${esc(t.text)}</span>${t.covered ? "" : `<span class="pill" style="color:${C.bad};background:${C.badBg}">missed</span>`}</div>`).join("")}
    </section>` : ""}
    ${decisions.length ? `<section>${sectionHead("&#9989;", "Decisions reached", decisions.length, C.good)}
      ${decisions.map((d, i) => `<div class="card"><p class="t"><span class="num">${i + 1}</span>${esc(d.decision)}</p>${d.context ? `<p class="sub">${esc(d.context)}</p>` : ""}</div>`).join("")}
    </section>` : ""}
    ${actions.length ? `<section>${sectionHead("&#128205;", "Action items", actions.length, C.brandBar)}
      ${actions.map((a) => `<div class="card act"><p class="t">${esc(a.action)}</p>${a.owner ? `<span class="pill" style="color:${C.good};background:${C.goodBg}">&#128100; ${esc(a.owner)}</span>` : `<span class="pill" style="color:${C.bad};background:${C.badBg}">&#9888; No owner</span>`}</div>`).join("")}
    </section>` : ""}
    ${openItems.length ? `<section>${sectionHead("&#128275;", "Left open", openItems.length, C.warn)}
      ${openItems.map((o) => `<div class="card"><p class="t">${esc(o.item)}</p>${o.why ? `<p class="sub">${esc(o.why)}</p>` : ""}</div>`).join("")}
    </section>` : ""}
  </div>
  <div class="foot"><span>Generated ${esc(fmtDate(new Date().toISOString()))} · Elostate Sales Coach</span><span>Confidential — share within your team</span></div>
</div></body></html>`;
}

function chip(text: string, color: string, bg: string): string {
  return `<span class="chip" style="color:${color};background:${bg}">${esc(text)}</span>`;
}

/** Browser action: open the self-contained doc in a new window and invoke print → Save as PDF. Returns false if a
 *  popup blocker prevented it (the caller surfaces a hint). */
export function exportMeetingReviewPdf(dissect: MeetingReviewDissect, meta: MeetingReviewMeta = {}): boolean {
  if (typeof window === "undefined") return false;
  const html = buildMeetingReviewHtml(dissect, meta);
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!w) return false; // popup blocked
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Print after the document paints (two rAFs, mirroring the schedule export's "don't print a blank page" guard).
  const go = () => w.requestAnimationFrame(() => w.requestAnimationFrame(() => w.print()));
  if (w.document.readyState === "complete") go();
  else w.addEventListener("load", go);
  return true;
}
