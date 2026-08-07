# Sales Coach Extension — platform coverage

The founder's brief: work across "facebook, instagram, whatsapp, gmail, outlook, slack, and all top 20
communication platforms." This is the honest, grounded answer — the definitive list the Phase 2b
`adapters.js` port works from.

**The hard constraint:** a browser extension can only read a platform that has a **web app** a content script
can reach. Native-mobile-only apps (iMessage, SMS, Signal) are **uncoverable by any extension** — they'd need
a different integration entirely. So "top 20" resolves to ~15 web-reachable platforms, not literally 20.

**Reuse column is factual** — verified against the 11 adapters in `../extension/adapters.js` (their `match()`
hostnames are quoted). Selectors in that file are labeled reasoned-but-UNVERIFIED and must be confirmed live
per platform; the sales port inherits that posture (degrade to manual selection on a miss, never fabricate).

## Tier 1 — reachable, REUSE an existing C.A.R.E adapter (the fast path)

| # | Platform | Web hostname(s) | Reuse adapter | Founder-named |
|---|---|---|---|---|
| 1 | Gmail | `mail.google.com` | `gmail` | ✅ |
| 2 | Outlook | `outlook.office.com` / `.office365.com` / `.live.com` | `outlook` | ✅ |
| 3 | WhatsApp Web | `web.whatsapp.com` | `whatsapp` | ✅ |
| 4 | Instagram DMs | `instagram.com` | `instagram` | ✅ |
| 5 | Facebook / Messenger | `facebook.com`, `messenger.com` | `messenger` | ✅ |
| 6 | LinkedIn | `linkedin.com` | `linkedin` | (high sales value) |
| 7 | Slack | `app.slack.com` | `slack` | ✅ |

These seven cover all six founder-named platforms and are the highest-value sales surfaces — the port starts
here (copy the adapter, keep the same selectors, add the `lastSpeaker` read for the co-pilot).

## Tier 2 — reachable, NEW adapter needed (build after Tier 1)

| # | Platform | Web hostname(s) | Notes |
|---|---|---|---|
| 8 | Telegram Web | `web.telegram.org` | Full web client; high DX-sales usage. |
| 9 | Microsoft Teams | `teams.microsoft.com` | Web client; B2B sales. |
| 10 | Discord | `discord.com` (`/app`) | Community-led sales. |
| 11 | Twitter / X DMs | `x.com`, `twitter.com` | Social selling. |
| 12 | Google Chat | `chat.google.com`, `mail.google.com` (chat) | Distinct DOM from Gmail mail. |
| 13 | Google Voice | `voice.google.com` | The one web-reachable path to SMS threads. |
| 14 | Reddit (chat/DMs) | `reddit.com` | Community sales; lower priority. |
| 15 | Zoom Team Chat | `zoom.us` (web chat) | Partial; confirm the web surface exists before building. |

## Tier 3 — reachable support desks, REUSE C.A.R.E adapter (sales-adjacent, low priority)

| # | Platform | Web hostname(s) | Reuse adapter |
|---|---|---|---|
| 16 | Zendesk | `*.zendesk.com` (per the `zendesk` adapter) | `zendesk` |
| 17 | Intercom | `app.intercom.com`, `*.intercom.com` | `intercom` |
| 18 | Front | `app.frontapp.com` | `front` |
| 19 | Gorgias | `*.gorgias.com` | `gorgias` |

These are support-desk tools, not primary sales channels — include only if reps actually sell through them.
The adapters already exist, so the cost is near-zero.

## Uncoverable by a browser extension (out of scope — needs a different integration)

| Platform | Why |
|---|---|
| iMessage | No web app. Native macOS/iOS only. |
| SMS (native) | No web surface; `voice.google.com` (Tier 2 #13) is the only web proxy. |
| Signal | Desktop app only; no web client a content script can reach. |
| WeChat | `web.wechat.com` is deprecated / heavily region-limited; treat as not reliably reachable. |

Covering these would require a native app or a platform-side API integration, not the extension — a separate
future decision, flagged honestly rather than promised.

## Summary

- **Reachable by the extension:** ~15 platforms (Tiers 1+2), plus 4 reusable support desks (Tier 3).
- **Reuse-ready (zero new selector work, just confirm live):** 7 core + 4 desks = 11 (the existing adapters).
- **New adapters to write:** ~8 (Tier 2), reasoned then founder-confirmed live per platform.
- **Genuinely uncoverable:** iMessage, SMS, Signal, WeChat — not an extension's job.

The port order that maximizes value per unit of unverifiable work: **Tier 1 first** (covers every founder-named
platform by reuse), then **Tier 2** by sales relevance, then **Tier 3** only if reps sell through those desks.
