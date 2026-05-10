# ExecOS — AI Executive Operating System

> An AI-powered executive intelligence platform that helps CEOs, founders, and operators make better decisions faster — across every department.

---

## What is ExecOS?

ExecOS is not another productivity tool. It's an **AI Executive Operating System** — a command center that transforms raw business data into actionable executive intelligence.

**Core capabilities:**
- **CEO Command Center** — Business health scores, AI briefings, alerts, and daily priorities
- **Operations Intelligence** — Real-time bottleneck detection, blocked task analysis, execution tracking
- **Team Intelligence** — Workload balance, performance scores, burnout detection, accountability tracking
- **Conversation Intelligence** — Paste any meeting or thread, get a structured decision + action plan
- **AI Decision Engine** — Safe / Balanced / Aggressive decision options with expected outcomes
- **Decision Memory** — Every decision stored, tracked, and referenced by the AI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS |
| AI | Claude (Anthropic SDK) |
| Routing | Next.js App Router |
| Deployment | Vercel (recommended) |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/TeamPilot.git
cd TeamPilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get your API key at [console.anthropic.com](https://console.anthropic.com).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Sign in
│   ├── onboarding/page.tsx         # Company setup (4-step flow)
│   ├── dashboard/
│   │   ├── page.tsx                # CEO Command Center
│   │   ├── operations/page.tsx     # Operations dashboard
│   │   ├── team/page.tsx           # Team Intelligence
│   │   ├── conversations/page.tsx  # Conversation Intelligence
│   │   ├── decisions/page.tsx      # AI Decision Engine
│   │   └── settings/page.tsx       # Settings
│   └── api/ai/
│       ├── briefing/route.ts       # Daily executive briefing
│       ├── analyze/route.ts        # Operations diagnosis
│       ├── conversation/route.ts   # Conversation → decision
│       └── decision/route.ts       # Decision options generator
├── components/
│   ├── layout/                     # Sidebar, TopBar
│   └── ui/                         # ScoreRing, StatusBadge
└── lib/
    ├── claude.ts                   # Claude API functions
    ├── mock-data.ts                # Demo data
    └── utils.ts                    # Helpers
```

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add `ANTHROPIC_API_KEY` in Vercel → Project → Settings → Environment Variables
4. Deploy

---

## Roadmap

- [ ] Supabase database integration (persistent tasks, teams, decisions)
- [ ] Auth (NextAuth or Clerk)
- [ ] Finance department dashboard
- [ ] Marketing department dashboard
- [ ] Slack / Teams integration for Conversation Intelligence
- [ ] Mobile-responsive polish
- [ ] Multi-company support

---

## License

MIT
