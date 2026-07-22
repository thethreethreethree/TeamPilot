// C.A.R.E extension — per-site adapters (Phase 2, spec: "(B) Per-site adapters = TOP 10 platform").
//
// The universal path (A) reads window.getSelection() — works everywhere but needs the user to highlight. An
// adapter reads the OPEN conversation straight from the page DOM, so on a known platform the user can click
// "Read this conversation" instead of highlighting.
//
// HONESTY (§3.4): every extract() is best-effort against a third-party DOM we don't control and CANNOT verify
// headlessly. So every extract() is wrapped to return "" on any miss — and content.js treats "" as "couldn't
// auto-read, fall back to manual selection". A wrong selector is therefore harmless: it degrades to the
// universal path, never fakes content. The selectors below are reasoned, not confirmed in-browser; they are
// labeled UNVERIFIED and are meant to be tightened per platform once the founder confirms each live.
//
// Injected alongside config.js + content.js (shared isolated world), so content.js can read CARE_ADAPTERS.

const CARE_ADAPTERS = [
  {
    key: "gmail",
    label: "email thread",
    match: (h) => h === "mail.google.com",
    // Gmail message bodies render in `.a3s`; the open thread stacks them. Grab visible ones in order.
    extract: () => textFrom(".a3s"),
  },
  {
    key: "outlook",
    label: "email thread",
    match: (h) => h === "outlook.office.com" || h === "outlook.office365.com" || h === "outlook.live.com",
    extract: () => textFrom('[aria-label="Message body"], .allowTextSelection, [role="document"]'),
  },
  {
    key: "instagram",
    label: "DM thread",
    match: (h) => h === "www.instagram.com" || h === "instagram.com",
    // IG DM message rows live inside the conversation grid; message text spans have dir="auto".
    extract: () => textFrom('div[role="grid"] div[dir="auto"], div[aria-label*="Message"] div[dir="auto"]'),
  },
  {
    key: "messenger",
    label: "chat",
    match: (h) => h === "www.messenger.com" || h === "messenger.com" || h === "www.facebook.com" || h === "facebook.com",
    extract: () => textFrom('div[role="main"] div[dir="auto"]'),
  },
  {
    key: "whatsapp",
    label: "chat",
    match: (h) => h === "web.whatsapp.com",
    // WhatsApp Web message text is in .selectable-text spans inside .message-in/.message-out bubbles.
    extract: () => textFrom(".message-in .selectable-text, .message-out .selectable-text"),
  },
  {
    key: "linkedin",
    label: "message thread",
    match: (h) => h === "www.linkedin.com" || h === "linkedin.com",
    extract: () => textFrom(".msg-s-event-listitem__body, .msg-s-message-list__event p"),
  },
  {
    key: "gorgias",
    label: "ticket",
    match: (h) => h.endsWith(".gorgias.com") || h === "gorgias.com",
    extract: () => textFrom('[data-testid="message-body"], .message-body, article'),
  },
  {
    key: "zendesk",
    label: "ticket",
    match: (h) => h.endsWith(".zendesk.com"),
    extract: () => textFrom(".zd-comment, [data-comment-body], .event .comment"),
  },
  {
    key: "intercom",
    label: "conversation",
    match: (h) => h === "app.intercom.com" || h.endsWith(".intercom.com"),
    extract: () => textFrom('.conversation__body, [class*="conversationPart"], [class*="comment__body"]'),
  },
  {
    key: "front",
    label: "conversation",
    match: (h) => h === "app.frontapp.com",
    extract: () => textFrom('[class*="messageBody"], [class*="message-body"], .message'),
  },
];

// Concatenate visible text from every node matching `sel`, in document order, de-run whitespace. Empty on any
// error or if nothing matched (→ content.js falls back to manual selection). Caps length to keep payloads sane.
function textFrom(sel) {
  try {
    const nodes = Array.from(document.querySelectorAll(sel));
    const parts = [];
    for (const n of nodes) {
      // Skip hidden nodes (Gmail keeps collapsed quoted history in the DOM but display:none).
      if (n.offsetParent === null && n.getClientRects().length === 0) continue;
      const t = (n.innerText || n.textContent || "").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
      if (t) parts.push(t);
    }
    const joined = parts.join("\n\n").trim();
    return joined.length > 20000 ? joined.slice(0, 20000) : joined;
  } catch {
    return "";
  }
}

// Return the adapter for the current host, or null (→ universal selection-only mode).
function careAdapterFor(hostname) {
  try {
    return CARE_ADAPTERS.find((a) => a.match(hostname)) || null;
  } catch {
    return null;
  }
}
