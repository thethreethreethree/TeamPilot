# BUILD — Tier-3 support-desk adapters

### tier-3 adapters (gorgias / zendesk / intercom / front)
- **write-path:** `extension-sales/adapters.js` — four new entries appended to `ADAPTERS`, after the Tier-2
  block.
- **read-path:** `content.js captureConversation()` → `salesAdapterFor(location.hostname)` matches one of the
  new `match()` predicates → `.extract()` reads the desk thread; injected on toolbar click (activeTab).
- **what:** each entry is `{ key, match, extract }` copied verbatim from the live C.A.R.E desk adapter, with the
  `extractRCD`/media path dropped (sales reads text only). Selectors:
  `gorgias` → `[data-testid="message-body"], .message-body, article`;
  `zendesk` → `.zd-comment, [data-comment-body], .event .comment`;
  `intercom` → `.conversation__body, [class*="conversationPart"], [class*="comment__body"]`;
  `front` → `[class*="messageBody"], [class*="message-body"], .message`.
- **why:** four named top-20 platforms (#16-19) that were reachable but unbuilt; reuse (not new guesses) +
  hostname self-gating make them zero-downside additive coverage. No manifest change (activeTab injection).

### execution-routing test for the desks
- **write-path:** `src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts` — a Tier-3 substring
  coverage `it(...)` + four rows appended to the vm `routes` table (incl. subdomain cases).
- **read-path:** `npm run test` (vitest) loads `adapters.js` in a vm with a mocked `document` and asserts
  `salesAdapterFor(host).key`.
- **what:** `["acme.zendesk.com","zendesk"]`, `["shop.gorgias.com","gorgias"]`, `["app.intercom.com","intercom"]`,
  `["app.frontapp.com","front"]`. The two subdomain cases exercise the `.endsWith()` wildcard predicates.
- **why (A30):** a substring check passes on a typo'd `match` (e.g. `.zendsk.com`) that routes nothing; an
  execution route fails on it. Gate the class, not the prose.

### drift-sync of the platform count
- **write-path:** `extension-sales/PLATFORM-COVERAGE.md` (Tier-3 table → built; summary; "13"→"17"),
  `extension-sales/README.md`, `docs/SALES-COACH-EXTENSION-STATUS.md` (×2).
- **read-path:** human/founder reading each doc.
- **what:** every "13 platforms" reference updated to 17 (7 Tier-1 + 6 Tier-2 + 4 Tier-3); Tier-3 table marked
  BUILT with the self-gating rationale. Verified no stale "13" reference remains (grep).
- **why:** comment-only cross-artifact sync contract — the count lives in four places and must agree.
