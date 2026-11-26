# CHECK - Engage E4: the MCP server

## Commands

```
npx vitest run src/lib/api/__tests__ → 109 passed (exit 0)
tsc clean · invariant audit ✓ (authenticateApiKey recognised as a gate)
npm run check → gates the commit
```

## Findings

### F1 - the audit did not know the API key as an auth gate
class: a new auth mechanism outside the gate vocabulary.
sweep: ROUTE_AUTH_RE gains authenticateApiKey (it fails closed), with the reason in the comment.
severity: low.
