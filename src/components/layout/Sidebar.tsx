"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isAdminRole } from "@/lib/roles";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  DollarSign,
  Megaphone,
  MessageSquare,
  MessageSquarePlus,
  BookOpen,
  GraduationCap,
  ClipboardList,
  Brain,
  Settings,
  ChevronRight,
  LogOut,
  GitMerge,
  Stethoscope,
  ShieldCheck,
  Sparkles,
  Beaker,
  Bell,
  ChevronLeft,
  Heart,
  Hourglass,
  Building2,
  FolderOpen,
  Eye,
  Search as SearchIcon,
  Mic,
  X,
  CalendarDays,
} from "lucide-react";
import { resolveCyclePhase } from "@/lib/cycle/phase";
import { LearningHint } from "@/components/learning/LearningHint";
import { cn } from "@/lib/utils";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { VENDOR_COMPANY_ID } from "@/lib/crm/vendorCompanyId";
import { CONSTITUTION } from "@/lib/constitution";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useUnreadNotifications } from "@/lib/notifications/useUnread";
import { LightbulbMark } from "@/components/brand/Logo";
import { FeedbackPanel } from "@/components/feedback/FeedbackPanel";

type NavHint = {
  whatItIs: string;
  why: string;
  how: string;
  principle?: string;
};

