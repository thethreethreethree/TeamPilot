# Local development — Windows + PowerShell + VS Code + Claude Code

This is the day-to-day workflow for running and hacking on ExecOS / TeamPilot on a local Windows machine.

---

## 1. First-time setup (5 minutes)

```powershell
# clone if you haven't already
git clone https://github.com/<you>/TeamPilot.git
cd TeamPilot

# install deps
npm install

# create your local env file
Copy-Item .env.example .env.local

# verify your machine is ready
npm run setup:check
```

`npm run setup:check` runs [scripts/check-setup.ps1](../scripts/check-setup.ps1) and reports — in color — every blocker (missing node, missing keys, ports in use). Re-run it any time the app behaves weirdly.

You can skip filling in any keys for now. The app will start in **demo mode** (mock data, no auth, no database) so you can preview the UI immediately.

---

## 2. Run the app

```powershell
npm run dev
```

Opens on **http://localhost:3100** (port 3100, not the default 3000, to avoid colliding with other Next.js projects you may have running).

The dev server uses Next.js + Turbopack — saves hot-reload in under a second.

---

## 3. The two modes

| Mode | When | Behavior |
|---|---|---|
| **Demo** | `NEXT_PUBLIC_SUPABASE_URL` not set | Sidebar shows "Demo Co" / "Demo User". `/login` and `/onboarding` skip auth and drop you into the dashboard. All pages read from [`src/lib/mock-data.ts`](../src/lib/mock-data.ts). |
| **Live** | Supabase keys set in `.env.local` | Real signup / login. Onboarding writes a real `companies` + `profiles` row. Dashboards read per-company data with row-level security. |

A yellow banner appears on the login screen when demo mode is active.

---

## 4. Turning on live mode (optional)

```powershell
# 1. Create a project at https://supabase.com (free tier is fine)
# 2. SQL Editor -> paste contents of supabase/migrations/0001_init.sql -> Run
# 3. Settings -> API -> copy URL + anon key into .env.local:
#
#    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
#
# 4. Settings -> Authentication -> Providers -> Email
#    Turn OFF "Confirm email" for easier local testing.
# 5. Restart the dev server.
npm run dev
```

For AI features (briefings, diagnoses, decision options), also add:

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 5. Useful scripts

```powershell
npm run dev            # dev server on :3100 (hot reload)
npm run build          # production build
npm run start          # serve the production build on :3100
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run check          # typecheck + lint
npm run setup:check    # verify your local environment
```

---

## 6. VS Code

Open the repo as a folder. VS Code will prompt to install the recommended extensions in [`.vscode/extensions.json`](../.vscode/extensions.json):

- **Tailwind CSS IntelliSense** - class autocomplete + previews
- **ESLint** - inline lint errors
- **Prettier** - format on save
- **PowerShell** - PowerShell scripting support
- **Claude Code** - in-editor AI pair programming

Built-in shortcuts:

- `Ctrl+Shift+B` - run the **dev** task (defined in [`.vscode/tasks.json`](../.vscode/tasks.json))
- `Ctrl+Shift+P` -> `Tasks: Run Task` -> pick `typecheck`, `lint`, or `check setup`
- `F5` - launch the **Next.js: debug server** profile from [`.vscode/launch.json`](../.vscode/launch.json), with breakpoints
- Use the **PowerShell** terminal profile (set as default) — `Terminal -> New Terminal`

---

## 7. Claude Code workflow

Claude Code is wired into this workspace. A few patterns that work well:

**Run things via Claude rather than typing them yourself.** Examples:
- "run setup check" -> Claude runs `npm run setup:check` in PowerShell and reads the output
- "start the dev server in the background" -> launches `npm run dev` as a background task and watches it
- "what's failing typecheck?" -> runs `npm run typecheck` and walks the errors with you

**Use it to navigate the code.** Examples:
- "where does the Finance page get its data from?"
- "show me every API route under /api/ai"
- "what changed in this branch?"

**Iterate on UI features.** Examples:
- "add a status filter to the invoices table on /dashboard/finance"
- "convert the Operations page to live Supabase queries with a fallback to mock data"

Claude has access to **Bash, PowerShell, Read, Edit, Write, Grep, Glob** in this workspace, so it can both edit code and run commands. When it makes changes, ask it to run `npm run check` before you commit.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE :3100` | Another dev server is on that port — `Get-Process node | Stop-Process -Force` or change the port in `package.json` |
| Sidebar shows "Loading..." forever | Supabase keys are set but the user has no profile yet — sign out and complete onboarding |
| `/login` 500s | Supabase URL is set but the project is paused/deleted — clear the keys to return to demo mode |
| Hot reload stops working | Stop the dev server, delete `.next/`, run `npm run dev` again |
| `pwsh: command not found` | The `pwsh` alias is PowerShell 7; on default Windows boxes use `powershell` |

---

## 9. Project map

```
src/
  app/
    page.tsx              # landing
    login/                # signup / signin
    onboarding/           # 4-step company setup
    dashboard/            # all 6 modules
    api/ai/               # Claude routes (briefings, diagnoses, decisions)
  components/
    layout/Sidebar.tsx    # nav + company + user
    layout/TopBar.tsx
    ui/                   # ScoreRing, StatusBadge
  lib/
    claude.ts             # Anthropic SDK wrappers
    mock-data.ts          # demo fixtures
    supabase/             # browser client, server client, env config
    utils.ts
  middleware.ts           # session refresh + route guard
supabase/
  migrations/0001_init.sql   # full schema + RLS
scripts/
  check-setup.ps1            # local environment doctor
.vscode/                     # extensions, settings, launch, tasks
```
