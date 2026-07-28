# CHECK — Settings name-edit audit

Audited the built files: `ProfilePanel.tsx` and the settings-page wiring.

## Within-module pass (four layers)

- **1 structure:** mirrors the established settings-panel shape (client component, `createClient`,
  direct RLS write, `useToast`). No new route, no divergent pattern.
- **2 effectivity:** Save persists `full_name` (0090 permits it) and the panel reflects the saved
  value; Save is disabled unless the name changed and is non-empty (1–80 chars). Trimmed on write.
- **3 composition:** Settings → Your profile is the first Profile-section panel → edit → save → the
  name flows to avatar/attribution. No dead end; the neighbouring Avatar panel already reads full_name.
- **4 surface:** on-brand glass-card, consistent with Avatar/Password panels.

## Cross-module pass (A21)

"Write my own profile field from Settings" now has one behaviour: ProfilePanel and
AvatarCustomizationPanel both use the own-row RLS `profiles.update` pattern — no second, divergent
write mechanism (e.g. a new API route) introduced.

## Class sweep (A26)

- class: a user-editable non-privileged profile field with no edit surface. sweep: the 0090 comment
  lists the non-privileged editable fields (full_name, learning_mode_enabled, status, …).
  `learning_mode_enabled` already has a panel (LearningModePanel); `status` is system-managed
  (active/removed), not user-facing. So `full_name` was the one missing edit surface — now filled.
- write-safety: the update sets ONLY `full_name`; it never touches a privileged column, so the 0090
  guard cannot fire. A user cannot escalate via this panel.

## Findings

No findings left open. Scope is deliberately bounded (name-edit only); the full Settings scope is
recorded as a follow-up (residual), not silently attempted.

## Inspected / not-inspected

- **Inspected:** ProfilePanel, the settings-page wiring, the 0090 guard (write safety), the avatar
  panel (precedent + read path), typecheck.
- **NOT inspected (→ residual):** the full "substantial Settings" scope (unified hub, notification
  preferences, plan/module visibility, DB-persisted theme) — awaits founder scope confirmation.