const productionNav: Array<{
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  hint: NavHint;
}> = [
  {
    label: "Command Center",
    href: "/dashboard",
    icon: LayoutDashboard,
    hint: {
      whatItIs:
        "The operational hub. The §3.1 chain at a glance: open tasks, signals, problems, resolutions, held rate. Plus C.A.R.E support state when the tenant has support activity. Today's open questions on demand. Where-to-focus suggestion based on actual chain state.",
      why: "Every other team-software product surfaces 'activity' on the home page. ELOSTATE surfaces CONSEQUENCE — held rate, surfaced problems, durability due. The hub answers 'what's worth attending to today' instead of 'what happened recently'.",
      how: "Land here when starting a session or returning from a context shift. Read the stats top-down, then check the where-to-focus suggestion if you're unsure where to go next. Click any stat card to drill into its module.",
      principle:
        "The hub measures consequence. Activity belongs in the modules; the hub asks whether the team is producing durable outcomes.",
    },
  },
  {
    label: "Team Chat",
    href: "/dashboard/chats",
    icon: MessageSquare,
    hint: {
      whatItIs:
        "Topic-threaded team conversations with participants, @mentions, reactions, and Coach v5 communication coaching on every draft. Each topic is a self-contained reasoning space. Decision Dialogues can open inline inside any topic.",
      why: "Slack is for talking; this is for deciding what matters. Every message becomes part of the §3.1 chain — mentions become events, conversations get linked to tasks and decisions, and the Coach surfaces sharper drafts before the team commits a phrasing it'll regret.",
      how: "Open or create a topic for any work that involves the team. The composer coaches you while you type. @mentions notify; everything threads. When a topic surfaces an actual decision, open the Decision Dialogue inside the thread rather than fragmenting the reasoning across tools.",
      principle:
        "Conversation is the substrate. The discipline is in capturing the reasoning, not in moving faster.",
    },
  },
  {
    label: "Search",
    href: "/dashboard/search",
    icon: SearchIcon,
    hint: {
      whatItIs:
        "A single search box across the team's three durable surfaces — files (title + description), team chat messages (body), and C.A.R.E support conversations (body, excluding internal notes). Results grouped by type.",
      why: "Capture without retrieval is a write-only log. Search is what makes the team's writing pay off later — the message you write today is the answer somebody finds next month.",
      how: "Type any term. Debounced 250ms. Click any result to jump into context. Respects access roles — you only see what you'd see in the original surface.",
      principle:
        "Retrieval is what makes capture worth it.",
    },
  },
  {
    label: "Files",
    href: "/dashboard/files",
    icon: FolderOpen,
    hint: {
      whatItIs:
        "The team's asset library. Every file uploaded across Tasks, Team Chat, and C.A.R.E lands here, classified by department + task + description (the §3.2 Understanding Gate applied to assets). Files missing classification count toward your 3/day casual cap.",
      why: "A file storage layer without a gate produces a graveyard — most files uploaded once, never retrieved, never cited. The 3 classification fields are the structural defense; the casual escape hatch is the honest acknowledgment that not everything needs to be an asset.",
      how: "Drop a file or click to upload. Classify it (or accept the casual lane). Filter and search to find what the team already built. Click a card to download. Edit classification any time.",
      principle:
        "The 3 fields are not metadata. They ARE the team's asset memory.",
    },
  },
  {
    label: "Tasks",
    href: "/dashboard/operations",
    icon: ListChecks,
    hint: {
      whatItIs:
        "The Operations board: every task with status, priority, assignee, due date, blocker reason. Status transitions are validated server-side; tasks can't skip states. Blocker reason is required when status='Blocked' — the System refuses to leave a task blocked with no stated reason.",
      why: "Most task systems optimize for 'how many tickets did we close.' This one asks 'did the work resolve the underlying problem?' A closed ticket whose underlying problem reopens within 7 days is failure, not success — and the §3.5 durability tracking on Resolutions enforces that.",
      how: "Use the board for the work-in-flight view. Use task detail when you need to see the reasoning chain that spawned the task. Blockers without stated reasons are a smell — fix the data, not just the work.",
      principle:
        "Tickets are units of work; reasoning is the unit of capability. A team that closes 100 tickets without recording reasoning is busier, not better.",
    },
  },
  {
    label: "Team",
    href: "/dashboard/team",
    icon: Users,
    hint: {
      whatItIs:
        "The roster: every team member with role (CEO / COO / admin / member / support agent), invitations, and revocations. New invites are sent via the Invite flow with role assignment at invite time.",
      why: "Roles aren't decoration here — they shape what each user sees and can do across the System. Admin role gates leadership readouts. Support agent role gates the C.A.R.E inbox. Getting the role right at invite time prevents downstream confusion.",
      how: "Add a teammate via Invite — pick role, send. They get an invitation email; clicking it brings them through profile setup. Revoke when someone leaves. Update roles via the row controls when responsibilities change.",
      principle:
        "Role is permissioning that's also pedagogy. A user's role signals what part of the System they're responsible for.",
    },
  },
  {
    label: "Schedule",
    href: "/dashboard/schedule",
    icon: CalendarDays,
    hint: {
      whatItIs:
        "The staff scheduling tool: a roster of your team, a staff-by-date grid of who works when, and a file import (paste a CSV schedule and the AI proposes the dates + shift codes for you to confirm). Event-sourced — every change is an immutable event; the schedule is a projection over the log.",
      why: "Scheduling is where coverage promises are kept or broken. The System computes coverage and eligibility deterministically and proposes fills; it never silently publishes an understaffed shift or auto-decides for you — it surfaces the impact and leaves the call to the manager.",
      how: "Add staff to the Roster, then Import (or build) a schedule; the Schedule grid shows who works when. When you review a time-off request, the System shows the coverage impact and a recommended fill — you approve or override.",
      principle:
        "The tool diagnoses staffing honestly and proposes; the human decides. Understand the whole schedule before changing it.",
    },
  },
  {
    label: "Living Diagnosis",
    href: "/dashboard/diagnose",
    icon: GitMerge,
    hint: {
      whatItIs:
        "The full §3.1 chain in motion: events → signals → problems → resolutions → new events. The page shows the signal stream (what the System has noticed) with the data sources and observation timestamps. It's the chain made visible.",
      why: "Most products hide the work the System is doing behind a 'magic AI' framing. ELOSTATE refuses that — the chain IS the product. Showing it explicitly means the team can audit what signals exist, where they came from, and whether the System is picking up real patterns or noise.",
      how: "Browse signals when you're investigating a specific suspicion ('did the System pick up the meeting overrun last Tuesday?'). The signal kinds tell you which event sources are emitting. A signal stream that's mostly one kind is a tenant that's only exercising one part of the System.",
      principle:
        "Diagnosis works backward from the record. The chain page is the record made navigable.",
    },
  },
  {
    label: "Dissect a Conversation",
    href: "/dashboard/dissect",
    icon: Stethoscope,
    hint: {
      whatItIs:
        "Paste any conversation and the System summarizes it, then dissects the PROBLEM inside it — the Living Diagnosis method (§1) pointed at a pasted conversation instead of the team's own event chain. Comes with Ask Coach, a thread where you work the problem out with a coach that asks what you think first.",
      why: "Not every problem lives in your event stream. A thread from a customer, a stuck decision pasted from elsewhere, a transcript — this is where you bring an outside conversation and run the same discipline on it: identify the problem from what actually occurred (§1.2), see it from the outside (§1.3), earn the root cause before solving (§0).",
      how: "Paste the conversation, hit Dissect. Read the problem + the evidence quoted from the text. Then open Ask Coach — it asks how YOU would solve it before offering its own take with the why (§3.3). It's per-chat: nothing is saved unless you Save the topic; Close clears an unsaved one so you can start fresh.",
      principle:
        "Understanding precedes solving — even for a conversation that isn't yours. The dissect earns the problem; the coach guides you to the solution rather than handing it down.",
    },
  },
  {
    label: "Problems",
    href: "/dashboard/problems",
    icon: ShieldCheck,
    hint: {
      whatItIs:
        "The problem board: every named problem the team is aware of, split by status (draft / surfaced / dismissed / resolved). Draft problems are still being earned; surfaced problems have crossed the §3.2 evidence threshold and are ready for action.",
      why: "The Understanding Gate (§3.2) is the System's structural refusal to promote a half-understood problem. The board makes the gate visible — you see what the team is articulating, what's earned the right to be acted on, and what got dismissed (with the reason captured).",
      how: "Draft a problem by writing what you're observing + linking the supporting signals. The gate tells you what's still missing before it can surface. Don't fight the gate — gather more signal or sharpen the diagnosis.",
      principle:
        "A problem promoted before it has earned the right to be named is the most expensive kind of work. The gate is the discipline encoded.",
    },
  },
  {
    label: "Resolutions",
    href: "/dashboard/resolutions",
    icon: Sparkles,
    hint: {
      whatItIs:
        "The resolution corpus: every closed problem with action taken, reasoning (≥40 chars required), expected outcome, observed outcome, and durability state (held / reopened / partial / inconclusive). The team's playbook, derived from what actually worked.",
      why: "Closing a ticket without recording the reasoning is the failure mode every productivity tool ships. The resolution corpus is the institutional memory the team usually loses to turnover. Browse it when the same kind of problem comes back; the prior reasoning is right there.",
      how: "Walk through unreviewed resolutions whose durability check is overdue — the §3.5 measurement is the single most important metric the System tracks. Browse by category to see patterns. Export when assembling a postmortem or a strategy doc.",
      principle:
        "Tickets close; reasoning compounds. A team that records the WHY behind every resolution gets better at the work over time. A team that doesn't, rediscovers the same fixes.",
    },
  },
  {
    label: "Company Brain",
    href: "/dashboard/brain",
    icon: Brain,
    hint: {
      whatItIs:
        "The per-tenant learning composition layer. The Brain reads your team's accumulated patterns, durable resolutions, and characteristic failure modes — and composes them into the system prompt of every AI call. After the §3.4 control window, every AI output is shaped by THIS team's record, not a generic template.",
      why: "Generic AI tools give every customer the same answer. The Brain is what makes ELOSTATE's AI specific to your team. The control window (month-1 silent baseline) exists so the Brain has real data to compose from before it starts speaking. Without the wait, the Brain would be guessing.",
      how: "Read the learning summary periodically to see what patterns the System has noticed about your team. Unlock the control window manually only if you have a real reason (and the override gets recorded with your reason; future review can assess whether the early unlock helped).",
      principle:
        "An AI shaped by your team's actual record is fundamentally different from an AI prompted with your industry. The wait is the feature.",
    },
  },
  {
    label: "Decision Dialogue",
    href: "/dashboard/decisions",
    icon: Brain,
    hint: {
      whatItIs:
        "Structured four-phase reasoning for decisions that deserve more than a Slack reply: Situation → Your Read → System Response → Decide (adopt yours / adopt System's / hybrid / defer). The System never asserts before you've spoken.",
      why: "Most decisions in teams get reasoning attached AFTER the fact, in the form of post-hoc narrative. Decision Dialogue forces the reasoning to be captured BEFORE resolution — and lets the System weigh in with explicit WHY only after you've stated yours. The reasoning is the transferable asset; the dialogue captures it.",
      how: "Open a Dialogue when a decision is worth more than 5 minutes of thought. Walk through the phases honestly — write your actual diagnosis, your actual proposal. Engage the System's response; don't just accept it. Decide. The record survives the meeting.",
      principle:
        "The System asks first, suggests second, never asserts. The reasoning is transferred to the human, not retained by the machine.",
    },
  },
  {
    label: "My growth",
    href: "/dashboard/my-growth",
    icon: Heart,
    hint: {
      whatItIs:
        "Your personal development surface — 30-day rolling read of your resolutions (with durability outcomes), Co-Pilot edit magnitudes (in C.A.R.E), Coach grades over time. Personal, not surveillance: each member sees their own; admin readouts aggregate at team level without per-agent identification per §A18.",
      why: "Most team-tools optimize for leadership readouts and treat individual development as an afterthought. My growth flips that — the individual's view of their own pattern is the highest-leverage learning surface in the System. The admin equivalent stays separate so this surface stays trustworthy.",
      how: "Visit weekly. Look at durability outcomes on your own resolutions — what held, what reopened. Read Coach feedback patterns on your own messages. The goal isn't to improve the numbers; the goal is to notice the pattern of what kinds of reasoning you produce vs what kinds hold.",
      principle:
        "Your own pattern is the most useful teaching artifact you have access to. The System surfaces it so you don't have to wait for an annual review to see it.",
    },
  },
  {
    label: "C.A.R.E",
    href: "/dashboard/care",
    icon: MessageSquarePlus,
    hint: {
      whatItIs:
        "Customer Assistance and Response Engine. A complete support module: multi-channel inbox (widget / email / voice), Read Phase before reply, AI Co-Pilot drafting with surfaced precedents, Coach pre-send analysis, Resolution capture, §3.5 durability tracking, Knowledge base, Leadership readouts.",
      why: "Standard support tools optimize for 'how fast did we close the ticket.' C.A.R.E asks 'did we resolve what the customer was actually trying to solve, and did it hold?' Same constitutional discipline as the rest of the System, applied to customer-facing reasoning.",
      how: "Open conversations from the inbox. The Read Phase shows context first; reply, then capture resolution when done. The 7-day durability check shows up automatically. Browse Knowledge for institutional memory; Patterns for what's recurring; Leadership readouts for team-level health.",
      principle:
        "Support is the same discipline applied to customer-facing reasoning. The fact that the customer is external doesn't change the rule.",
    },
  },
  {
    label: "Sales Coach",
    href: "/dashboard/sales-coach",
    icon: Mic,
    hint: {
      whatItIs:
        "Live Sales Coach. Real-time AI coaching during live customer conversations (in-person and online), then a post-conversation growth review. Records the diarized transcript + the cues delivered as immutable assets, and shows your reliance on live cues over time.",
      why: "A scorecard tells you where you rank; it doesn't help you improve. The Live Sales Coach is a digital gym: it validates what you did well first, then frames growth as concrete next steps, and tracks you against your own past — so the live cues become training wheels that come off.",
      how: "Start a session (online video or in-person), and your transcript, cues, and review attach to it. After the call, generate the growth review: strengths first, then opportunities with a concrete next step each. Watch your cue-reliance trend fall as the moves become yours.",
      principle:
        "Coach toward independence, not dependence: the goal is needing fewer cues over time, measured against your own past — never a ranking against others.",
    },
  },
  {
    label: "Bootcamp",
    href: "/dashboard/bootcamp",
    icon: GraduationCap,
    hint: {
      whatItIs:
        "Learning and training materials for specific features and fields of the System. Each Bootcamp area is a focused training track — the first is Master Sales Mind. A place the team comes to build capability deliberately, not by osmosis.",
      why: "Capability that's only ever transferred ad hoc (a Slack message here, a call there) doesn't compound. A dedicated training surface makes learning a first-class, returnable place — so the team gets better at specific fields on purpose, and new members have somewhere to start.",
      how: "Open Bootcamp, pick a training area, and work through its materials. Start with Master Sales Mind. New areas get added as the team's training needs grow.",
      principle:
        "Capability built deliberately compounds; capability left to osmosis evaporates with turnover.",
    },
  },
];

