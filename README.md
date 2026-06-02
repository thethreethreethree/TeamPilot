# ExecOS — AI Executive Operating System

> An AI Executive Operating System built under a constitutional discipline: the System
> must earn the right to speak before it asserts. Confident, fluent answers delivered
> before understanding is earned are the failure mode this project exists to defeat.

---

## What ExecOS is

ExecOS is not a productivity tool and not an instant-answers dashboard. It is a system
that holds open the diagnostic questions an executive needs to think about, surfaces
evidence as it accumulates, and only ever offers suggestions in dialogue with the user —
never as directives.

The governing document is [CLAUDE.md](CLAUDE.md). Every architectural choice in this
repo is enforcing one of its rules.

### Core surfaces

| Surface | What it does | Constitutional rule |
|---|---|---|
| **Command Center** | Surfaces today's open questions, uncertainties, and things worth noticing | §3.3 (guide, don't overtake) — questions, not actions |
| **Operations** | Task board + an "Awaiting evidence" panel that stays empty until the Understanding Gate clears | §3.2 (Understanding Gate is structural, not optional) |
| **Team Intelligence** | Workload + performance — scores are tagged `demo` when not derived from live signals | §3.4 (no fixed day-one behavior) |
| **Finance / Marketing** | Same shape as Operations — derived metrics, "Awaiting evidence" until the gate clears | §3.2 |
| **Conversation Dialogue** | Paste a transcript, state YOUR read first, the System refines with explicit WHY | §3.3 |
| **Decision Dialogue** | Four-phase conversation: Situation → Your read → System response → Decide & record | §3.3, §2 (explain WHY) |

### What it never does

- Assert a problem before signals support it (the **Understanding Gate**, encoded in the schema).
- Show a confident "AI diagnosis" before the user has stated their own read (the
  **structural interrupt** in every AI surface).
- Generate canned Safe/Balanced/Aggressive tiers that bypass the user's actual proposal.
- Recommend actions in the daily briefing — only surface questions and uncertainties.
- Loosen a rule for builder convenience without a ratified amendment.

---

## Architecture

```
src/
  app/
    page.tsx                       # Landing
    login/                         # Real Supabase auth (demo-mode fallback)
    onboarding/                    # Writes companies + profiles
    dashboard/
      page.tsx                     # Command Center — Today's Open Questions
      operations/                  # Tasks + AwaitingEvidence panel
      team/                        # Per-member workload (demo-tagged)
      finance/                     # MRR/runway/expenses (demo-tagged)
      marketing/                   # Funnel/channels/campaigns (demo-tagged)
      conversations/               # 3-phase: Transcript → Your read → System
      decisions/                   # 4-phase: Situation → Read → System → Decide
      settings/
    api/
      ai/
        briefing/                  # → generateDailyQuestions (NOT a directive)
        conversation-dialogue/     # Guide-don't-overtake transcript analyzer
        decision-dialogue/         # Guide-don't-overtake decision flow
        analyze/                   # (legacy) — still violates §3.3 until propagated
        decision/                  # (legacy)
        conversation/              # (legacy)
        finance/, marketing/       # (legacy)
      decisions/                   # POST: persist dialogue + outcome
      seed/                        # POST: bootstrap demo data for a real company
  components/
    layout/                        # Sidebar (live user/company), TopBar
    ui/
      ScoreRing.tsx                # Honest — supports null + demo tag
      StatusBadge.tsx
      AwaitingEvidence.tsx         # The empty state that respects the Gate
  lib/
    claude.ts                      # Anthropic SDK wrappers — guide-don't-overtake
    mock-data.ts                   # Demo fixtures (clearly labeled in UI)
    supabase/                      # Browser + server clients, env-gate
    data/                          # Per-domain fetchers with mock fallback
  middleware.ts                    # Session refresh + route guard (no-op in demo)

supabase/migrations/
  0001_init.sql                    # Companies, profiles, tasks, decisions, RLS
  0002_understanding_gate.sql      # Signals, problems, gate trigger
  0003_decision_dialogues.sql      # Full dialogue persistence (immutable user fields)
  0004_events.sql                  # Append-only events — foundation under signals

docs/
  amendments/                      # Constitutional amendments (append-only audit trail)
  LOCAL_DEV.md                     # Windows/PowerShell/VS Code/Claude Code workflow
  UNDERSTANDING_GATE.md            # Design rationale for §3.2 enforcement
  GUIDE_DONT_OVERTAKE.md           # Implementation rule for §3.3 surfaces

scripts/
  check-setup.ps1                  # Local environment doctor
.vscode/                           # Recommended extensions + tasks + debug profiles
```

---

## Two modes — demo and live

| Mode | Trigger | Behavior |
|---|---|---|
| **Demo** | No Supabase env vars | Middleware short-circuits. Login/onboarding pass through. Dashboards read from `mock-data.ts`. ScoreRings show a `demo` tag. Banners are honest. |
| **Live** | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set | Real auth, real onboarding writes, per-company data via RLS, Decision Dialogues persist with full WHY preserved. |

Demo mode exists to let you preview UX without external services. Live mode is the
real product — once configured, the Understanding Gate is enforced at the DB layer and
cannot be bypassed by application code.

---

## Local development

See [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md) for the full Windows / PowerShell / VS Code /
Claude Code workflow. Quick start:

```powershell
git clone https://github.com/<you>/TeamPilot.git
cd TeamPilot
npm install
Copy-Item .env.example .env.local
npm run setup:check              # color-checks env, ports, toolchain
npm run dev                      # http://localhost:4321
```

The dev server uses port **4321** (not 3000) to avoid collisions.

### Useful scripts

```powershell
npm run dev            # dev server with hot reload
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run check          # typecheck + lint
npm run setup:check    # PowerShell env doctor
```

---

## Going live (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run each migration in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_understanding_gate.sql`
   - `supabase/migrations/0003_decision_dialogues.sql`
   - `supabase/migrations/0004_events.sql`
3. **Settings → API**: copy URL + anon key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. **Settings → Authentication → Email**: turn off "Confirm email" for local testing.
5. `npm run dev` and sign up — onboarding writes the first `companies` + `profiles` rows.

For AI features: also add `ANTHROPIC_API_KEY=sk-ant-...` from
[console.anthropic.com](https://console.anthropic.com).

---

## Deploying

Vercel: import the repo, add the same env vars in Project → Settings → Environment
Variables, deploy. The dev port (`4321`) only applies locally; Vercel routes its own
HTTPS port.

---

## Constitutional discipline

Every change to this codebase is subject to the rules in [CLAUDE.md](CLAUDE.md). Changes
to those rules themselves go through the amendment process in
[docs/amendments/](docs/amendments/). Ratified amendments so far:

- [AMD-001](docs/amendments/AMD-001-establish-process.md) — Establish the amendment process
- [AMD-002](docs/amendments/AMD-002-understanding-gate-defaults.md) — Ratify Understanding Gate default thresholds (3 / 2 / 80)

If a rule conflicts with shipping faster, the rule wins. Speed that skips understanding
is the failure mode this project was built to defeat.

---

## License

MIT
