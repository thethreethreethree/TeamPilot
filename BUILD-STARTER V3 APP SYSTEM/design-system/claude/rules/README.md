# Path-scoped rules

Files here load **on demand** — only when Claude touches a matching path — so
the full design law costs nothing in context until it is relevant.

| File | Loads when working on |
|---|---|
| `tokens.md` | `theme.ts`, the NativeWind config, anything defining design tokens |
| `components.md` | `components/**`, any `.tsx` exporting a reusable element |
| `routes-and-nav.md` | `app/**/_layout.tsx`, screen routes, tab bar / navigation components |
| `forms.md` | anything containing an input, form, or validation |
| `copy.md` | any file containing user-facing strings |

Each file is a hard ruleset for its surface. When two rules appear to
conflict, the more specific path wins; when they genuinely conflict, stop and
ask rather than picking one.
