// C.A.R.E extension — per-site adapters (Phase 2, spec: "(B) Per-site adapters = TOP 10 platform").
//
// The universal path (A) reads window.getSelection() — works everywhere but needs the user to highlight. An
// adapter reads the OPEN conversation straight from the page DOM, so on a known platform the user can click
// "Read this conversation" instead of highlighting.
//
// HONESTY (§3.4): every extract() is best-effort against a third-party DOM we don't control and CANNOT verify
// headlessly. So every extract() returns "" on any miss — and content.js treats "" as "couldn't auto-read, fall
// back to manual selection". A wrong selector is therefore harmless: it degrades to the universal path, never
// fabricates. The selectors below are reasoned, not confirmed in-browser; they are labeled UNVERIFIED and are
// meant to be tightened per platform once the founder confirms each live.
//
// Injected with config.js + content.js into ONE shared, persistent global scope. Like config.js, we publish to
// globalThis behind an idempotency guard so a second injection (panel toggle) doesn't throw "already declared".

if (!globalThis.__careAdaptersLoaded) {
  globalThis.__careAdaptersLoaded = true;

  // Concatenate visible text from every node matching `sel`, in document order, de-run whitespace. Empty on any
  // error or if nothing matched (→ content.js falls back to manual selection). Caps length to keep payloads sane.
  globalThis.textFrom = function textFrom(sel) {
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
  };

  globalThis.CARE_ADAPTERS = [
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
      match: (h) =>
        h === "www.messenger.com" || h === "messenger.com" || h === "www.facebook.com" || h === "facebook.com",
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
    {
      key: "slack",
      label: "Slack conversation",
      match: (h) => h === "app.slack.com",
      // Slack renders each message's text in `.p-rich_text_section` blocks, inside the message list
      // (`[data-qa="message_content"]` / `.c-message_kit__blocks`). Grab the visible ones in order; the
      // textFrom hidden-node skip drops the virtualized off-screen rows Slack keeps in the DOM.
      extract: () =>
        textFrom(
          '[data-qa="message_content"] .p-rich_text_section, .c-message_kit__blocks .p-rich_text_section, .c-virtual_list__item .p-rich_text_section'
        ),
    },
  ];

  // Return the adapter for the current host, or null (→ universal selection-only mode).
  globalThis.careAdapterFor = function careAdapterFor(hostname) {
    try {
      return globalThis.CARE_ADAPTERS.find((a) => a.match(hostname)) || null;
    } catch {
      return null;
    }
  };
}
