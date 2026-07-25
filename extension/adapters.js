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
      // Cap to the RECENT tail, not the oldest head: the conversation is in document order
      // (oldest → newest), and the tools (Co-Pilot / Coach / Summarize) need the MOST RECENT
      // context — what the customer just said. slice(0, N) kept the oldest and dropped the
      // recent, so a long thread (> ~20k chars) fed the tools stale context. slice(-N) fixes it.
      return joined.length > 20000 ? joined.slice(-20000) : joined;
    } catch {
      return "";
    }
  };

  // labeledFrom — like textFrom, but PER MESSAGE: prefixes each message with a role/sender label when
  // roleOf(node) can resolve one, so the tools can tell the AGENT's turns from the CUSTOMER's (founder audit
  // 2026-07-23, Finding 2 — the model was addressing the reply TO the agent because the thread was an unlabeled
  // blob). `msgSel` selects message CONTAINERS; `roleOf(node)` returns a short label ("You"/"Customer"/a sender
  // name) or "" if unknown (that message stays unlabeled). Best-effort + UNVERIFIED per platform, same honesty
  // caveat as the selectors themselves: a miss degrades, never fabricates. Callers MUST `|| textFrom(...)` so a
  // labeling miss can never regress a working unlabeled extraction (§1.5 don't break what works; §3.4 degrade).
  globalThis.labeledFrom = function labeledFrom(msgSel, roleOf) {
    try {
      const nodes = Array.from(document.querySelectorAll(msgSel));
      const parts = [];
      for (const n of nodes) {
        if (n.offsetParent === null && n.getClientRects().length === 0) continue;
        const body = (n.innerText || n.textContent || "").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
        if (!body) continue;
        let label = "";
        try {
          label = (roleOf && roleOf(n)) || "";
        } catch {
          label = "";
        }
        parts.push(label ? `${label}: ${body}` : body);
      }
      const joined = parts.join("\n\n").trim();
      // Cap to the RECENT tail, not the oldest head: the conversation is in document order
      // (oldest → newest), and the tools (Co-Pilot / Coach / Summarize) need the MOST RECENT
      // context — what the customer just said. slice(0, N) kept the oldest and dropped the
      // recent, so a long thread (> ~20k chars) fed the tools stale context. slice(-N) fixes it.
      return joined.length > 20000 ? joined.slice(-20000) : joined;
    } catch {
      return "";
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // RCD — RAW CONVERSATION DATA (founder build 2026-07-26). The text helpers above return a single
  // STRING for the AI tools; RCD returns the conversation as STRUCTURED, per-message data that
  // preserves attribution AND captures non-text content (images / files / media). Two governing rules:
  //   • ThinkerThinker.md A39 — multi-party text must carry who-said-each-turn AS DATA at the source,
  //     or a downstream consumer reconstructs the roles confidently wrong. rcdFrom keeps role+sender
  //     per message instead of flattening to a blob.
  //   • §1.5 / A5 — this is ADDITIVE. extract() (the text path the 6 tools consume as `conversation:
  //     string`) is untouched, so nothing that works today can regress.
  // HONESTY (§3.4, same stance as the selectors): any error or miss yields [] / [] and NEVER throws;
  // a wrong guess OMITS content, never fabricates it. And — per this file's header — the live selectors
  // are UNVERIFIED against the third-party DOMs for 10 of 11 channels, so RCD capture is likewise
  // STATIC-VERIFIED ONLY / RUNTIME-UNVERIFIED until each platform is confirmed in a real browser.

  // defaultMediaFrom — best-effort capture of the NON-TEXT content inside a message node: images,
  // file/attachment links, audio/video. Returns [{ type, url, alt?, filename? }]. It captures DOM
  // REFERENCES (the URLs already in the page) — it does NOT download bytes; durable byte-storage is a
  // persistence + data-governance decision held for the founder. Icons/emoji/avatars are filtered by
  // size so RCD isn't polluted by UI chrome. De-dupes by url (a nested node can repeat an asset).
  globalThis.defaultMediaFrom = function defaultMediaFrom(node) {
    const media = [];
    try {
      for (const img of node.querySelectorAll("img")) {
        const url = img.currentSrc || img.getAttribute("src") || "";
        if (!url) continue;
        if (/^data:image\/(gif|svg)/i.test(url)) continue; // spacer / emoji sprite
        const w = img.naturalWidth || img.width || parseInt(img.getAttribute("width") || "0", 10) || 0;
        const h = img.naturalHeight || img.height || parseInt(img.getAttribute("height") || "0", 10) || 0;
        if (w && h && w < 40 && h < 40) continue; // UI icon / emoji / tiny avatar
        media.push({ type: "image", url, alt: (img.getAttribute("alt") || "").trim() });
      }
      const FILE_RE =
        /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|txt|rtf|png|jpe?g|gif|webp|heic|svg|mp4|mov|webm|mp3|wav|m4a|ogg)(\?|#|$)/i;
      for (const a of node.querySelectorAll("a[href]")) {
        const url = a.href || a.getAttribute("href") || "";
        if (!url) continue;
        const dl = a.getAttribute("download");
        if (dl || FILE_RE.test(url)) {
          media.push({
            type: "file",
            url,
            filename: (dl || a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 200),
          });
        }
      }
      for (const v of node.querySelectorAll("video, audio")) {
        const src = v.querySelector("source");
        const url = v.currentSrc || (src && src.src) || v.getAttribute("src") || "";
        if (url) media.push({ type: v.tagName.toLowerCase() === "video" ? "video" : "audio", url });
      }
    } catch {
      /* degrade to whatever was gathered before the throw */
    }
    const seen = new Set();
    return media.filter((m) => (m.url && !seen.has(m.url) ? (seen.add(m.url), true) : false));
  };

  // rcdFrom — build the structured RCD array. `msgSel` selects message CONTAINERS (so media inside a
  // message is captured WITH that message). `roleOf(node)` optionally returns "agent" | "customer"
  // (a normalized role) OR a sender NAME OR "" (unknown) — mirroring the existing labeledFrom contract.
  // Shape per element: { role: "agent"|"customer"|"unknown", sender: string, text: string,
  //   media: [{ type, url, alt?, filename? }] }. Caps to the RECENT tail (most-recent matters most,
  // like textFrom's slice(-N)). Empty array on any error/miss (→ caller degrades, never fabricates).
  globalThis.rcdFrom = function rcdFrom(msgSel, roleOf) {
    try {
      const nodes = Array.from(document.querySelectorAll(msgSel));
      const messages = [];
      for (const n of nodes) {
        if (n.offsetParent === null && n.getClientRects().length === 0) continue;
        const text = (n.innerText || n.textContent || "")
          .replace(/\s+\n/g, "\n")
          .replace(/[ \t]{2,}/g, " ")
          .trim();
        const media = globalThis.defaultMediaFrom(n);
        if (!text && media.length === 0) continue; // nothing to record
        let role = "unknown";
        let sender = "";
        try {
          const r = (roleOf && roleOf(n)) || "";
          if (r === "agent" || r === "customer") role = r;
          else if (r) sender = r; // a sender name, role stays unknown (source can't tell which side)
        } catch {
          /* role stays unknown */
        }
        messages.push({ role, sender, text, media });
      }
      return messages.length > 500 ? messages.slice(-500) : messages;
    } catch {
      return [];
    }
  };

  // rcdOrText — RCD with a guaranteed floor: try structured per-message capture; if the (often
  // UNVERIFIED) container selector matches nothing, degrade to a SINGLE synthetic message built from
  // the adapter's proven text extraction, so RCD is NEVER worse than today's text scrape (§3.4 / §1.5).
  globalThis.rcdOrText = function rcdOrText(msgSel, roleOf, textFallback) {
    const rcd = globalThis.rcdFrom(msgSel, roleOf);
    if (rcd.length) return rcd;
    const t = (typeof textFallback === "function" ? textFallback() : textFallback) || "";
    return t ? [{ role: "unknown", sender: "", text: t, media: [] }] : [];
  };

  // ROLE-LABELING STATUS (Fix 2a, founder audit 2026-07-23). The tools need to know who's the agent vs the
  // customer. Coverage:
  //   • WhatsApp — LABELED via `.message-out/.message-in` + `data-pre-plain-text` sender (reliable).
  //   • Gmail — LABELED via per-message `span.gD` sender (conservative + fallback; UNVERIFIED, needs browser).
  //   • The other 9 — still UNLABELED (plain textFrom). Their per-message SENDER selectors are UNVERIFIED (see
  //     the file header), and shipping unverified sender-parsing for each would fabricate confidence + risk
  //     regressions (§3.4). The cross-channel safety net is the ROUTE-LAYER anchor (Fix 2b): the copilot route
  //     passes the signed-in agent's identity and CO_PILOT_SYSTEM refuses to guess who's who. To LABEL another
  //     platform, confirm its per-message container + a role/sender signal live, then switch it to labeledFrom(…)
  //     || textFrom(…) exactly as WhatsApp does. Each such change needs a browser confirmation.
  globalThis.CARE_ADAPTERS = [
    {
      key: "gmail",
      label: "email thread",
      match: (h) => h === "mail.google.com",
      // Gmail message bodies render in `.a3s`; the open thread stacks them. Fix 2a (founder audit 2026-07-23):
      // label each body with its SENDER so the tools can attribute turns (the role-inversion bug reproduced on
      // Gmail). The sender lives in the message header as `span.gD` (carries `name`/`email`); walk up from the
      // body to its message container and read it. CONSERVATIVE + fallback-protected: if no sender is confidently
      // found the message stays UNLABELED (labeledFrom leaves label=""), and if the whole labeled pass yields
      // nothing we fall back to the plain `.a3s` extraction — so this can NEVER regress today's behavior or
      // confidently mislabel a whole thread. UNVERIFIED against the live Gmail DOM (per this file's header) —
      // needs a browser confirm. With the copilot agent-name anchor (2b), "SenderName: body" lets the model
      // match the agent's own turns and stop addressing the reply to them.
      extract: () => {
        const labeled = labeledFrom(".a3s", (body) => {
          const container = body.closest(".gs, .adn, [role='listitem'], .h7") || body.parentElement;
          const s = container ? container.querySelector("span.gD[email], span.gD[name], .gD[email]") : null;
          if (!s) return "";
          return (s.getAttribute("name") || s.getAttribute("email") || s.textContent || "").trim();
        });
        return labeled || textFrom(".a3s");
      },
      // RCD: scan each message CONTAINER (so inline images + the body are captured together), sender-
      // labeled where `span.gD` resolves. Falls back to a single message from the proven `.a3s` text if
      // the container guess misses. Attachment CHIPS that Gmail renders outside the body are a known
      // per-platform tightening (UNVERIFIED).
      extractRCD: () =>
        rcdOrText(
          ".gs, .adn, [role='listitem'].h7",
          (n) => {
            const s = n.querySelector("span.gD[email], span.gD[name], .gD[email]");
            return s ? (s.getAttribute("name") || s.getAttribute("email") || s.textContent || "").trim() : "";
          },
          () => textFrom(".a3s")
        ),
    },
    {
      key: "outlook",
      label: "email thread",
      match: (h) => h === "outlook.office.com" || h === "outlook.office365.com" || h === "outlook.live.com",
      extract: () => textFrom('[aria-label="Message body"], .allowTextSelection, [role="document"]'),
      extractRCD: () =>
        rcdOrText('[aria-label="Message body"], .allowTextSelection, [role="document"]', null, () =>
          textFrom('[aria-label="Message body"], .allowTextSelection, [role="document"]')
        ),
    },
    {
      key: "instagram",
      label: "DM thread",
      match: (h) => h === "www.instagram.com" || h === "instagram.com",
      // IG DM message rows live inside the conversation grid; message text spans have dir="auto".
      extract: () => textFrom('div[role="grid"] div[dir="auto"], div[aria-label*="Message"] div[dir="auto"]'),
      extractRCD: () =>
        rcdOrText('div[role="grid"] div[dir="auto"], div[aria-label*="Message"] div[dir="auto"]', null, () =>
          textFrom('div[role="grid"] div[dir="auto"], div[aria-label*="Message"] div[dir="auto"]')
        ),
    },
    {
      key: "messenger",
      label: "chat",
      match: (h) =>
        h === "www.messenger.com" || h === "messenger.com" || h === "www.facebook.com" || h === "facebook.com",
      extract: () => textFrom('div[role="main"] div[dir="auto"]'),
      extractRCD: () => rcdOrText('div[role="main"] div[dir="auto"]', null, () => textFrom('div[role="main"] div[dir="auto"]')),
    },
    {
      key: "whatsapp",
      label: "WhatsApp chat",
      match: (h) => h === "web.whatsapp.com",
      // LIVE-CONFIRMED 2026-07-22: the old `.message-in/.message-out .selectable-text` returned nothing against
      // the current WhatsApp Web DOM (founder load-test). Each message's text sits in a `.copyable-text` wrapper
      // carrying `data-pre-plain-text="[time, date] sender: "` — stable for years, present ONLY on message bubbles
      // (not the composer), exactly one per message (so no double-reading). That attribute is the reliable anchor;
      // the old class-scoped selectors stay as a fallback for older builds (they don't nest inside the wrapper
      // match, so no duplication in practice — a miss just yields "").
      // Fix 2a (founder audit 2026-07-23): role-label each message so the tools know who's the agent vs the
      // customer. `.message-out` = "You" (the agent), `.message-in` = "Customer" — WhatsApp's most reliable
      // signal; `data-pre-plain-text="[time, date] Sender: "` carries the sender name as a fallback label.
      // Falls back to the LIVE-CONFIRMED unlabeled textFrom so labeling can NEVER regress working extraction.
      extract: () => {
        const labeled = labeledFrom("[data-pre-plain-text]", (n) => {
          const w = n.closest(".message-out, .message-in");
          if (w) return w.classList.contains("message-out") ? "You" : "Customer";
          const pre = n.getAttribute("data-pre-plain-text") || "";
          const m = pre.match(/\]\s*([^:]+):\s*$/);
          return m ? m[1].trim() : "";
        });
        return (
          labeled ||
          textFrom("[data-pre-plain-text]") ||
          textFrom(".message-in .selectable-text, .message-out .selectable-text")
        );
      },
      // Who sent the LAST message (founder request 2026-07-23). Reuses the LIVE-CONFIRMED
      // `[data-pre-plain-text]` anchor (one per message bubble, document order) + the 2a role class:
      // `.message-out` = the agent ("You"), `.message-in` = the customer. The last such bubble is the
      // most recent message. Returns "unknown" on any miss so the server falls back to reply-mode —
      // never fabricates a role (§3.4). UNVERIFIED against the live DOM (this file's header) — the
      // extract() side of these same selectors IS live-confirmed, but the last-bubble read is not.
      lastSpeaker: () => {
        try {
          const nodes = document.querySelectorAll("[data-pre-plain-text]");
          const last = nodes[nodes.length - 1];
          const bubble = last && last.closest(".message-out, .message-in");
          if (!bubble) return "unknown";
          return bubble.classList.contains("message-out") ? "agent" : "customer";
        } catch {
          return "unknown";
        }
      },
      // RCD: scan each message BUBBLE (`.message-out`/`.message-in`) so sent/received IMAGES are captured
      // with their message, and carry the reliable WhatsApp role at the source (A39). `.message-out` = the
      // agent, `.message-in` = the customer. Falls back to the LIVE-CONFIRMED `[data-pre-plain-text]` text.
      extractRCD: () =>
        rcdOrText(
          ".message-out, .message-in",
          (n) => (n.classList.contains("message-out") ? "agent" : "customer"),
          () => textFrom("[data-pre-plain-text]")
        ),
    },
    {
      key: "linkedin",
      label: "message thread",
      match: (h) => h === "www.linkedin.com" || h === "linkedin.com",
      extract: () => textFrom(".msg-s-event-listitem__body, .msg-s-message-list__event p"),
      extractRCD: () =>
        rcdOrText(".msg-s-event-listitem, .msg-s-message-list__event", null, () =>
          textFrom(".msg-s-event-listitem__body, .msg-s-message-list__event p")
        ),
    },
    {
      key: "gorgias",
      label: "ticket",
      match: (h) => h.endsWith(".gorgias.com") || h === "gorgias.com",
      extract: () => textFrom('[data-testid="message-body"], .message-body, article'),
      extractRCD: () =>
        rcdOrText('[data-testid="message-body"], .message-body, article', null, () =>
          textFrom('[data-testid="message-body"], .message-body, article')
        ),
    },
    {
      key: "zendesk",
      label: "ticket",
      match: (h) => h.endsWith(".zendesk.com"),
      extract: () => textFrom(".zd-comment, [data-comment-body], .event .comment"),
      extractRCD: () =>
        rcdOrText(".zd-comment, [data-comment-body], .event .comment", null, () =>
          textFrom(".zd-comment, [data-comment-body], .event .comment")
        ),
    },
    {
      key: "intercom",
      label: "conversation",
      match: (h) => h === "app.intercom.com" || h.endsWith(".intercom.com"),
      extract: () => textFrom('.conversation__body, [class*="conversationPart"], [class*="comment__body"]'),
      extractRCD: () =>
        rcdOrText('[class*="conversationPart"], [class*="comment__body"], .conversation__body', null, () =>
          textFrom('.conversation__body, [class*="conversationPart"], [class*="comment__body"]')
        ),
    },
    {
      key: "front",
      label: "conversation",
      match: (h) => h === "app.frontapp.com",
      extract: () => textFrom('[class*="messageBody"], [class*="message-body"], .message'),
      extractRCD: () =>
        rcdOrText('[class*="message-body"], [class*="messageBody"], .message', null, () =>
          textFrom('[class*="messageBody"], [class*="message-body"], .message')
        ),
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
      // RCD: scan the message KIT container (not just the rich-text block) so uploaded files/images in
      // a Slack message are captured with it; degrade to the proven rich-text extraction.
      extractRCD: () =>
        rcdOrText('[data-qa="message_content"], .c-message_kit__blocks, .c-virtual_list__item', null, () =>
          textFrom(
            '[data-qa="message_content"] .p-rich_text_section, .c-message_kit__blocks .p-rich_text_section, .c-virtual_list__item .p-rich_text_section'
          )
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
