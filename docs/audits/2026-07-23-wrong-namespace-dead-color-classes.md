# Dead color-utility classes (wrong-namespace) — 2026-07-23

Surfaced while building the `no-invisible-bare-color-utilities` guard (commit `171f0726`). These are a
*different, lower-severity class* than the guard covers: a semantic color token registered in ONE Tailwind
namespace (e.g. `textColor`) but used bare in ANOTHER (`bg-`/`border-`) where it isn't registered. Tailwind
emits **no rule**, so the styling silently renders nothing. All 5 are real (verified they're live classNames),
but each fix is a **visual/design decision** (AMD-006 layer 4) — the exact replacement token/shade should be
confirmed by eye, which is why they're surfaced here rather than auto-fixed.

| # | File:line | Dead class | Intent | Recommended fix |
|---|---|---|---|---|
| 1 | `src/components/sales-coach/LiveCoachingPanel.tsx:291,319` | `bg-muted` | A dim/grey status dot when the agent is NOT speaking (amber `bg-ember-400` when speaking). Renders invisible now. | `bg-[rgb(var(--text-muted))]` (faithful, theme-aware) or an explicit grey shade. |
| 2 | `src/app/dashboard/admin/coach-readout/page.tsx:923` | `bg-accent-text/5` + `border-accent-text/30` | An amber-tone chip, parallel to the emerald branch (`border-emerald-500/30 bg-emerald-500/5`). `accent-text` is a text-only token, so the tint + border don't render. | `border-ember-400/30 bg-ember-400/5` (keep `text-accent-text`) — mirrors the emerald sibling. |
| 3 | `src/components/care/ConversationsApp.tsx:3611` | `bg-default/40` | A col-resize handle: subtle divider color at rest, amber on hover. Invisible at rest now. | `bg-[rgb(var(--border-default)_/_0.4)]`, or register `default` in `backgroundColor` (as `base` already is). |
| 4 | `src/app/dashboard/care/settings/tags/page.tsx:129` | `border-primary` | The selected color-swatch's highlight border (`+ scale-110`). No border shows now. | `border-strong` (existing prominent border) or `border-[rgb(var(--text-primary))]`. |

**Root pattern:** the theme config registers semantic tokens inconsistently across namespaces. `base` is
deliberately registered on `backgroundColor`/`borderColor`/`ringColor` (and kept OUT of `colors` to avoid the
`text-base` font-size collision). The systematic fix would be to register the handful of cross-namespace
semantic tokens (`default`, `strong`, `muted`, `primary`, `secondary`) wherever they're legitimately used —
but that's a design call, so it's flagged, not applied.

**Not caught by CI:** the shipped guard (`no-invisible-bare-color-utilities.test.ts`) is intentionally scoped to
the `colors`-scale-without-DEFAULT class (the recurring F4/V7/C4 one) to stay precise. This wrong-namespace
class could be added to it later once the founder decides the config-vs-callsite direction.
