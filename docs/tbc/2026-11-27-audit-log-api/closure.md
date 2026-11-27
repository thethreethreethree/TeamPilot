# CLOSURE - Audit log API

## What is true now

An outside tool with a company key reads the audit log at /api/v1/audit, newest first and paged, while the key's maker
is still a company admin.

## Residual

```json
[
  {"id": "R1-filters", "item": "No ?action or date filter on the API (the app has ?action).", "why_skipped": "Paging covers export; filters can follow a real integration's need.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-27T00:07:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

isAdminRole stays the company-admin rule.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