const testingNav: Array<{
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  hint: NavHint;
}> = [
  {
    label: "Smoke test",
    href: "/dashboard/smoke-test",
    icon: ClipboardList,
    hint: {
      whatItIs:
        "A structured pilot-acceptance checklist — every item the team agreed must pass before the System is signed off. Each row: a thing to verify, pass/fail/unable buttons, a notes field. Pass produces a chain event so completion is auditable; fail surfaces in the admin feedback inbox.",
      why: "Pilot validation is the single moment when claims get traded for evidence. Most teams skip this step and ship into ambiguity. The smoke-test page is the structural defense — leadership can't claim 'we tested it' without rows on this surface.",
      how: "Walk every item top to bottom. Notes are required when status is fail or unable. The Coach v6 model in the background reviews notes; admin sees a triage list. After the smoke test passes end-to-end, the team has crossed from claim to evidence.",
      principle:
        "Acceptance is a moment that should be recorded, not inferred. The smoke test is the record.",
    },
  },
  {
    label: "My feedback",
    href: "/dashboard/feedback",
    icon: MessageSquare,
    hint: {
      whatItIs:
        "Your personal view of every feedback report you've filed plus its current triage state (open / triaged / in-progress / resolved / declined / duplicate). Submit a new report from the button at the top.",
      why: "Without this surface, the team filing feedback would never see what happened to it. That loop — file, watch it move through triage, see it resolved — is what turns 'feedback' into a real channel rather than a black hole.",
      how: "Click 'Submit new feedback' to file. Watch the status column on each row evolve. When an admin transitions a row, you see it here. Filter by status to see only what's still open.",
      principle:
        "Feedback that disappears is feedback the team will stop filing. Visible triage is what keeps the channel alive.",
    },
  },
  {
    label: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    hint: {
      whatItIs:
        "The unified surface for every signal addressed at YOU — @mentions in topics, Decision Dialogue activity in topics you participate in, task additions where you were tagged, C.A.R.E pings (if you're an agent). Each row links to where the signal landed.",
      why: "Push notifications + slack + email + tickets fragment attention. The dashboard's notifications page is the single inbox for things specific to you — capture what's there, then close the page. Pulled, not pushed.",
      how: "Open once or twice a day. Walk top to bottom; click into anything that needs an action. The unread dot in the sidebar tells you when something new has landed.",
      principle:
        "Pulling beats pushing for sustained attention. Use this surface intentionally; don't let it use you.",
    },
  },
];

