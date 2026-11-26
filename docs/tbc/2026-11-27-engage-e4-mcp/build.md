# BUILD - Engage E4: the MCP server

No migration. No env keys.

### An assistant asks about a deal
write-path: each request → api_usage (the key's usage).
read-path: POST /api/mcp → authenticateApiKey (mcp scope) → tools/call → runTool → company-pinned reads; ask_deal → loadDealCalls minus hidden calls → mcpAskCoach → resolveCallRefs.
