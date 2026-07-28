# BUILD — Settings: edit your own name

Files: `src/components/settings/ProfilePanel.tsx` (new), `src/app/dashboard/settings/page.tsx` (wire).

### Your-profile panel (edit name, view email)

- write-path: **exists** — the user types a name and clicks Save; `ProfilePanel` runs
  `supabase.from("profiles").update({ full_name }).eq("id", userId)` via the own-row RLS policy.
  The 0090 privileged-column trigger permits it (full_name is explicitly non-privileged).
  human_can_set: **yes** (the name input + Save button; Save disabled unless changed & non-empty).
- read-path: **exists** — `full_name` is read back into the panel on load, and drives avatar
  initials + message attribution across the app (`avatarInitialsFor`, AvatarCustomizationPanel).
  human_can_see: **yes** — the edited name shows on the user's avatar/attribution.
- reachability: **BUILT.** typecheck exit 0; the write path is guard-confirmed (0090 exempts full_name).

Email is shown read-only (disabled input) — there is no email-change flow, and one is not invented here.

## Not in this build (flagged, not silently dropped)

- The larger "substantial Settings" scope (unified hub, notification prefs, plan/module visibility,
  theme persistence) is NOT built here — it awaits founder scope confirmation. This is one bounded
  gap-fill on the existing page.

## Verification (A38)

`npm run check` output + exit code pasted in closure.md's verification record.