const adminNav: Array<{
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  hint: NavHint;
  // vendorOnly items render only for a vendor super-admin (admin whose company IS the vendor
  // company) — they are 404-gated server-side, and this keeps them from being advertised to a
  // customer admin who could never reach them (vendorAuth's stated posture).
  vendorOnly?: boolean;
}> = [
  {
    label: "Asset readout",
    href: "/dashboard/admin/asset-readout",
    icon: FolderOpen,
    hint: {
      whatItIs:
        "The Asset System v1 §4 readout — measures whether files become team assets or sit unused. Four metrics per the spec: re-retrieval rate (target > 40%), cross-actor retrieval (target > 25%), citation rate, and routing-rule acceptance. Time windows: 7 / 30 / 60 days / all-time.",
      why: "A file storage layer without measurement is a graveyard. The discipline only pays off if files compound as team assets. This page is how the founder verifies the discipline is working — and surfaces graveyard signals (rate < 15%) when it isn't.",
      how: "Pick a window. Read each metric's evaluation (Healthy / Below target / Graveyard). Below-target rates are signals to ask 'why don't people retrieve their files later?' — not failures to suppress.",
      principle:
        "Measurement anchored to consequence is what makes the discipline real. Measurement anchored to adoption is grading our own homework.",
    },
  },
  {
    label: "Customer accounts",
    href: "/dashboard/admin/crm",
    icon: Building2,
    vendorOnly: true,
    hint: {
      whatItIs:
        "The vendor CRM — every tenant company (ELOSTATE's customers) with lifecycle stage, subscription, contacts, billing events, account-owner notes. Test accounts (founder dev signups) are hidden by default; toggle to surface them.",
      why: "Even a discipline-first product has customer admin work. The CRM is the honest minimum that surfaces lifecycle stage, billing state, and contact history without becoming a Salesforce ceremony. Vendor-side metrics (count by stage, MRR trend) live here.",
      how: "Browse the list to scan customer health. Click into an account for full detail (subscription edit, invoices, contacts, notes). Use Environment filter to keep dev signups out of the production-customer view.",
      principle:
        "Vendor metrics need clean data. The CRM exists so customer admin doesn't pollute the team's operational surfaces.",
    },
  },
  {
    label: "Session monitoring",
    href: "/dashboard/admin/monitoring",
    icon: Eye,
    vendorOnly: true,
    hint: {
      whatItIs:
        "Founder oversight (0214 exemption): the sessions of the companies on the monitoring allowlist — drill company → session → transcript. Vendor-super-admin only; scoped to the companies that existed when it was granted, and every session you open is recorded to the monitoring audit log.",
      why: "A customer owner asked the founders to help monitor their agents' sessions. Rather than weaken every tenant's isolation, this is one contained, allowlisted, audited vendor surface — access is accountable, not a hidden backdoor.",
      how: "Pick a company, then a session, to read its transcript. New customers are NOT auto-included; a company is added to the allowlist deliberately. Access is logged (actor, company, session).",
      principle:
        "Cross-tenant access, when sanctioned, is contained and audited — never silent. Oversight the monitored party could in principle see is honest; surveillance it can't is not.",
    },
  },
  {
    label: "Feedback inbox",
    href: "/dashboard/admin/feedback",
    icon: MessageSquarePlus,
    hint: {
      whatItIs:
        "The admin-side triage surface for all feedback rows the team has filed. Filter by status (open / triaged / in-progress / resolved / declined / duplicate) and by kind (bug / friction / idea / question / praise / smoke-test-result). Action buttons transition each row through the triage workflow.",
      why: "Feedback that doesn't get triaged becomes silent failure. This surface forces leadership to engage with every report — even the duplicates, even the praise. The action of transitioning a row also writes a chain event so the audit trail is intact.",
      how: "Walk the Open filter once a day or so. Transition rows: triaged (acknowledged, in queue), in_progress (someone's working it), resolved (fixed/built), declined (with reason), duplicate (with link to the original).",
      principle:
        "The cost of a feedback row is bounded; the cost of NOT triaging it is unbounded.",
    },
  },
  {
    label: "Coach readout",
    href: "/dashboard/admin/coach-readout",
    icon: BookOpen,
    hint: {
      whatItIs:
        "The §4 leadership readout — Coach grading distribution, communication-pattern trends, before/after Coach ON vs Coach OFF comparison data. Aggregate across the team; never per-agent (per §A18, no stack-rank).",
      why: "The Coach is the team's communication mirror. The readout is how leadership reads the mirror without invading individuals' privacy. Per §3.5, only consequence measures count; the readout filters Coach-grading data through that discipline.",
      how: "Read trend over time, not single snapshots. Compare Coach-on cohorts against Coach-off cohorts where available. The deltas are the team's actual learning rate; the absolute counts are context.",
      principle:
        "Aggregate visibility, individual privacy. The §A18 line that separates leader-readout from agent-readout is constitutional.",
    },
  },
  {
    label: "Team check",
    href: "/dashboard/admin/team-check",
    icon: Heart,
    hint: {
      whatItIs:
        "The §Pillar 2 invitation surface — surfaces tasks that have gone stale (4+ days without activity) for an admin to send a structured check-in (the NudgeModal) to the assignee. Records the nudge as a chain event so the §4 readout can measure whether nudges actually moved the work.",
      why: "Standing micromanagement is corrosive; ignoring stalled work is irresponsible. The team check is the structured middle path — an admin sends ONE message at the right moment, framed as a doorway not a deadline, and the System tracks whether it landed.",
      how: "Open this page when you've been wondering 'who might need a doorway today.' For each row, click 'Send check-in', edit the suggested message to match your voice and relationship with the person, send. The system records whether the task moved.",
      principle:
        "The leader's job at this surface is to open doors, not push backs. The discipline is in the framing of the message.",
    },
  },
];

