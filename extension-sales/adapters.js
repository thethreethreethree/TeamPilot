// Sales Coach extension — per-site adapters (Tier 1: the founder-named platforms + LinkedIn).
//
// A focused port of ../extension/adapters.js: the RCD/media helpers are DROPPED (sales reads text only).
// Each adapter reads the OPEN conversation straight from the page DOM; content.js calls
// salesAdapterFor(hostname).extract(). A wrong selector is harmless — it returns "" and content.js falls
// back to the rep's manual highlight. Selectors are REASONED, copied from the live C.A.R.E adapters, and are
// STATIC-VERIFIED ONLY / RUNTIME-UNVERIFIED — confirm each live per platform (PLATFORM-COVERAGE.md). New
// Tier-2 platforms get added here later.

if (!globalThis.__salesCoachAdaptersLoaded) {
  globalThis.__salesCoachAdaptersLoaded = true;

  // Concatenate visible text from every node matching `sel`, in document order, de-run whitespace. Empty on
  // any error/no-match (→ content.js falls back to manual selection). Caps to the RECENT tail (the tools need
  // the most-recent context), matching the C.A.R.E textFrom.
  globalThis.textFrom = function textFrom(sel) {
    try {
      const nodes = Array.from(document.querySelectorAll(sel));
      const parts = [];
      for (const n of nodes) {
        if (n.offsetParent === null && n.getClientRects().length === 0) continue; // skip hidden/collapsed
        const t = (n.innerText || n.textContent || "").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
        if (t) parts.push(t);
      }
      const joined = parts.join("\n\n").trim();
      return joined.length > 20000 ? joined.slice(-20000) : joined;
    } catch {
      return "";
    }
  };

  const ADAPTERS = [
    {
      key: "gmail",
      match: (h) => h === "mail.google.com",
      extract: () => textFrom(".a3s"),
    },
    {
      key: "outlook",
      match: (h) =>
        h === "outlook.office.com" || h === "outlook.office365.com" || h === "outlook.live.com",
      extract: () => textFrom('[aria-label="Message body"], .allowTextSelection, [role="document"]'),
    },
    {
      key: "instagram",
      match: (h) => h === "www.instagram.com" || h === "instagram.com",
      extract: () =>
        textFrom('div[role="grid"] div[dir="auto"], div[aria-label*="Message"] div[dir="auto"]'),
    },
    {
      key: "messenger",
      match: (h) =>
        h === "www.messenger.com" || h === "messenger.com" || h === "www.facebook.com" || h === "facebook.com",
      extract: () => textFrom('div[role="main"] div[dir="auto"]'),
    },
    {
      key: "whatsapp",
      match: (h) => h === "web.whatsapp.com",
      extract: () => textFrom("[data-pre-plain-text]"),
      // WhatsApp Web exposes message direction (message-out = the rep's own), so we can tell the co-pilot who
      // spoke last → reply vs follow-up. The others can't; content.js sends "unknown" and the server decides.
      lastSpeaker: () => {
        try {
          const msgs = document.querySelectorAll(".message-in, .message-out");
          const last = msgs[msgs.length - 1];
          if (!last) return null;
          return last.classList.contains("message-out") ? "agent" : "customer";
        } catch {
          return null;
        }
      },
    },
    {
      key: "linkedin",
      match: (h) => h === "www.linkedin.com" || h === "linkedin.com",
      extract: () => textFrom(".msg-s-event-listitem__body, .msg-s-message-list__event p"),
    },
    {
      key: "slack",
      match: (h) => h === "app.slack.com",
      extract: () =>
        textFrom(
          '[data-qa="message_content"] .p-rich_text_section, .c-message_kit__blocks .p-rich_text_section, .c-virtual_list__item .p-rich_text_section'
        ),
    },
  ];

  // Return the adapter whose match(hostname) is true, or null (→ content.js uses manual selection).
  globalThis.salesAdapterFor = function salesAdapterFor(hostname) {
    const h = String(hostname || "").toLowerCase();
    return ADAPTERS.find((a) => {
      try {
        return a.match(h);
      } catch {
        return false;
      }
    }) || null;
  };
}
