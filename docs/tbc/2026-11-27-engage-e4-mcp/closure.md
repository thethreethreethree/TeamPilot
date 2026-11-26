# CLOSURE - Engage E4: the MCP server

## What is true now

EloState is an MCP server at /api/mcp. An AI assistant connects with a company key that has the MCP scope and can list
deals, read a deal (with its account, contacts and latest brief) or an account, and ask a question about a deal,
answered only from its latest calls the company holds (never a hidden call), with references to the call lines it rests
on. Nothing it does writes, and every request counts in the key's usage.

## Residual

```json
[
  {"id": "R1-mcp-oauth", "item": "Assistants connect with a pasted key; there's no sign-in-with-EloState (OAuth) for MCP, and no per-person access.", "why_skipped": "Per-person access needs a JWT secret this server doesn't have (plan E8); OAuth apps are F31.7.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T21:42:00Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