const designPreviewNav: Array<{
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  hint: NavHint;
}> = [
  {
    label: "Finance",
    href: "/dashboard/finance",
    icon: DollarSign,
    hint: {
      whatItIs:
        "A design preview of the future Finance dashboard. The AI Finance Diagnosis feature was sunset in 2026-04 (it produced surface-level patterns that failed §3.2). The next version replays the same chain architecture you see in Operations, scoped to finance — when it ships, this preview becomes real.",
      why: "Design previews exist so leadership can review the SHAPE of a future module before committing to build it. Showing layout + data structure ahead of the AI integration is honest about the build sequence: layout first, then chain, then AI lens.",
      how: "Don't operate from this surface yet. Browse to see what's coming. Tell us if the shape doesn't match what your team would actually need.",
      principle:
        "Design preview is the honest tradeoff: SHOW what's coming, don't HIDE that it's not built.",
    },
  },
  {
    label: "Marketing",
    href: "/dashboard/marketing",
    icon: Megaphone,
    hint: {
      whatItIs:
        "Same design-preview pattern as Finance — a layout for the future Marketing dashboard. AI Marketing Diagnosis was sunset for the same reason: the chain architecture needs to be in place (events from real ad/CRM integrations, signals derived from at least 2 sources) before AI can compose anything trustworthy.",
      why: "Build sequence: surface layout → chain events → durable signals → AI lens that won't fail §3.2. We're at step 1 here; the next steps require infrastructure that hasn't shipped.",
      how: "Browse for layout review. Don't depend on data shown here.",
      principle:
        "Marketing AI fails most often by pattern-matching against weak signals. The honest version waits for §3.2 to be satisfiable.",
    },
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("—");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  // True iff the signed-in user's company IS the vendor company — gates the vendorOnly
  // adminNav items (Customer accounts, Session monitoring) so they never advertise to a
  // customer admin. Cosmetic: the pages + APIs are the real server-side gate.
  const [isVendorCompany, setIsVendorCompany] = useState(false);
  // §3.4 cycle phase for the sidebar badge — so the founder /
  // admin always sees where they are in the 60-day proof window
  // without navigating to settings.
  const [cyclePhase, setCyclePhase] = useState<{
    phase: "control" | "intervention" | "ongoing";
    daysIntoCycle: number;
    daysRemainingInPhase: number;
    skippedControl: boolean;
  } | null>(null);
  const unread = useUnreadNotifications();
  // Mobile drawer state — controlled via a custom event the TopBar
  // hamburger dispatches. Closes when the user navigates (effect on
  // pathname) and on backdrop tap.
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop collapse state (rail mode). Persisted in localStorage
  // so the workspace shape sticks across sessions. Writes a body
  // data-attribute so the dashboard layout's <main> can react via
  // a global CSS rule (see globals.css — the layout is server-
  // rendered, the sidebar is client; data-attribute is the
  // cheapest cross-cut).
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("elostate-sidebar-collapsed");
      if (raw === "1") setDesktopCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "elostate-sidebar-collapsed",
        desktopCollapsed ? "1" : "0"
      );
      if (typeof document !== "undefined") {
        if (desktopCollapsed) {
          document.body.dataset.sidebarCollapsed = "true";
        } else {
          delete document.body.dataset.sidebarCollapsed;
        }
      }
    } catch {
      /* ignore */
    }
  }, [desktopCollapsed]);
  // Feedback panel state — the "Send feedback" entry in the Testing
  // section opens this. Replaces the floating bottom-right button
  // on dashboard routes per user request.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  useEffect(() => {
    const onToggle = () => setMobileOpen((v) => !v);
    const onClose = () => setMobileOpen(false);
    window.addEventListener("elostate:toggle-sidebar", onToggle);
    window.addEventListener("elostate:close-sidebar", onClose);
    return () => {
      window.removeEventListener("elostate:toggle-sidebar", onToggle);
      window.removeEventListener("elostate:close-sidebar", onClose);
    };
  }, []);
  // Escape key closes the mobile drawer — keyboard parity for the
  // backdrop-tap dismissal that already exists.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);
  // Body scroll lock while the mobile drawer is open. Without this,
  // a long sidebar in a short viewport could scroll the page behind
  // the drawer when the user touches the open drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);
  useEffect(() => {
    setMobileOpen(false); // close drawer on route change
  }, [pathname]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setCompanyName("Demo Co");
      setUserName("Demo User");
      setUserRole("Demo Mode");
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "full_name, role, company_id, companies(name, cycle_started_at, cycle_control_skipped_at)"
        )
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profile) {
        setUserName(profile.full_name ?? auth.user.email ?? "");
        setUserRole(profile.role ?? "");
        setIsVendorCompany(
          (profile.company_id as string | null) === VENDOR_COMPANY_ID
        );
        const company = profile.companies as {
          name?: string;
          cycle_started_at?: string;
          cycle_control_skipped_at?: string | null;
        } | null;
        if (company?.name) setCompanyName(company.name);
        if (company?.cycle_started_at) {
          const details = resolveCyclePhase({
            cycleStartedAt: company.cycle_started_at,
            cycleControlSkippedAt: company.cycle_control_skipped_at ?? null,
          });
          setCyclePhase({
            phase: details.phase,
            daysIntoCycle: details.daysIntoCycle,
            daysRemainingInPhase: details.daysRemainingInPhase,
            skippedControl: details.skippedControl,
          });
        }
      }
    })();
  }, []);

  const initials = (userName || "EX")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    if (supabaseEnabled) await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
    {/* Mobile backdrop — appears below the drawer, taps to close. */}
    {mobileOpen && (
      <div
        className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
    )}
    {/* When collapsed on desktop: render the 48px rail with a
        single expand button. Mobile drawer still uses the full
        sidebar — collapse is desktop-only because mobile UX is
        already drawer-based. */}
    {desktopCollapsed && (
      <button
        type="button"
        onClick={() => setDesktopCollapsed(false)}
        aria-label="Expand sidebar"
        title="Expand sidebar"
        className="hidden md:flex fixed left-0 top-0 h-screen w-12 bg-surface border-r border-default z-40 items-center justify-center text-muted hover:text-primary hover:bg-white/[0.03]"
      >
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    )}
    <aside
      className={cn(
        // h-dvh follows the visible viewport on mobile (shrinks when
        // keyboard opens), avoiding the bottom of the sidebar
        // disappearing behind the keyboard.
        "fixed left-0 top-0 h-dvh w-64 bg-surface border-r border-default flex flex-col z-40 transition-transform duration-200",
        "md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Hide the full sidebar on desktop when collapsed — the
        // 48px rail above takes over. Mobile drawer behavior is
        // unchanged (it ignores desktopCollapsed entirely).
        desktopCollapsed && "md:-translate-x-full"
      )}
      aria-label="Primary navigation"
    >
      {/* Logo — canonical bulb (amber, transparent) + ELOSTATE wordmark
          (Inter-Black for theme adaptability) + tagline + live/demo dot.
          The bulb image's native aspect is 255×354 (taller than wide),
          so width/height match the actual asset proportions to avoid
          stretching. */}
      <div className="px-6 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] border-b border-default relative">
        {/* Desktop-only collapse trigger. Mobile keeps the drawer
            pattern (the X button at top-right of the drawer
            already exists for that). */}
        <button
          type="button"
          onClick={() => setDesktopCollapsed(true)}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          // p-2 + 3.5x3.5 icon = ~28px tap target on the desktop
          // collapse trigger. On iPad landscape (which falls into the
          // md breakpoint) this matters.
          className="hidden md:flex absolute top-2 right-2 text-muted hover:text-primary p-2 rounded hover:bg-white/[0.04] items-center justify-center"
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <Link
          href="/"
          aria-label="ELOSTATE — landing page"
          className="flex items-center gap-3 group"
        >
          <LightbulbMark
            width={28}
            height={39}
            className="flex-shrink-0 transition-transform group-hover:scale-105"
          />
          <div className="min-w-0">
            <span className="block text-base font-black text-primary tracking-tight leading-none">
              ELOSTATE
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  supabaseEnabled ? "bg-ember-300 pulse-dot" : "bg-ember-500"
                }`}
              />
              <span className="text-[10px] text-muted uppercase tracking-widest">
                {supabaseEnabled ? "Live" : "Demo"}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Company pill — single-tap to company settings.
          (Multi-company switching isn't built; until it is, surfacing
          an affordance that opens a "switcher" the user can't use would
          be the UI overtaking the truth of what the System can do.) */}
      <div className="px-4 py-3 border-b border-default">
        <LearningHint
          as="block"
          category="Chrome · Company"
          title="Company pill + cycle phase badge"
          whatItIs="The 'COMPANY · ELOSTATE · M1 · Day N' pill at the top of the sidebar. The company name + a §3.4 cycle phase badge that shows where in the 60-day proof window your tenant is — Month 1 (control: AI guidance silent), Month 2 (single-variable intervention: guidance on), or beyond (ongoing/compounding). Tap to land on Settings."
          why="The cycle phase is constitutional: §3.4 reserves Month 1 as a control window so the §4 readout has a clean A/B between Coach-on and Coach-off cohorts. Putting the phase badge on the always-visible sidebar means admins never lose track of whether their team is currently producing baseline data or intervention data — which matters when interpreting any metric."
          how="Glance at this every time you read another metric. 'Coach observations · 7d' means something different in M1 vs M2. The badge is your orientation. Tap the pill to land on Settings where you can configure provider + Coach + Avatar."
          principle="The cycle phase changes the meaning of every other metric. Surfacing it always-visible is the structural defense against misreading data."
        >
        <Link
          href="/dashboard/settings"
          aria-label="Edit company profile"
          title="Edit company profile"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-raised transition-colors group"
        >
          <div className="text-left min-w-0 flex-1">
            <p className="text-xs text-muted uppercase tracking-widest mb-0.5">Company</p>
            <p className="text-sm font-medium text-primary truncate">{companyName}</p>
            {/* §3.4 cycle phase badge — always-visible orientation
                for the admin so they know where in the 60-day proof
                window their company is. Uses the same tone vocabulary
                as the Settings panel: arc-cyan during control,
                emerald after. Skipped-control stays flagged forever
                per the §3.1 append-only contract. */}
            {cyclePhase && (
              <p
                title={
                  cyclePhase.phase === "control"
                    ? `Month 1 control · Coach unlocks in ${cyclePhase.daysRemainingInPhase} day${cyclePhase.daysRemainingInPhase === 1 ? "" : "s"}`
                    : cyclePhase.phase === "intervention"
                      ? `Month 2 single-variable intervention · ${cyclePhase.daysRemainingInPhase} days until proof checkpoint`
                      : "Past the §3.4 proof checkpoint — compounding window"
                }
                className={`inline-flex items-center gap-1 text-[10px] font-mono mt-0.5 ${
                  cyclePhase.phase === "control"
                    ? "text-arc-300"
                    : "text-emerald-300"
                }`}
              >
                <Hourglass className="w-2.5 h-2.5" aria-hidden />
                {cyclePhase.phase === "control" && `M1 · Day ${cyclePhase.daysIntoCycle}`}
                {cyclePhase.phase === "intervention" && `M2 · Day ${cyclePhase.daysIntoCycle}`}
                {cyclePhase.phase === "ongoing" && `Day ${cyclePhase.daysIntoCycle} · compounding`}
                {cyclePhase.skippedControl && (
                  <span className="text-accent-text">· skipped</span>
                )}
              </p>
            )}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:text-secondary transition-colors" />
        </Link>
        </LearningHint>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest">
          Production
        </p>
        {productionNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <LearningHint
              key={item.href}
              as="block"
              category="Module"
              title={item.label}
              whatItIs={item.hint.whatItIs}
              why={item.hint.why}
              how={item.hint.how}
              principle={item.hint.principle}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-ember-400/15 text-brand border border-ember-400/30"
                    : "text-secondary hover:text-primary hover:bg-surface-raised"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    isActive ? "text-brand" : "text-muted"
                  )}
                />
                {item.label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ember-400" />
                )}
              </Link>
            </LearningHint>
          );
        })}

        {/* Testing — visible to all signed-in users. Admins also see
            the Feedback inbox below. */}
        <div className="pt-4">
          <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest">
            Testing
          </p>
          {testingNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const showUnreadDot =
              item.href === "/dashboard/notifications" && unread;
            return (
              <LearningHint
                key={item.href}
                as="block"
                category="Module · Testing"
                title={item.label}
                whatItIs={item.hint.whatItIs}
                why={item.hint.why}
                how={item.hint.how}
                principle={item.hint.principle}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-ember-400/15 text-brand border border-ember-400/30"
                      : "text-secondary hover:text-primary hover:bg-surface-raised"
                  )}
                >
                  <span className="relative flex-shrink-0">
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isActive ? "text-brand" : "text-muted"
                      )}
                    />
                    {showUnreadDot && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ember-400 ring-2 ring-base"
                        aria-label="Unread notifications"
                      />
                    )}
                  </span>
                  {item.label}
                </Link>
              </LearningHint>
            );
          })}
          {/* "Send feedback" — replaces the floating bottom-right
              FeedbackButton on dashboard routes. Opens the same
              FeedbackPanel slide-out, sits with the rest of the
              Testing entries so it's no longer floating over page
              content. Public pages (landing / login) still see the
              floating button since they have no sidebar. */}
          <LearningHint
            as="block"
            category="Module · Testing"
            title="Send feedback"
            whatItIs="Opens the feedback slide-out from inside the sidebar — the entry point for filing a feedback report against any surface in the System. Picks up the current dashboard route + your visible state as auto-attached context so the admin triaging your report sees exactly what you were doing."
            why="Feedback channels die when filing has friction. Per §A8, Feedback IS the user talking to the System — so the affordance belongs WITH the navigation, not floating somewhere generic. Putting it in the sidebar makes it a one-click action from any dashboard page, with no context shift."
            how="Click to open. Pick the kind (bug / friction / idea / question / praise / smoke test result). Write your report. Add a screenshot if useful. Submit. Watch it move through triage at /dashboard/feedback (My feedback)."
            principle="The friction you don't add up front is the friction the team would have paid every time. The sidebar slot is structural anti-friction."
          >
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                "text-secondary hover:text-primary hover:bg-surface-raised"
              )}
            >
              <MessageSquarePlus
                className="w-4 h-4 flex-shrink-0 text-muted"
                aria-hidden
              />
              Send feedback
            </button>
          </LearningHint>
          {isAdminRole(userRole) &&
            adminNav
              .filter((item) => !item.vendorOnly || isVendorCompany)
              .map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <LearningHint
                  key={item.href}
                  as="block"
                  category="Module · Admin"
                  title={item.label}
                  whatItIs={item.hint.whatItIs}
                  why={item.hint.why}
                  how={item.hint.how}
                  principle={item.hint.principle}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-ember-400/15 text-brand border border-ember-400/30"
                        : "text-secondary hover:text-primary hover:bg-surface-raised"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isActive ? "text-brand" : "text-muted"
                      )}
                    />
                    {item.label}
                  </Link>
                </LearningHint>
              );
            })}
        </div>

        <div className="pt-4">
          <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest flex items-center gap-1.5">
            <Beaker className="w-3 h-3 text-violet-400" />
            Design preview
          </p>
          {designPreviewNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <LearningHint
                key={item.href}
                as="block"
                category="Module · Design preview"
                title={item.label}
                whatItIs={item.hint.whatItIs}
                why={item.hint.why}
                how={item.hint.how}
                principle={item.hint.principle}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-violet-500/10 text-violet-300 border border-violet-500/30"
                      : "text-muted hover:text-secondary hover:bg-surface-raised"
                  )}
                >
                  <Icon className="w-4 h-4 text-muted" />
                  {item.label}
                </Link>
              </LearningHint>
            );
          })}
        </div>

        <div className="pt-4">
          <p className="px-3 mb-2 text-[10px] text-muted uppercase tracking-widest">
            System
          </p>
          <LearningHint
            as="block"
            category="Module · System"
            title="Settings"
            whatItIs="The system configuration surface — company profile, AI provider (DeepSeek primary, Anthropic alternate), Coach company-wide toggle, Learning Mode preference, Avatar customization, Password rotation. Every change writes a chain event so the audit trail is intact."
            why="Settings are usually a junk drawer. ELOSTATE's intent is to make them a deliberate surface — the LLM provider you've chosen is part of the §3.4 control story; the Coach toggle affects every chat surface; Learning Mode (the FAB you're hovering right now) is opt-in here. Every choice on this page shapes how the System behaves for the team."
            how="Read top to bottom on first visit. Configure the LLM provider before doing anything else. Set Coach on/off at the company level — your topic-level toggles inherit from it. Toggle Learning Mode here if you want hint popovers across the dashboard. Change your password anytime."
            principle="Settings is governance, not chrome. Every choice here propagates."
          >
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary hover:text-primary hover:bg-surface-raised transition-all duration-150"
          >
            <Settings className="w-4 h-4 text-muted" />
            Settings
          </Link>
          </LearningHint>
        </div>
      </nav>

      {/* Theme switcher — placed above the constitution badge so it's
          always reachable without scrolling. Compact variant keeps the
          sidebar density consistent. */}
      <LearningHint
        as="block"
        category="Chrome · Theme"
        title="Theme switcher"
        whatItIs="Three-state theme switcher: System (follows OS preference), Light, Dark. Persisted to localStorage per device; doesn't affect other users on your team."
        why="Reading comfort matters across long work sessions. The default System mode follows what the OS already learned about the user (light during day, dark at night on most setups). Explicit Light or Dark overrides system preference. Note: Learning Mode (the lightbulb FAB) ONLY activates against dark surfaces because the brand metaphor is a lightbulb in darkness — switch here to dark to use Learning Mode."
        how="Click the three icons to cycle: monitor = system, sun = light, moon = dark. Your choice persists across page navigation and across browser sessions on this device."
        principle="Reading mode is personal preference; the System defers to the user's choice + OS context. No team-wide enforcement."
      >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[10px] text-muted uppercase tracking-widest">
          Theme
        </span>
        <ThemeToggle />
      </div>
      </LearningHint>

      {/* Constitution version badge */}
      <div className="px-4 pt-1 pb-1 border-t border-default">
        <Link
          href="/dashboard/settings"
          className="block pt-2 text-[10px] text-muted hover:text-muted transition-colors font-mono"
          title={`Last amendment: ${CONSTITUTION.lastAmendmentId} (${CONSTITUTION.lastAmendmentDate})`}
        >
          Constitution v{CONSTITUTION.version} · {CONSTITUTION.amendmentCount} amendments
        </Link>
      </div>

      {/* User footer */}
      <div className="px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-default">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-primary truncate">
              {userName || "Loading…"}
            </p>
            <p className="text-xs text-muted truncate">{userRole || "Executive Access"}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
          >
            <LogOut aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Close button — only shown on mobile when the drawer is open. */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="md:hidden absolute top-3 right-3 p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-raised"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      )}
    </aside>
    {feedbackOpen && <FeedbackPanel onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
