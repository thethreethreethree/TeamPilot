# BUILD — connect handoff id-source guard

### id-source parameterization guard
- **write-path:** `src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts` — one `it(...)` added
  to the existing "Sales Coach connect handoff" describe block (beside the message-type guards).
- **read-path:** `npm run test` (vitest) reads `src/app/extension/connect/page.tsx` (already loaded as `CONNECT`
  in that block) and regex-asserts the id-source ternary ordering.
- **what:** `expect(CONNECT).toMatch(/sales\s*\?\s*process\.env\.NEXT_PUBLIC_SALES_EXTENSION_ID\s*:\s*process\.env\.NEXT_PUBLIC_CARE_EXTENSION_ID/)`
  — the sales branch must select the SALES env var, the default branch the CARE one.
- **why (A30):** the message-type half of the handoff parameterization was guarded; the id-source half — which
  determines which extension the session+refresh token is PINNED to — was only prose. A crossed ternary would
  misdirect the token to the wrong extension, silently. Gate the class.

### detection check (not a presence check)
- **write-path:** none — a verification step (no file written); recorded here and in check.md.
- **read-path:** `grep -c "sales ? process.env.NEXT_PUBLIC_SALES_EXTENSION_ID : process.env.NEXT_PUBLIC_CARE_EXTENSION_ID" src/app/extension/connect/page.tsx` → `1`.
- **what:** the exact ordered ternary exists once in the page; the regex pins the ordering (SALES in `sales ?`,
  CARE in `:`), so a swap fails. Confirms the guard discriminates a crossed branch, not merely "some ternary
  exists".
