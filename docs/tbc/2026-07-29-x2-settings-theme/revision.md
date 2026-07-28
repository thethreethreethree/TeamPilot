# REVISION MANIFEST — Settings substantial, Slice 1 (Theme)

Every atomic change this slice of the founder's "make Settings substantial" requires, each to a tracked
disposition. Dogfoods the revision-completeness gate shipped in b76bdc84 (`npm run tbc:revision`).

```json
[
  { "id": "T1", "verb": "ADD", "item": "Per-user theme override that persists across devices (was localStorage-only).", "disposition": "done", "evidence": "profiles.theme_preference (0201) + PATCH /api/me/theme + ThemeProvider persist/reconcile; reconcileTheme test 6/6; tsc exit 0." },
  { "id": "T2", "verb": "ADD", "item": "Admin/company default theme that new members inherit, resolve user->company->system.", "disposition": "done", "evidence": "companies.default_theme (0201) + admin-gated PATCH (isAdmin, company-scoped) + reconcileTheme company-default branch (tested)." },
  { "id": "T3", "verb": "ADD", "item": "Settings surface for both (Appearance panel).", "disposition": "done", "evidence": "src/components/settings/ThemePanel.tsx wired into the settings page; admin control renders only for admins." },
  { "id": "T4", "verb": "ADD", "item": "Non-breaking guarantee — degrade to today's behavior if migration 0201 is unapplied.", "disposition": "done", "evidence": "every DB touch guarded with isMissingColumnError(err, col); ThemeProvider reconcile guarded; check.md class sweep." }
]
```

This slice does NOT include the other three Settings items (Learning-Mode company default, per-user
Timezone, Access Assistance) — those are separate slices tracked in docs/BUILD-STATE.md (S2–S4), not
dropped. Access Assistance (admin resets another user's password) is security-sensitive and will be its
own carefully-built slice.
