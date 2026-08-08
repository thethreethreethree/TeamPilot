# Sales Coach Extension — platform coverage

The founder's brief: work across "facebook, instagram, whatsapp, gmail, outlook, slack, and all top 20
communication platforms." This is the honest, grounded answer — the definitive list the Phase 2b
`adapters.js` port works from.

**What "coverage" means here — read this first.** The extension is **usable on ANY website**: clicking the
toolbar icon injects the panel on the current tab (`activeTab`), and the rep can always **highlight the
conversation manually** and press Capture. So a rep can coach a thread on *any* of the top-20 platforms today.
What the per-platform adapters below add is **automatic** reading — the panel grabs the open thread with no
highlighting. So the honest coverage statement is: *usable everywhere with a manual highlight; auto-reads the
17 platforms with an adapter.* The list below is the **auto-read** list, not the "works here at all" list.

**The hard constraint (on AUTO-READ):** a content script can only *automatically* read a platform that has a
**web app** it can reach. Native-mobile-only apps (iMessage, SMS, Signal) have no web surface to auto-read —
and, being mobile-only, a browser extension can't run there at all. So auto-read "top 20" resolves to ~15
web-reachable platforms, not literally 20. (Manual coaching still works on any web page a rep can open.)

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

## Tier 2 — reachable, NEW adapters (BUILT 2026-08-08; selectors reasoned, awaiting live confirmation)

Adapters #8–13 are now in `adapters.js` with reasoned selectors — more likely to need tightening than the
C.A.R.E-proven Tier-1 ones, so confirm each live and adjust. #14–15 are not built yet.

| # | Platform | Web hostname(s) | Adapter | Notes |
|---|---|---|---|---|
| 8 | Telegram Web | `web.telegram.org` | `telegram` ✅ | Full web client; high usage. |
| 9 | Microsoft Teams | `teams.microsoft.com` | `teams` ✅ | Web client; B2B sales. |
| 10 | Discord | `discord.com` (+canary/ptb) | `discord` ✅ | Community-led sales. |
| 11 | Twitter / X DMs | `x.com`, `twitter.com` | `twitter` ✅ | Social selling. |
| 12 | Google Chat | `chat.google.com` | `googlechat` ✅ | Distinct DOM from Gmail mail. |
| 13 | Google Voice | `voice.google.com` | `googlevoice` ✅ | The one web-reachable path to SMS threads. |
| 14 | Reddit (chat/DMs) | `reddit.com` | — | Community sales; lower priority, not built. |
| 15 | Zoom Team Chat | `zoom.us` (web chat) | — | Partial; confirm the web surface exists first. |

## Tier 3 — reachable support desks, REUSE C.A.R.E adapter (BUILT 2026-08-08)

| # | Platform | Web hostname(s) | Adapter | Notes |
|---|---|---|---|---|
| 16 | Zendesk | `*.zendesk.com` | `zendesk` ✅ | Selectors reused verbatim from the C.A.R.E `zendesk` adapter (RCD path dropped). |
| 17 | Intercom | `app.intercom.com`, `*.intercom.com` | `intercom` ✅ | Same reuse. |
| 18 | Front | `app.frontapp.com` | `front` ✅ | Same reuse. |
| 19 | Gorgias | `*.gorgias.com`, `gorgias.com` | `gorgias` ✅ | Same reuse. |

These are support-desk tools, not primary sales channels. They're now built because each **self-gates by
hostname** — an adapter only fires on its own domain, so a rep who never sells through a given desk is entirely
unaffected (the adapter simply never runs). That makes inclusion pure additive optionality with zero downside,
and the selectors reuse the existing C.A.R.E desk adapters (near-zero cost). Same reasoned-then-confirm-live
posture as every adapter here; routing is execution-tested (subdomain cases exercise the `.endsWith()` match).

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

- **Auto-read adapters built:** 17 — 7 Tier-1 (reuse C.A.R.E) + 6 Tier-2 (new, reasoned) + 4 Tier-3 support
  desks (reuse C.A.R.E). All degrade to manual highlight on a miss; all confirm-live per platform.
- **Still unbuilt (reachable, lower priority):** #14 Reddit (new selectors) and #15 Zoom Team Chat (confirm the
  web chat surface exists first) — 2 platforms.
- **Genuinely uncoverable:** iMessage, SMS, Signal, WeChat — not an extension's job.
- Usable on **any** site via manual highlight regardless of adapter coverage.

The port order that maximizes value per unit of unverifiable work: **Tier 1 first** (covers every founder-named
platform by reuse), then **Tier 2** by sales relevance, then **Tier 3** only if reps sell through those desks.
