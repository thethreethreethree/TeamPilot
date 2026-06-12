#!/usr/bin/env node
//
// Update the active smoke_test_versions row with a comprehensive
// item list covering every live feature partners (Moses, Michael)
// and John can verify. Preserves the version UUID so historical
// results stay linked.
//
// Assignee field per the user's John/Partners split:
//   - "john"     : touches Supabase / Vercel / chain inspection /
//                  LLM config — needs backend access. Partners see a
//                  red banner explaining John handles personally.
//   - "partners" : UI / functional / observable behavior. Partners
//                  walk these end-to-end.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const VERSION_ID = "2217a2e4-40d6-43fe-b3b7-02db98dbeff4";
const COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const items = [
  // ─── Auth ──────────────────────────────────────────────────────
  {
    id: "auth-login",
    title: "Sign in with valid credentials",
    instructions: "Open /login (incognito). Enter your email + password. Click 'Enter Command Center'.",
    expected: "Redirected to /dashboard within 2s. Sidebar shows your name + role.",
    assignee: "partners",
  },
  {
    id: "auth-login-disabled",
    title: "Login button stays disabled through redirect",
    instructions: "On /login, enter creds and click 'Enter Command Center'. Watch the button.",
    expected: "Button flips to 'Signing you in…' with spinner, stays disabled until the page navigates. No way to double-click and create a false-failure perception.",
    assignee: "partners",
  },
  {
    id: "auth-login-error",
    title: "Wrong password shows clear retry path",
    instructions: "On /login, enter your email with a wrong password. Click submit.",
    expected: "Red error message appears below the form. Button re-enables for retry. Inputs become editable again.",
    assignee: "partners",
  },

  // ─── Sidebar / Navigation ───────────────────────────────────────
  {
    id: "nav-sidebar-sections",
    title: "Sidebar shows all four sections",
    instructions: "Sign in. Scroll the sidebar.",
    expected: "Four section headers visible: PRODUCTION (Command Center, Team Chat, Tasks, Team, Living Diagnosis, Problems, Resolutions, Company Brain, Decision Dialogue) · TESTING (Smoke test, My feedback, Feedback inbox if admin) · DESIGN PREVIEW (Finance, Marketing) · SYSTEM (Settings).",
    assignee: "partners",
  },
  {
    id: "nav-active-highlight",
    title: "Current page is highlighted in sidebar",
    instructions: "Navigate to Team Chat. Then to Tasks. Then to Settings.",
    expected: "The active item in the sidebar has a red dot + brand-red text + faint background tint. Inactive items are muted.",
    assignee: "partners",
  },
  {
    id: "nav-admin-gate",
    title: "Feedback inbox link admin-only",
    instructions: "(JOHN) Check the sidebar for a tester account (non-admin role) vs an admin account.",
    expected: "Non-admin sees Smoke test + My feedback only. Admin/CEO/COO additionally sees Feedback inbox.",
    assignee: "john",
  },

  // ─── Branding (ELOSTATE) ────────────────────────────────────────
  {
    id: "brand-elostate-everywhere",
    title: "ELOSTATE name on every public-facing surface",
    instructions: "Visit / (landing), /login, /pitch, /dashboard. Read titles, hero copy, footers.",
    expected: "Every surface reads ELOSTATE. Zero ExecOS mentions visible anywhere.",
    assignee: "partners",
  },
  {
    id: "brand-company-pill",
    title: "Sidebar Company pill reads ELOSTATE",
    instructions: "Look at the sidebar Company section.",
    expected: "Reads 'COMPANY: ELOSTATE' (not 'ExecOS Demo' or the old name).",
    assignee: "partners",
  },
  {
    id: "brand-invite-email-subject",
    title: "Mailto invite subject mentions ELOSTATE",
    instructions: "Go to /dashboard/team. Click Invite member. Enter a fake email, choose Member, Create invitation. On success, click Send by email.",
    expected: "Default mail client opens with subject 'Join ELOSTATE on ELOSTATE' and body containing the invite URL.",
    assignee: "partners",
  },

  // ─── IP protection ──────────────────────────────────────────────
  {
    id: "ip-no-claude-md-visible",
    title: "CLAUDE.md filename never appears in the UI",
    instructions: "Browse the app: Living Diagnosis, Decision Dialogue, Awaiting Evidence panels, sidebar bottom badge.",
    expected: "Never see the string 'CLAUDE.md' on any user-facing surface. Section refs like §3.2 are fine — only the filename is off-limits.",
    assignee: "partners",
  },
  {
    id: "ip-constitution-badge",
    title: "Constitution badge bottom of sidebar",
    instructions: "Scroll to the bottom of the sidebar.",
    expected: "Reads 'Constitution v1.4 · 4 amendments' in muted font. Clickable, links to /dashboard/settings.",
    assignee: "partners",
  },

  // ─── Theme ──────────────────────────────────────────────────────
  {
    id: "theme-light",
    title: "Light mode renders cleanly",
    instructions: "Click the sun icon in the sidebar theme switcher.",
    expected: "All surfaces flip to cream/white. No dark patches, no ghost dark text on light surfaces, no flash on page navigation. Sidebar, top bar, cards, modals all flip cleanly.",
    assignee: "partners",
  },
  {
    id: "theme-dark",
    title: "Dark mode renders cleanly",
    instructions: "Click the moon icon.",
    expected: "All surfaces flip to navy. No white patches, no white-on-white text. Sidebar, top bar, cards, modals all flip cleanly.",
    assignee: "partners",
  },
  {
    id: "theme-brand-readable",
    title: "Brand-red buttons have readable white text on both modes",
    instructions: "On any brand-red button (New topic, Create invitation, Send, Submit) toggle theme between light and dark.",
    expected: "Text on red buttons is always clearly white, never black or low-contrast.",
    assignee: "partners",
  },

  // ─── Team Chat ──────────────────────────────────────────────────
  {
    id: "chat-create-topic",
    title: "Create a new topic",
    instructions: "On /dashboard/chats click New topic. Title 'Smoke test topic'. Description 'Throwaway for verification'. Tag 'smoke'. Create.",
    expected: "Topic appears at the top of the list with OPEN badge. Clicking it opens the conversation view.",
    assignee: "partners",
  },
  {
    id: "chat-post-message",
    title: "Post a message",
    instructions: "Open any topic. Type 'hello from smoke test' in the composer. Press Enter.",
    expected: "Message appears in the thread immediately. Message count on topic card increments. Refresh — message is still there.",
    assignee: "partners",
  },
  {
    id: "chat-pin-survives-refresh",
    title: "Pin survives hard refresh",
    instructions: "On a message, click the pin icon. Confirm it shows pinned. Hard refresh (Ctrl/Cmd+Shift+R).",
    expected: "Message still shows pinned indicator after refresh. (Earlier bug fixed in commit 8d8b9c — pin used to disappear on refresh.)",
    assignee: "partners",
  },
  {
    id: "chat-unpin-clean",
    title: "Unpin clears state cleanly",
    instructions: "Pin a message, then click pin icon again to unpin. Refresh.",
    expected: "Message no longer shows pinned. No ghost rows in DB (no flicker, no half-state).",
    assignee: "partners",
  },
  {
    id: "chat-add-member",
    title: "Add existing member to topic",
    instructions: "On a topic header, click 'Add member'. Pick a teammate not yet in the topic. Click Add.",
    expected: "Participant count increases by 1. Dialog closes. The added person now shows in the participants list.",
    assignee: "partners",
  },
  {
    id: "chat-summarize",
    title: "Summarize streams an AI summary",
    instructions: "On a topic with ≥2 messages, click Summarize. Pick a mode.",
    expected: "Modal opens. AI summary streams token-by-token. Option to post summary as a system message in the thread.",
    assignee: "partners",
  },
  {
    id: "chat-guide-response",
    title: "Guide my response works",
    instructions: "Draft a message in the composer. Click 'Guide my response'.",
    expected: "Modal opens. AI offers refinement options. Selecting one updates the draft.",
    assignee: "partners",
  },
  {
    id: "chat-formulate",
    title: "Help me formulate walks 3 prompts",
    instructions: "Click 'Help me formulate'. Answer the 3 prompts. Click Compose draft.",
    expected: "Modal streams a drafted message based on the 3 answers. Option to drop it into composer.",
    assignee: "partners",
  },
  {
    id: "chat-close-topic",
    title: "Close topic with summary",
    instructions: "As topic admin, click Close topic. Enter a summary ≥20 chars. Confirm.",
    expected: "Topic shows CLOSED badge. Summary visible in the topic card. Review Outcome modal opens automatically.",
    assignee: "partners",
  },
  {
    id: "chat-review-durability",
    title: "Review durability — Resolution held",
    instructions: "On Review Outcome modal pick 'Resolution held'. Submit.",
    expected: "Topic card now shows green 'Resolution held' indicator. resolution_held signal fires into the chain.",
    assignee: "partners",
  },

  // ─── Conversational Coach v1 (NEW) ──────────────────────────────
  {
    id: "coach-default-off",
    title: "New topics default Coach OFF",
    instructions: "Create a new topic. Look at the topic header.",
    expected: "'Coach: off' pill visible (admin-only, otherwise pill missing). Default OFF per asset A3 so the §4 readout has a clean A/B.",
    assignee: "partners",
  },
  {
    id: "coach-toggle",
    title: "Admin can flip Coach on/off",
    instructions: "On a topic you admin, click 'Coach: off' pill.",
    expected: "Pill flips to 'Coach: on' (brand-red tint). Toast confirms. Click again to flip off — toast confirms.",
    assignee: "partners",
  },
  {
    id: "coach-evaluation-fires",
    title: "Coach: NVC evaluation heuristic fires",
    instructions: "On a Coach-on topic, type 'you always miss the standup' in composer (do not send).",
    expected: "Red-bordered chip appears above textarea: 'Reads as evaluation, not observation' · source 'Nonviolent Communication — Rosenberg'. Expand to see principle + suggestion.",
    assignee: "partners",
  },
  {
    id: "coach-assertion-fires",
    title: "Coach: Voss bare-assertion heuristic fires",
    instructions: "Clear composer. Type 'We should just revert everything'.",
    expected: "Chip: 'Assertion before label' · source 'Never Split the Difference — Voss'.",
    assignee: "partners",
  },
  {
    id: "coach-identity-fires",
    title: "Coach: Stone-Heen identity-collision heuristic fires",
    instructions: "Clear composer. Type 'they are incompetent'.",
    expected: "Chip: 'Identity, not behavior' · source 'Difficult Conversations — Stone, Patton, Heen'.",
    assignee: "partners",
  },
  {
    id: "coach-priority-identity-wins",
    title: "Coach: identity beats evaluation when both present",
    instructions: "Clear composer. Type \"you're clueless and you always do this\".",
    expected: "Only ONE chip visible — the identity chip (highest priority). The evaluation hit still emits a chain event but isn't surfaced to the user.",
    assignee: "partners",
  },
  {
    id: "coach-refine-focuses-textarea",
    title: "Coach: Refine button focuses textarea",
    instructions: "When a chip is open, click 'Refine and revise'.",
    expected: "Chip clears. Textarea regains focus so you can edit immediately.",
    assignee: "partners",
  },
  {
    id: "coach-events-on-chain",
    title: "Coach events land on §3.1 chain",
    instructions: "(JOHN) After several coach interactions, open Supabase events table. Filter by subject ~ 'chat_topic:%'.",
    expected: "Rows with kind in (coach.suggestion_offered, coach.suggestion_accepted, coach.suggestion_dismissed, coach.enabled, coach.disabled). Payload contains heuristic_id and trigger_excerpt.",
    assignee: "john",
  },

  // ─── Mentions ───────────────────────────────────────────────────
  {
    id: "mention-dropdown",
    title: "Typing @ opens teammate dropdown",
    instructions: "On /dashboard/smoke-test or /dashboard/feedback, in any notes/body textarea, type @Mos.",
    expected: "Dropdown appears below cursor with Moses Maniquiz at the top. ArrowDown navigates, Enter or Tab selects.",
    assignee: "partners",
  },
  {
    id: "mention-render-as-chip",
    title: "Mentions render as styled chips on display",
    instructions: "Submit a feedback with body containing '@Moses' selected via the dropdown. Open /dashboard/admin/feedback (or My feedback). Expand the row.",
    expected: "Body shows '@Moses Maniquiz' as a brand-red bordered chip, not raw '@[Moses Maniquiz](uuid)' markup.",
    assignee: "partners",
  },
  {
    id: "mention-event-on-chain",
    title: "mention.created event lands on the chain",
    instructions: "(JOHN) After submitting feedback with a mention, check events table for kind = mention.created.",
    expected: "Row with subject 'feedback:<id>' and payload.target_user_id matching Moses's uuid.",
    assignee: "john",
  },

  // ─── Feedback system ───────────────────────────────────────────
  {
    id: "feedback-button-everywhere",
    title: "Floating Feedback button on every page",
    instructions: "Visit /, /login, /pitch, /dashboard, /dashboard/chats, /dashboard/smoke-test.",
    expected: "Brand-red Feedback pill visible bottom-right on every page.",
    assignee: "partners",
  },
  {
    id: "feedback-public-login-prompt",
    title: "Public-page Feedback button prompts login",
    instructions: "Sign out. On / click the Feedback button.",
    expected: "Redirects to /login?from=%2F&intent=feedback. After signing in you land back on / with the panel ready to open.",
    assignee: "partners",
  },
  {
    id: "feedback-kind-picker",
    title: "Kind picker shows 5 options with hints",
    instructions: "Open feedback panel. Look at Kind section.",
    expected: "Five options — Bug · Friction · Idea · Question · Praise — each with a one-line hint underneath.",
    assignee: "partners",
  },
  {
    id: "feedback-screenshot-silent",
    title: "Screenshot capture is silent (no permission prompt)",
    instructions: "Open feedback panel. Click 'Capture screenshot'.",
    expected: "No Chrome 'choose what to share' picker appears. Preview just shows up after a beat.",
    assignee: "partners",
  },
  {
    id: "feedback-screenshot-sharp",
    title: "Captured screenshot text is sharp",
    instructions: "Capture a screenshot on a text-heavy page (e.g. smoke test page itself).",
    expected: "Text in the captured preview reads sharp at full size — no compression halos, no mush.",
    assignee: "partners",
  },
  {
    id: "feedback-paste-clipboard",
    title: "Ctrl/Cmd+V pastes clipboard image",
    instructions: "Take a screenshot with Snipping Tool (Win) or Cmd+Shift+4 (Mac). Open feedback panel. Press Ctrl+V or Cmd+V.",
    expected: "Image lands in the screenshot slot. Toast confirms 'Screenshot pasted'. Can annotate it.",
    assignee: "partners",
  },
  {
    id: "feedback-submit-emits-event",
    title: "Submit creates row + feedback.submitted event",
    instructions: "(JOHN) Submit a feedback. Check Supabase events table for kind = feedback.submitted.",
    expected: "Event row with subject 'feedback:<id>', actor = submitter's uuid.",
    assignee: "john",
  },
  {
    id: "myfeedback-journey-timeline",
    title: "My feedback shows journey timeline",
    instructions: "Submit a feedback. Have an admin transition it to 'triaged'. Refresh /dashboard/feedback.",
    expected: "Your report's expanded view shows Journey: Filed → Triaged with timestamps. Resolution note (if any) shows in green admin-note block.",
    assignee: "partners",
  },

  // ─── Annotation editor ─────────────────────────────────────────
  {
    id: "annotate-all-five-tools",
    title: "All five annotation tools work",
    instructions: "Open feedback panel, capture screenshot, click preview to open editor. Try each tool: Arrow (drag), Text (click + type), Highlight (drag), Box (drag), Circle (drag).",
    expected: "Each tool produces its expected mark. Arrow has red line + arrowhead. Text drops red label with white text. Highlight is translucent yellow. Box is red rectangle outline. Circle is red ellipse outline.",
    assignee: "partners",
  },
  {
    id: "annotate-undo-shortcut",
    title: "Ctrl/Cmd+Z undoes last mark",
    instructions: "In editor, drop 3 marks of different types. Press Ctrl+Z (Win) or Cmd+Z (Mac).",
    expected: "Last mark disappears. Press again — second-to-last disappears. Works on both platforms.",
    assignee: "partners",
  },
  {
    id: "annotate-done-bakes",
    title: "Done bakes marks into image at high resolution",
    instructions: "Drop a few marks, click Done.",
    expected: "Editor closes. Preview in panel shows marks baked into the image. Text remains sharp (not re-softened by the bake).",
    assignee: "partners",
  },

  // ─── Smoke test itself ──────────────────────────────────────────
  {
    id: "smoke-pass-submits",
    title: "Submit pass result for any item",
    instructions: "Click Pass on a partner-assigned item.",
    expected: "Item flips to green 'PASSED' badge. smoke_test.pass event fires (visible to John in events table).",
    assignee: "partners",
  },
  {
    id: "smoke-fail-requires-notes",
    title: "Fail requires ≥5 char notes",
    instructions: "Click Fail with empty notes.",
    expected: "Warning toast: 'Notes required · ≥5 chars so the chain captures real substance.' Submission blocked.",
    assignee: "partners",
  },
  {
    id: "smoke-john-banner",
    title: "John-assigned items show backend banner to partners",
    instructions: "Find a JOHN item (this one is one of them; or check the Coach events / mention events backend items).",
    expected: "Red-bordered banner above the steps: 'Backend test — John handles this. Partners don't have Supabase / Vercel access…'",
    assignee: "partners",
  },
  {
    id: "smoke-partners-pill",
    title: "Partner items show PARTNERS pill",
    instructions: "Look at any partner-assigned item.",
    expected: "Arc-cyan 'PARTNERS' pill (with users icon) next to the test number, indicating who owns it.",
    assignee: "partners",
  },

  // ─── Team management ───────────────────────────────────────────
  {
    id: "team-invite-new-member",
    title: "Invite a brand-new member generates code + URL",
    instructions: "On /dashboard/team click Invite member. Enter an email NOT in your company. Role Member. Create invitation.",
    expected: "Success state surfaces: Send by email + Copy link buttons + the full invite URL in a font-mono input.",
    assignee: "partners",
  },
  {
    id: "team-invite-existing-rejected",
    title: "Cannot re-invite existing member (409)",
    instructions: "Try to invite mosesmaniquiz@gmail.com (already a member).",
    expected: "Submission fails with a clear error message: 'Moses Maniquiz is already a member of this company.'",
    assignee: "partners",
  },
  {
    id: "team-copy-link-works",
    title: "Copy link copies invite URL to clipboard",
    instructions: "After invite created, click Copy link. Paste somewhere.",
    expected: "Pasted URL matches the invite URL shown in the dialog.",
    assignee: "partners",
  },
  {
    id: "team-revoke-pending",
    title: "Revoke pending invitation",
    instructions: "On /dashboard/team, find a pending invite. Click the ShieldOff icon. Confirm reason.",
    expected: "Invitation disappears from pending list. The code can no longer be used at /invite/<code>.",
    assignee: "partners",
  },

  // ─── Decisions / Diagnosis / Problems / Resolutions ────────────
  {
    id: "decision-dialogue-four-phase",
    title: "Decision Dialogue 4 phases work in order",
    instructions: "Visit /dashboard/decisions. Open a new dialogue. Walk Situation → Your read → System response → Decide.",
    expected: "Each phase requires prior to advance. System response only generates AFTER you state your read (no overtaking).",
    assignee: "partners",
  },

  // ─── In-thread Decision Dialogue (NEW — migration 0022) ─────────
  {
    id: "in-thread-decision-open-button-admin-only",
    title: "'Open as Decision Dialogue' button is admin-only and topic-scoped",
    instructions: "Open a chat topic where you ARE an admin and the topic is open. Then open one where you are NOT an admin.",
    expected: "Admin view: brand-red 'Open as Decision Dialogue' button visible in the topic header, next to Close topic. Non-admin view: button hidden entirely. Closed topics never show the button.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-open-posts-system-message",
    title: "Opening a dialogue posts a system message AND surfaces the card",
    instructions: "Click 'Open as Decision Dialogue' in an open topic. Watch the thread and the composer area.",
    expected: "Toast 'Decision Dialogue opened'. New system-kind message lands at the bottom of the thread (timestamped, marked as system). Brand-red 4-phase card appears anchored above the composer with PHASE 1 active and a Situation textarea.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-situation-required",
    title: "Cannot advance past Situation without text",
    instructions: "With a fresh dialogue open, leave the Situation textarea empty. Look at the Continue button.",
    expected: "Continue button is disabled (40% opacity). Once you type something, it enables. Click → phase advances to 'Your read' and a system message records the phase change.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-elicit-requires-both",
    title: "'Your read' requires diagnosis AND proposal before System will respond",
    instructions: "Advance to Phase 2. Fill diagnosis only — leave proposal blank. Check 'Ask the System' button.",
    expected: "Button is disabled until BOTH fields contain text. The structural §3.3 interrupt is enforced — the System won't respond to a half-stated read.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-system-responds",
    title: "Ask the System generates the 4-block response in-card",
    instructions: "With diagnosis + proposal filled, click 'Ask the System'. Wait a few seconds.",
    expected: "Button shows 'Asking the System…' with pulsing icon. Phase 3 'System response' card expands below with four blocks: emerald 'Engages your diagnosis' · blue 'Adds perspective' · brand-red 'Suggestion / Why' · violet 'Compared to your proposal'. Decide button surfaces.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-decide-records",
    title: "Decide records all 4 path choices including Hybrid note",
    instructions: "Click Decide. Try selecting each: 'Go with my proposal', 'Go with System's suggestion', 'Hybrid', 'Defer'. For Hybrid, type a note. Click 'Record decision'.",
    expected: "Each selection highlights brand-red. Hybrid requires its note before Record activates. Defer auto-clears the note field. On Record: toast confirms, card folds to a one-line decided summary, and the system message 'Decision recorded: …' appears in the thread.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-folded-and-new",
    title: "Decided dialogue folds + 'New dialogue' surfaces for admin",
    instructions: "After finalizing, look at the folded card above the composer.",
    expected: "Single-line green card: '✓ Decision Dialogue closed · {path label}'. If you're admin, a small 'New dialogue' button is visible on the right. Clicking it re-opens phase 1.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-coach-mounts",
    title: "Coach mirror chips fire on Situation/diagnosis/proposal textareas",
    instructions: "With Coach ON (company or per-topic), open a dialogue. In Situation, type 'we always miss the deploy window'. Advance, then in diagnosis type 'they don't get it'.",
    expected: "Mirror chip surfaces above each affected textarea reporting the count + asking a question (e.g. 'Absolute / judgmental phrasing — once in this thread. First occurrence — pattern starting, or fair callback?'). Chip never renders a verdict.",
    assignee: "partners",
  },
  {
    id: "in-thread-decision-chain-events",
    title: "decision.opened / phase_entered / system_responded / decided land on chain",
    instructions: "(JOHN) Walk a full dialogue end-to-end. In Supabase events table, filter subject ~ 'chat_topic:<topic-id>'.",
    expected: "Four event rows for the dialogue: decision.opened (on open), decision.phase_entered (on each advance — at least 2), decision.system_responded (when AI returns), decision.decided (on finalize). Each payload includes decision_id, mode='in_thread', and the relevant context (from_phase/to_phase, chosen_path, persisted_decision_id, etc.).",
    assignee: "john",
  },

  // ─── Notifications Phase 2 (Decision Dialogue events) ──────────
  {
    id: "notif-decision-opened-arrives",
    title: "Opening a Decision Dialogue notifies other topic participants",
    instructions: "As Admin A, open a Decision Dialogue in a topic where User B is also an active participant. Sign in as B and visit /dashboard/notifications.",
    expected: "B sees a new row: '{A's name} opened a Decision Dialogue in {topic title}'. Sidebar bell shows a brand-red unread dot before the inbox is visited; the dot clears once B opens the inbox. Clicking the row deep-links to /dashboard/chats/{topic-id}.",
    assignee: "partners",
  },
  {
    id: "notif-decision-decided-arrives",
    title: "Recording a decision notifies other topic participants",
    instructions: "Continuing the previous flow: Admin A walks the dialogue to Decide and records (e.g. Hybrid with a note). Sign in as B and visit /dashboard/notifications.",
    expected: "B sees a new row: '{A's name} recorded a decision in {topic title}' with the path label (Hybrid / Went with proposal / Defer / etc.) underneath. Deep-link goes to the topic.",
    assignee: "partners",
  },
  {
    id: "notif-decision-not-self",
    title: "You don't get notified for dialogues you opened or decided yourself",
    instructions: "As Admin A, open a dialogue and walk it to Decide. Then visit your OWN /dashboard/notifications.",
    expected: "No decision.opened or decision.decided rows show up attributed to yourself. Only the dialogues someone ELSE in your topics ran appear.",
    assignee: "partners",
  },
  {
    id: "notif-decision-not-outside-topic",
    title: "Dialogues in topics you're not a participant of don't notify you",
    instructions: "(JOHN) Open a Decision Dialogue in a topic User B is NOT a participant of. Sign in as B.",
    expected: "B's notifications inbox does NOT show that dialogue — even though B is in the same company. Active participant scoping is enforced.",
    assignee: "john",
  },
  {
    id: "notif-task-participant-added",
    title: "Being added to a task notifies you (migration 0023)",
    instructions: "As Admin A, open a task on /dashboard/operations/{taskId} and add User B as a participant. Sign in as B and visit /dashboard/notifications.",
    expected: "B sees a new row: '{A's name} added you to a task: {task title}'. Sidebar bell shows an unread dot first. Deep-link goes to /dashboard/operations/{taskId}.",
    assignee: "partners",
  },
  {
    id: "notif-task-participant-self-add-suppressed",
    title: "Self-add to a task does NOT create a notification for yourself",
    instructions: "Create a new task. The creator becomes the owner participant automatically. Visit /dashboard/notifications.",
    expected: "No 'you added yourself to a task' row appears. The trigger-level self-skip prevents firing the event when actor == added_user.",
    assignee: "partners",
  },

  // ─── Pillar 2 admin team-check digest (NEW) ────────────────────
  {
    id: "team-check-admin-only-sidebar",
    title: "Team check entry shows only for admins in the sidebar",
    instructions: "Sign in as admin (CEO / COO / admin). Open the sidebar. Then sign in as a non-admin member.",
    expected: "Admin sidebar shows 'Team check' (Heart icon) under Testing, between Feedback inbox and Coach readout. Non-admin sidebar does NOT show it.",
    assignee: "partners",
  },
  {
    id: "team-check-constitutional-banner",
    title: "Team check page leads with the A7/A11 framing banner",
    instructions: "Visit /dashboard/admin/team-check as an admin.",
    expected: "Top of the page shows an ember-tinted banner: 'This is a doorway, not a dashboard. Every row pairs a count with one constructive next step…' Sets the discipline before any row is shown.",
    assignee: "partners",
  },
  {
    id: "team-check-empty-state",
    title: "Empty state when no rows are stale",
    instructions: "On a freshly seeded org where every active participant has touched their open tasks within the last 4 days, visit /dashboard/admin/team-check.",
    expected: "Single emerald checkmark card: 'No rows in the digest right now.' Explanation references the 4-day staleness threshold + 'either the team is moving, or no tasks are old enough to flag yet.'",
    assignee: "partners",
  },
  {
    id: "team-check-row-shape",
    title: "Each row pairs a count with a constructive next step",
    instructions: "Trigger at least one stale row: create a task, add a teammate as participant, wait 4+ days (or use existing data with stale participation). Visit /dashboard/admin/team-check.",
    expected: "Each row shows: teammate name + role + (Blocked pill if applicable), task title (deep-link), 'N days since last meaningful action' OR 'Joined N days ago · no meaningful action yet', then an ember-tinted 'Suggested next step' block with A7-framed text (e.g. 'Ask {Name} where the task should start…').",
    assignee: "partners",
  },
  {
    id: "team-check-no-warning-voice",
    title: "No row reads as a warning or as a verdict on the teammate",
    instructions: "Read every row carefully. Look for words like 'failing,' 'behind,' 'late,' 'overdue,' 'lazy,' 'incompetent,' or any phrasing that judges the teammate.",
    expected: "Zero verdict language. Suggested-next-step copy is always doorway-shaped ('Worth a check-in…', 'Pair with…', 'Ask where the task should start') — never a judgment.",
    assignee: "partners",
  },
  {
    id: "team-check-nudge-modal",
    title: "Send check-in opens an editable modal pre-filled with the suggested text",
    instructions: "Click 'Send check-in' on any row.",
    expected: "Modal opens with: header showing teammate name + task, explanation of where the message will land (task thread, §3.1 chain, §4 readout will measure outcome), textarea pre-filled with the suggested-next-step copy editable, 'Cancel' + 'Send check-in' buttons.",
    assignee: "partners",
  },
  {
    id: "team-check-nudge-min-length",
    title: "Cancellation: <12 char messages refused",
    instructions: "On the modal, clear the textarea or shorten to <12 chars. Try to send.",
    expected: "Send button disabled (40% opacity). If somehow submitted, server returns 400 with 'Check-in message needs at least 12 characters.'",
    assignee: "partners",
  },
  {
    id: "team-check-nudge-lands-in-task-thread",
    title: "Sent nudge lands as a system message in the task thread",
    instructions: "Edit the suggested text, click 'Send check-in.' After the toast, navigate to /dashboard/operations/{taskId} for that task.",
    expected: "Toast: 'Check-in posted · It landed in the task thread.' The task thread now shows a new nudge-kind message at the bottom with the admin as author and the text you sent. Visible to all task participants.",
    assignee: "partners",
  },
  {
    id: "team-check-nudge-fires-chain-event",
    title: "task.nudge_sent event lands on the §3.1 chain",
    instructions: "(JOHN) After sending a nudge, query Supabase events table for kind = 'task.nudge_sent' subject like 'task:%'.",
    expected: "Event row exists with the new nudge's task_id in the subject, actor = admin who sent it, payload.message_kind = 'nudge', payload contains task_message_id linking to the inserted row. Emitted by the 0021 trigger automatically.",
    assignee: "john",
  },
  {
    id: "team-check-a10-self-view-still-works",
    title: "A10: teammate sees their own engagement on the task page",
    instructions: "Sign in as a teammate who appears in the team-check digest. Open the task that flagged them at /dashboard/operations/{id}.",
    expected: "Task page shows their own 'engagement on this task' line: N meaningful actions + last action timestamp. If their staleness >= 4 days, the constructive nudge surfaces directly on their view too. They see exactly what the admin sees about them — no shadow read.",
    assignee: "partners",
  },

  // ─── Chat UX overhaul (viewport, smart scroll, sticky dates) ───
  {
    id: "chat-viewport-fit",
    title: "Chat page fits the viewport — only the message stream scrolls",
    instructions: "Open any chat topic with many messages (e.g. the migrated Development LAB).",
    expected: "Composer is anchored at the bottom of the viewport without page scrolling. Topic header bar at top stays visible. ONLY the message-stream area scrolls; the page itself does not require scrolling to reveal the composer.",
    assignee: "partners",
  },
  {
    id: "chat-auto-scroll-on-open",
    title: "Opening a topic auto-scrolls to the latest message",
    instructions: "Open the Development LAB topic (210 messages).",
    expected: "Page lands on the BOTTOM of the message stream — the most recent message is visible above the composer. No manual scroll needed to find the latest.",
    assignee: "partners",
  },
  {
    id: "chat-jump-to-latest-pill",
    title: "Jump-to-latest pill surfaces when scrolled up + new message arrives",
    instructions: "Open a topic and scroll up to read history. Have someone else post a message (or post one yourself in another tab).",
    expected: "While scrolled up, an amber 'Jump to latest' pill with a downward arrow appears centered at the bottom of the message-stream area. Clicking it smooth-scrolls to the latest message and dismisses itself. If you scroll back to the bottom manually, the pill disappears.",
    assignee: "partners",
  },
  {
    id: "chat-smart-scroll-no-yank",
    title: "Reading history is not yanked when a new message arrives",
    instructions: "Scroll up in a topic to read older messages. Trigger a new message to arrive (another tab or another user).",
    expected: "Page does NOT auto-scroll away from your reading position. The Jump-to-latest pill appears; the new message lands at the bottom but the viewport stays where you were reading. (Slack/WhatsApp behavior — the System never interrupts reading.)",
    assignee: "partners",
  },
  {
    id: "chat-sticky-date-dividers",
    title: "Date dividers stick to the top of the viewport while scrolling",
    instructions: "Open the Development LAB topic and scroll slowly through the messages.",
    expected: "As you scroll past a day's worth of messages, the date divider (e.g. 'Apr 25') sticks to the top of the message-stream viewport, then gets pushed up by the next date divider when the next day's first message scrolls into view. (Slack-style date headers.)",
    assignee: "partners",
  },

  // ─── Avatar customization (migration 0024) ─────────────────────
  {
    id: "avatar-default-stable",
    title: "Unconfigured avatars render with stable, distinct defaults",
    instructions: "Open any chat topic. Look at avatars across messages from different authors.",
    expected: "Each author has a distinct background color and initials (e.g. 'MM' for Moses Maniquiz). Reload the page — each author's avatar color stays the same (deterministic per-user). Two adjacent authors do not look near-identical.",
    assignee: "partners",
  },
  {
    id: "avatar-settings-panel-renders",
    title: "Settings → Avatar panel shows initials + palette + preview",
    instructions: "Visit /dashboard/settings. Scroll to the Avatar section (between LLM Connection and Change Password).",
    expected: "Panel shows: header 'Avatar' with sparkle icon, a live 48px preview chip on the right, an Initials text input (default = derived from your name), a palette of 12 brand-aligned swatches, a custom-hex text input, Reset + Save buttons.",
    assignee: "partners",
  },
  {
    id: "avatar-palette-selection",
    title: "Picking a palette color updates the preview + saves to profile",
    instructions: "Click any palette swatch in Settings → Avatar. Click Save. Then open any chat topic where you've posted messages.",
    expected: "Preview chip updates instantly to the chosen color. After save: toast 'Avatar updated'. Your avatar on chat messages now renders with the new color. The chip's text color auto-adjusts (white-on-dark or black-on-light) so initials stay readable.",
    assignee: "partners",
  },
  {
    id: "avatar-custom-initials",
    title: "Custom initials (1–3 chars) override the name-derived default",
    instructions: "In Settings → Avatar, type 'JR' into Initials. Save. Open a chat topic.",
    expected: "Your avatar shows 'JR' instead of the auto-derived value. Validation: typing > 3 chars truncates; saving 0 chars falls back to derived default.",
    assignee: "partners",
  },
  {
    id: "avatar-custom-hex",
    title: "Custom hex color (any valid #RRGGBB) is accepted",
    instructions: "In Settings → Avatar, type '#7C3AED' (purple) into the custom hex field. Save.",
    expected: "Preview turns purple. Save succeeds. If you type an invalid value like 'purple' or '#XYZ', save shows 'Color must be a 6-digit hex like #FACC15.'",
    assignee: "partners",
  },
  {
    id: "avatar-reset-defaults",
    title: "Reset to defaults clears both custom values",
    instructions: "Customize avatar (color + initials), save. Then click 'Reset to defaults' and save again.",
    expected: "Color + initials fields clear. After save, chat avatar reverts to the deterministic brand-derived default for your user.",
    assignee: "partners",
  },
  {
    id: "avatar-rls-cross-user-protection",
    title: "(JOHN) RLS: a user cannot modify another user's avatar",
    instructions: "(JOHN) From a non-service-role context, attempt UPDATE profiles SET avatar_color='#FF0000' WHERE id <> auth.uid().",
    expected: "RLS refuses the cross-user update (0 rows affected). The existing profiles update policy gates updates to the owner's row.",
    assignee: "john",
  },

  // ─── Reply / quote (threaded replies) ──────────────────────────
  {
    id: "reply-hover-button-appears",
    title: "Reply button appears on hover over any non-system message",
    instructions: "Open any chat topic with messages. Move the mouse over a message bubble.",
    expected: "A small Reply icon (curved-arrow) appears in the upper-right of the bubble, next to the pin icon. Visible only on hover (opacity-0 → 100). Visible on every non-system, non-summary message including your own.",
    assignee: "partners",
  },
  {
    id: "reply-pill-surfaces-in-composer",
    title: "Clicking Reply surfaces a 'Replying to X' pill above the composer",
    instructions: "Click Reply on any older message. Look at the composer area.",
    expected: "An ember-tinted pill appears above the textarea showing: 'Replying to {Author}' label + the first ~120 chars of the parent message. A small X on the right cancels the reply. The composer textarea gets focus automatically so the user can type immediately.",
    assignee: "partners",
  },
  {
    id: "reply-cancel-clears-state",
    title: "Cancel button on the reply pill clears the reply state",
    instructions: "With a reply pill active, click the X on the right side of the pill.",
    expected: "The pill disappears. The composer is back in normal mode. Next message you send will NOT be threaded.",
    assignee: "partners",
  },
  {
    id: "reply-sends-with-reply-to-id",
    title: "Sending a reply persists the reply_to_id and renders the quote context",
    instructions: "Click Reply on a message, type 'this is a threaded reply', send.",
    expected: "Your new message appears at the bottom of the stream. ABOVE its body, a quote pill renders showing the original author + a snippet of the original body, with a left-side ember border. The pill is interactive (cursor pointer).",
    assignee: "partners",
  },
  {
    id: "reply-quote-jumps-to-parent",
    title: "Clicking the quote scrolls back to the original message + highlights it",
    instructions: "On a reply message, click the quote pill above the body.",
    expected: "The viewport smooth-scrolls to the parent message (centered). The parent gets a brief amber ring/highlight that fades over ~1.6 seconds so you can find it. If the parent is outside the loaded window, the pill shows 'Outside the loaded window' text and the click is disabled.",
    assignee: "partners",
  },
  {
    id: "reply-survives-refresh",
    title: "Reply relationship survives a hard refresh (data lives in DB)",
    instructions: "After posting a reply, hard refresh (Ctrl+Shift+R).",
    expected: "The reply still shows the quote context above its body. The relationship is durable — stored as chat_messages.reply_to_id on the row, not transient client state.",
    assignee: "partners",
  },
  {
    id: "reply-cancellation-on-failed-post",
    title: "If the post fails, the reply state is restored (not lost)",
    instructions: "Start a reply, type a message, then simulate a network failure (offline mode or kill connection) and click Send.",
    expected: "Toast shows the post error. The reply pill is restored to the composer alongside the draft text so the user can retry without losing context. (This is the failure-path rollback — same shape as the existing draft restoration.)",
    assignee: "partners",
  },

  // ─── Mobile horizontal-overflow guards ─────────────────────────
  {
    id: "mobile-chat-no-horizontal-scroll",
    title: "Mobile chat page does NOT scroll horizontally",
    instructions: "Open the migrated Development LAB topic (210 messages, several long URLs) on a phone OR Chrome DevTools mobile preview at 375px width.",
    expected: "Page does NOT scroll left-right. Composer is visible at the bottom. Messages with long URLs (Tony Robbins course link, Facebook share link) wrap mid-URL rather than overflowing the bubble. The screen never reveals empty white space to the left or right.",
    assignee: "partners",
  },
  {
    id: "mobile-long-url-wraps",
    title: "Long URLs in messages wrap mid-token instead of overflowing",
    instructions: "On mobile width (375px), find a message containing a long unbroken URL (search the WhatsApp migration for 'facebook.com/share' or 'claude101.com').",
    expected: "URL wraps across multiple lines inside the bubble. The bubble itself does not extend beyond its container. No horizontal scroll appears.",
    assignee: "partners",
  },
  {
    id: "mobile-sticky-divider-no-shift",
    title: "Sticky date divider doesn't shift the page on mobile",
    instructions: "Scroll the chat slowly on mobile width — watch the date pill at the top as you scroll past day boundaries.",
    expected: "Sticky date pill stays centered at the top of the message stream, never causes the surrounding messages to shift horizontally. Negative-margin trick (–mx-3 md:–mx-6) respects parent padding at each breakpoint.",
    assignee: "partners",
  },
  {
    id: "mobile-topic-header-wraps-cleanly",
    title: "Topic header chips wrap onto multiple lines instead of overflowing",
    instructions: "On mobile, open a topic with several tags + status. Look at the top header strip.",
    expected: "Status badge + tag chips wrap onto a second/third line as needed without forcing horizontal scroll. Action buttons (people count, Add member, Summarize, Open Decision Dialogue, Close) wrap similarly.",
    assignee: "partners",
  },
  {
    id: "mobile-dashboard-layout-overflow-guard",
    title: "Dashboard layout structurally prevents horizontal scroll",
    instructions: "Visit any dashboard page on mobile (375px). Try to scroll horizontally on Tasks, Notifications, Team check, Settings, Brain.",
    expected: "None of these scroll horizontally. The <main> element has min-w-0 + overflow-x-hidden so any child component that contains a long unbroken token wraps instead of pushing the layout wider than the viewport.",
    assignee: "partners",
  },

  // ─── Chat rich formatting (markdown + composer toolbar) ────────
  {
    id: "chat-composer-toolbar-visible",
    title: "Composer shows a formatting toolbar above the textarea",
    instructions: "Open any chat topic. Look just above the textarea.",
    expected: "Visible toolbar with: Bold (B), Italic (I), Code (</>), Link (chain), divider, Bulleted list, Numbered list, Blockquote. Each is icon-only with a title tooltip showing the keyboard shortcut.",
    assignee: "partners",
  },
  {
    id: "chat-markdown-bold-italic-code",
    title: "Inline markdown renders correctly in posted messages",
    instructions: "In the composer type: 'this is **bold** and *italic* and `inline code`'. Send.",
    expected: "Posted message shows bold weight on 'bold', italic on 'italic', and 'inline code' in a small amber-tinted code chip with monospace font. Underlying asterisks/backticks do NOT show in the rendered message.",
    assignee: "partners",
  },
  {
    id: "chat-markdown-links-clickable",
    title: "Explicit + auto-detected URLs become clickable links",
    instructions: "Post: 'plain url: https://example.com and explicit: [docs](https://example.com/docs)'. Click each.",
    expected: "Both render as amber underlined links. Clicking opens in a new tab (target=_blank, rel=noopener). Auto-link works on bare https:// URLs without explicit markdown.",
    assignee: "partners",
  },
  {
    id: "chat-markdown-lists-blockquote",
    title: "Bulleted, numbered, and blockquote markdown render correctly",
    instructions: "Post a message with: '- item one\\n- item two', then '1. first\\n2. second', then '> a quoted line'. Each on a separate message.",
    expected: "Bulleted list renders with bullets and left padding. Numbered list renders with 1./2. and left padding. Blockquote shows a left ember border + italic muted secondary text.",
    assignee: "partners",
  },
  {
    id: "chat-toolbar-keyboard-shortcuts",
    title: "Markdown keyboard shortcuts work when textarea has focus",
    instructions: "Focus the composer. Select some text. Press Ctrl/Cmd+B, then Ctrl/Cmd+I, then Ctrl/Cmd+E, then Ctrl/Cmd+K (cancel the URL prompt or paste one).",
    expected: "Selection gets wrapped in ** for bold, * for italic, ` for code, and [text](url) for the link prompt result. Selection stays inside the wrapped section so consecutive shortcuts compound (bold + italic = ***triple***).",
    assignee: "partners",
  },
  {
    id: "chat-toolbar-list-shortcuts",
    title: "Ctrl+Shift+8 / 7 / 9 trigger bulleted / numbered / quote list",
    instructions: "Type some text on multiple lines. Select it. Press Ctrl+Shift+8, then Ctrl+Shift+7, then Ctrl+Shift+9 on different multi-line selections.",
    expected: "Ctrl+Shift+8 prefixes each line with '- ', Ctrl+Shift+7 with '1. '/'2. ' etc, Ctrl+Shift+9 with '> '. After Send, the rendered message uses real <ul>/<ol>/<blockquote> styling.",
    assignee: "partners",
  },
  {
    id: "chat-message-chip-amber-bordered",
    title: "Message bubbles use the amber-bordered chip style (mockup match)",
    instructions: "Open any chat topic. Look at any non-system message bubble.",
    expected: "Bubble has a subtle amber-tinted border (border-ember-400/15) on a near-transparent surface. Pinned messages have a slightly stronger amber border (border-ember-400/30) and a faint amber fill. No more solid gray bubbles.",
    assignee: "partners",
  },
  {
    id: "chat-code-block-renders",
    title: "Triple-backtick code block renders as a code block",
    instructions: "Post a message with a fenced code block: '```\\nconst x = 1;\\nconsole.log(x);\\n```'.",
    expected: "Block renders inside an amber-tinted box with monospace font and overflow-x scroll if the code is wider than the bubble. Newlines preserved.",
    assignee: "partners",
  },

  // ─── Coach v3 — LLM pattern detection ──────────────────────────
  {
    id: "coach-v3-blame-projection-trigger",
    title: "Coach v3 catches blame projection that v2 regex missed",
    instructions: "In any Coach-enabled chat topic, type: 'I'm hungry and you guys are making mad' and pause typing for ~2 seconds.",
    expected: "Within ~1.5s the Coach chip surfaces with a 'Locating cause in someone else' label and a question about whether framing it as 'they're making me X' is the read you want to land. v2 regex would have missed this entirely; v3 LLM catches it.",
    assignee: "partners",
  },
  {
    id: "coach-v3-hot-state-trigger",
    title: "Coach v3 catches hot-state signaling",
    instructions: "Type: 'I'm exhausted and I just need this to stop' and pause.",
    expected: "Coach chip surfaces with 'Composing from a hot state' label + question about whether the message would feel right 30 minutes from now. The kindExplanation talks about hunger/exhaustion shifting how we communicate.",
    assignee: "partners",
  },
  {
    id: "coach-v3-aggressive-language",
    title: "Coach v3 surfaces direct aggression toward a person",
    instructions: "Type: 'you're an idiot if you think that works'.",
    expected: "Coach chip surfaces with 'Direct aggression toward a person' label + a question about whether saying the same thing without the attack lands faster. Higher priority than evaluation — surfaces first if multiple patterns match.",
    assignee: "partners",
  },
  {
    id: "coach-v3-expanded-evaluation-vocab",
    title: "Coach v3 catches expanded evaluation vocabulary (regex too)",
    instructions: "Type: 'this is absolute bullshit' OR 'that's ridiculous'.",
    expected: "Coach chip surfaces with 'Absolute / judgmental phrasing' label. Words like 'bullshit', 'ridiculous', 'awful', 'trash', 'bs' now trigger the same way 'stupid' and 'broken' did in v2.",
    assignee: "partners",
  },
  {
    id: "coach-v3-emotional-escalation",
    title: "Coach v3 catches emotional escalation phrasing",
    instructions: "Type: 'this is absolutely unacceptable, I'm livid'.",
    expected: "Coach chip surfaces with 'Heightened emotional language' label + question about whether the intensity matches the response you actually want. kindExplanation notes that intensity scales response intensity.",
    assignee: "partners",
  },
  {
    id: "coach-v3-no-fire-on-short-draft",
    title: "LLM analyze is NOT called for short drafts (<20 chars)",
    instructions: "(JOHN) Type a 10-char message in the chat composer with Coach enabled. Check the Network tab for calls to /api/coach/analyze.",
    expected: "NO request to /api/coach/analyze fires while the draft is below 20 chars. Once you cross the threshold, debounced LLM call fires ~1.2s after typing stops. Confirms cost discipline — the LLM doesn't run on trivial drafts.",
    assignee: "john",
  },
  {
    id: "coach-v3-graceful-fallback",
    title: "Coach falls back to regex-only if LLM is unavailable",
    instructions: "(JOHN) Temporarily block /api/coach/analyze (return 500). Then type a draft that the regex catches (e.g. 'this is stupid').",
    expected: "Coach chip still surfaces (regex caught it). No error toast disrupts the user. The instant regex pass is the lower bound; LLM is enrichment, not requirement.",
    assignee: "john",
  },
  {
    id: "coach-v3-llm-cannot-invent-pattern-ids",
    title: "(JOHN) LLM response is filtered to seven allowed pattern IDs",
    instructions: "(JOHN) Inspect the /api/coach/analyze response. Verify the route filters hits to only the seven allowed pattern_ids before returning to the client.",
    expected: "Even if the LLM returns a hit with pattern_id='this-is-just-wrong' or any non-canonical id, the API filters it out before the client renders. Constitutional defense (A11): the LLM's vocabulary is constrained at the application layer, not just the prompt.",
    assignee: "john",
  },
  {
    id: "coach-v3-debounce-aborts-stale-calls",
    title: "(JOHN) Typing rapidly aborts in-flight stale LLM calls",
    instructions: "(JOHN) Type rapidly for 5 seconds (keep modifying the draft). Watch the Network tab.",
    expected: "Each typing change cancels the previous in-flight analyze request (AbortController). Only the LAST settled draft generates a real network request after debounce settles. No race condition where stale hits surface for stale text.",
    assignee: "john",
  },

  // ─── Coach v3.1 fine-tunes ─────────────────────────────────────
  {
    id: "coach-v3.1-recent-thread-context",
    title: "LLM analyzer receives recent thread context",
    instructions: "(JOHN) Open a chat topic with several recent messages. Type a draft long enough to trigger LLM analysis (>20 chars). Inspect the POST body to /api/coach/analyze in DevTools Network tab.",
    expected: "POST body contains a recentThread field with the last ~5 user-authored messages joined by newlines (names stripped, each capped at 280 chars). The LLM can now distinguish 'first frustrated message in thread' from 'fifth frustrated message in thread' for sharper detection.",
    assignee: "john",
  },
  {
    id: "coach-v3.1-trigger-excerpt-in-closed-chip",
    title: "Trigger excerpt shows prominently in the closed chip",
    instructions: "In a Coach-enabled topic, type 'I'm hungry and you guys are making mad'. Wait for the chip to surface but do NOT expand it.",
    expected: "Closed chip shows: (1) the pattern label, (2) the trigger excerpt in amber-tinted italic monospace like “you guys are making mad”, (3) the mirror-frame question. User can identify the offending words without expanding the chip.",
    assignee: "partners",
  },
  {
    id: "coach-v3.1-loading-pulse",
    title: "Subtle 'Coach reading…' pulse appears during LLM analysis",
    instructions: "Type a 20+ char draft slowly. After your last keystroke, watch the area where the Coach chip would appear.",
    expected: "Within ~1.2s a subtle muted bar appears with a small spinning icon and 'COACH READING…' text. When the LLM returns hits, this is replaced by the real chip. If no hits are returned, the pulse disappears silently.",
    assignee: "partners",
  },
  {
    id: "coach-v3.1-pulse-disappears-on-short-draft",
    title: "Pulse disappears if you shorten the draft below 20 chars",
    instructions: "Type a long draft to trigger the pulse. Then delete characters until the draft is below 20 chars.",
    expected: "Pulse disappears immediately when the draft drops below the LLM minimum length (LLM_MIN_DRAFT_CHARS = 20). The in-flight LLM call is aborted via AbortController. No stale chip surfaces from the cancelled call.",
    assignee: "partners",
  },

  // ─── §3.6 Brain Learning Visible ───────────────────────────────
  {
    id: "brain-learning-visible-section-loads",
    title: "Brain page shows 'What the System has noticed lately' section",
    instructions: "Visit /dashboard/brain.",
    expected: "Top of the page (above the existing brain internals) shows an ember-tinted banner 'What the System has noticed lately' explaining the surface is counts-not-verdicts. Below it: 4 headline stat boxes, then top Coach patterns, then durability + decision-path cards (only if there's data for them).",
    assignee: "partners",
  },
  {
    id: "brain-learning-headline-stats",
    title: "Four headline stat boxes show chain growth + Coach + decision + topic counts",
    instructions: "Read the four stat cards under the Learning Visible banner.",
    expected: "Cards labeled: 'Chain events · 7d' (with %-trend vs prior 7d), 'Coach observations · 7d' (with cumulative all-time), 'Decisions decided · 28d' (with opened context), 'Topics closed · 28d' (with opened context). Each shows a tabular-nums count + a smaller context line below.",
    assignee: "partners",
  },
  {
    id: "brain-learning-top-patterns",
    title: "Top 3 Coach patterns from the last 7 days surface with trend arrows",
    instructions: "Trigger the Coach a few times across messages (use the v3 trigger phrases from earlier smoke items). Then visit /dashboard/brain.",
    expected: "'Top communication patterns the Coach noticed' card lists up to 3 patterns sorted by frequency. Each row: human label + heuristic_id (mono), large count, trend indicator (TrendingUp green / TrendingDown gray) with delta vs prior 7 days. Zero-state shows honest copy: 'No Coach observations… The empty state is honest signal — not a placeholder.'",
    assignee: "partners",
  },
  {
    id: "brain-learning-durability-block",
    title: "Topic durability block surfaces ONLY when closed topics exist",
    instructions: "On a company with at least one closed topic in the last 28 days, visit /dashboard/brain.",
    expected: "'Topic durability · §3.5 consequence' card surfaces with five chips: Held / Partial / Reopened / Unknown / Unrated. Footer copy clarifies that held = validated learning, unrated = awaiting review. If no closed topics: card does not render at all.",
    assignee: "partners",
  },
  {
    id: "brain-learning-decision-paths",
    title: "Decision paths block shows distribution across the four choices",
    instructions: "After running at least one Decision Dialogue to completion, visit /dashboard/brain.",
    expected: "'Decision paths · last 28 days' card shows four chips: User's proposal / System suggestion / Hybrid / Deferred. Footer copy frames deferred as healthy signal, not failure. Card hidden if no decisions decided in window.",
    assignee: "partners",
  },
  {
    id: "brain-learning-accumulating-state",
    title: "Low-activity companies see honest 'Accumulating' state, not fake metrics",
    instructions: "(JOHN) On a company with fewer than 30 chain events total (e.g. a freshly seeded org), visit /dashboard/brain.",
    expected: "Learning Visible section shows a single card with 'Accumulating — not enough activity to surface yet' header. Explanation references §3.4 (no instant results) and explicitly refuses to fabricate signal. No stat boxes or top-pattern cards render in this state.",
    assignee: "john",
  },
  {
    id: "brain-learning-zero-coach-empty-state",
    title: "If Coach has 0 observations last 7 days, top-patterns card shows honest empty",
    instructions: "On a company with chain activity but no Coach observations in the last 7 days, visit /dashboard/brain.",
    expected: "Top-patterns card still renders, but its body says 'No Coach observations in the last 7 days. Either the team has been communicating without triggering any heuristics, or Coach is off…'. This is honest signal — the empty state itself is data.",
    assignee: "partners",
  },

  // ─── Coach v3.2 — context-aware verdict + veto ──────────────────
  {
    id: "coach-v3.2-llm-vetoes-critique-of-word",
    title: "LLM vetoes regex hit when user is critiquing the word, not using it",
    instructions: "In any Coach-enabled topic, type: 'I don't like \"this is dumb\" as a phrase' and pause for ~2 seconds.",
    expected: "Initially (within 350ms) the regex chip may flash for 'Absolute / judgmental phrasing' — within 1.2s the LLM verdicts the hit as 'vetoed' (user is critiquing the phrase, not using it) and the chip disappears. The §4 chain still records the regex hit + LLM veto for the readout, but the UI doesn't surface the false positive.",
    assignee: "partners",
  },
  {
    id: "coach-v3.2-context-note-replaces-generic-question",
    title: "Confirmed hits show LLM context-specific note instead of generic question",
    instructions: "Type the user's earlier flag: 'I'm hungry and you guys are making mad' and pause for the chip to land.",
    expected: "Closed chip shows: pattern label + trigger excerpt + a SPECIFIC 1-2 sentence note that references the actual words from the draft (e.g. \"The phrase 'you guys are making mad' lands the cause of the feeling on them; an alternative is 'I'm getting frustrated when…'\"). NOT the generic 'First occurrence — pattern starting, or fair callback to a real situation?' question that v2 used for every hit.",
    assignee: "partners",
  },
  {
    id: "coach-v3.2-uncertain-verdict-tag",
    title: "Uncertain LLM verdict shows subtle '· context uncertain' tag",
    instructions: "Type a draft where the pattern shape is ambiguous (e.g. 'we should probably take a look at this when we get time' — between bare assertion and reasonable suggestion). Wait for the LLM pass.",
    expected: "If the LLM returns verdict='uncertain' (not confirmed, not vetoed), the chip's label line shows a small muted '· CONTEXT UNCERTAIN' suffix. The chip still surfaces but with this hedge — System is honest that it read the context but isn't certain.",
    assignee: "partners",
  },
  {
    id: "coach-v3.2-regex-hits-sent-to-llm",
    title: "(JOHN) Regex hits are sent to LLM as part of the analyze request body",
    instructions: "(JOHN) Type a draft that triggers regex (e.g. 'this is absolutely stupid'). Inspect the POST body to /api/coach/analyze in Network tab.",
    expected: "Request body contains a 'regexHits' array with the pattern_id + trigger_excerpt of every regex hit. The LLM uses these to render verdicts. Empty regexHits is also valid — LLM will surface any patterns it sees independently.",
    assignee: "john",
  },
  {
    id: "coach-v3.2-vocab-allowlist-still-holds",
    title: "(JOHN) API still filters returned hits to the 7-pattern allowlist + valid verdicts",
    instructions: "(JOHN) If the LLM returns a hit with verdict='maybe' or pattern_id='some-new-id', confirm the API drops it before returning to the client.",
    expected: "Defense-in-depth filter still active: ALLOWED_PATTERN_IDS check + ['confirmed','uncertain','vetoed'] verdict check + non-empty context_note check. Any hit failing any check is silently dropped from the response.",
    assignee: "john",
  },

  // ─── Mobile composer overflow regression (post-typing) ─────────
  {
    id: "mobile-composer-no-overflow-after-typing",
    title: "Composer footer wraps cleanly when char-count appears on mobile",
    instructions: "Open any chat topic at 375px width (Chrome DevTools iPhone preview). With empty draft, verify no horizontal scroll. Then type 1+ chars and verify still no horizontal scroll.",
    expected: "The composer footer's left group (Guide my response · Help me formulate) stays on one line if it fits, but the right group (char count + Send button) wraps to a second line when needed instead of pushing the page wider than viewport. NO horizontal scroll appears, before OR after typing. Page stays viewport-locked.",
    assignee: "partners",
  },
  {
    id: "mobile-placeholder-doesnt-cause-scroll",
    title: "Composer placeholder is short enough to not force horizontal scroll",
    instructions: "On mobile width with an empty draft, inspect the textarea placeholder.",
    expected: "Placeholder reads 'Write your message…' (no markdown syntax tutorial appended). The 95-char markdown hint we added in the toolbar build was forcing some browsers to push the textarea wider than its container; the hint is documented via the toolbar's button tooltips instead.",
    assignee: "partners",
  },
  {
    id: "mobile-helper-text-wraps",
    title: "Composer helper text wraps mid-word if needed",
    instructions: "On mobile width, look at the gray helper line below the composer ('Enter to send · Shift+Enter for new line · Pin important messages…').",
    expected: "Helper text wraps across multiple lines. 'Shift+Enter' breaks mid-token if needed instead of forcing horizontal scroll. break-words + overflow-wrap: anywhere on the <p> ensures no edge case can push the page wider.",
    assignee: "partners",
  },
  {
    id: "mobile-ios-safari-html-overflow-guard",
    title: "(JOHN) html element has overflow-x: hidden + position: relative as iOS Safari guard",
    instructions: "(JOHN) Inspect <html> styles in globals.css; verify the rule applies on the deployed app.",
    expected: "html { overflow-x: hidden; position: relative; } applied. Belt-and-suspenders with body's existing overflow-x: hidden. Catches iOS Safari edge cases where fixed-position children (sidebar drawer, install prompt) could push touch-gesture scroll past viewport.",
    assignee: "john",
  },

  // ─── Coach v3.2.1 — vocabulary + verb-phrase + LLM threshold ───
  {
    id: "coach-v3.2.1-getting-annoyed-triggers",
    title: "'I'm getting annoyed' (19 chars) now triggers the hot-state chip",
    instructions: "In any Coach-enabled topic, type 'I'm getting annoyed' and pause for ~1.5 seconds.",
    expected: "Coach chip surfaces within 350ms (regex) with 'Composing from a hot state' label. The expanded HOT_STATE regex now matches 'I'm getting X' verb phrasing (was rigid 'I'm X') and the 'annoyed' vocabulary entry (was missing). Previously this draft slipped both passes — regex didn't match the phrasing/word and the 19-char draft fell below the LLM_MIN_DRAFT_CHARS=20 floor.",
    assignee: "partners",
  },
  {
    id: "coach-v3.2.1-onset-verb-coverage",
    title: "Onset-verb phrasings all activate hot-state detection",
    instructions: "Try each on separate posts: 'I'm getting irritated', 'I'm feeling cranky', 'I'm becoming agitated', 'I'm starting to feel done'.",
    expected: "All four trigger the hot-state chip. The regex captures the four onset verbs (getting / feeling / becoming / starting to feel) as optional inserts between 'I'm' and the emotion vocabulary.",
    assignee: "partners",
  },
  {
    id: "coach-v3.2.1-expanded-vocabulary",
    title: "Expanded everyday-emotion vocabulary triggers hot-state",
    instructions: "Try each: 'I'm annoyed', 'I'm irritated', 'I'm upset', 'I'm bothered', 'I'm cranky', 'I'm on edge', 'I'm frazzled', 'I'm cooked'.",
    expected: "Each one triggers the hot-state chip. v3 had only the high-intensity tail (exhausted / burnt out / frustrated); v3.2.1 adds the everyday-emotion vocabulary the Coach was missing.",
    assignee: "partners",
  },
  {
    id: "coach-v3.2.1-llm-fires-on-short-drafts",
    title: "LLM analyze fires on drafts ≥ 12 chars (was 20)",
    instructions: "(JOHN) Type a 14-char draft that wouldn't trigger the regex ('this is rough' or similar). Watch the Network tab.",
    expected: "/api/coach/analyze fires within 1.2s of typing stopping. Previously the 20-char floor blocked the LLM fallback on short emotional drafts; 12 covers the realistic short-message surface without burning LLM calls on 'ok'/'yes'/'thanks!' (all <12).",
    assignee: "john",
  },

  // ─── Coach v3.3 — comprehensive negative-vocabulary library ────
  {
    id: "coach-v3.3-emotional-states-comprehensive",
    title: "Every emotional state from the vocabulary library triggers hot-state",
    instructions: "Try a representative sample on separate posts: 'I'm livid', 'I'm crushed', 'I'm bewildered', 'I'm checked out', 'I'm jaded', 'I'm overwhelmed', 'I'm hangry', 'I'm at my breaking point', 'I'm in a bad mood', 'I'm cooked', 'I'm fried out'.",
    expected: "Each one triggers the hot-state chip. v3.3 vocabulary library covers anger / frustration / sadness / anxiety / disappointment / exhaustion / disgust / confusion / boredom / resentment / defeat / overwhelm / physical-state / 'done with this' families — exhaustive, not ad-hoc.",
    assignee: "partners",
  },
  {
    id: "coach-v3.3-pejoratives-comprehensive",
    title: "Every pejorative-for-things triggers nvc-evaluation",
    instructions: "Try: 'this is asinine', 'this is a clusterfuck', 'this is rubbish', 'this is wack', 'this is jacked', 'this is appalling', 'it's a sham', 'that's outrageous', 'this is going down in flames'.",
    expected: "Each triggers the 'Absolute / judgmental phrasing' chip. v3.3 covers calm pejoratives, loaded judgment phrases, direct judgments, colloquial 'sucks' forms — exhaustive.",
    assignee: "partners",
  },
  {
    id: "coach-v3.3-identity-attacks-comprehensive",
    title: "Every identity-attack vocabulary entry triggers stone-identity",
    instructions: "Try: 'you're a narcissist', 'they're toxic', 'he's a fraud', 'she's amateurish', 'you're bush league', 'they're a gaslighter', 'he's out of his depth'.",
    expected: "Each triggers the 'Identity, not behavior' chip. Covers competence / character / mental / failure-identity / profane epithets / 'won't change' framings — exhaustive.",
    assignee: "partners",
  },
  {
    id: "coach-v3.3-aggression-imperatives-comprehensive",
    title: "Every aggressive imperative from the library triggers aggressive-language",
    instructions: "Try (individually): 'shut up', 'fuck off', 'piss off', 'go to hell', 'eat shit', 'drop dead', 'leave me alone', 'kiss my ass', 'knock it off'.",
    expected: "Each triggers the 'Direct aggression toward a person' chip. The Aggressive Imperatives vocabulary is exhaustively enumerated; future common phrasings either belong here OR need a new category in vocabulary.ts (not ad-hoc additions to the regex).",
    assignee: "partners",
  },
  {
    id: "coach-v3.3-onset-verbs-cascade",
    title: "Onset-verb expansion cascades through every emotional state",
    instructions: "Try: 'I'm getting bewildered', 'I'm feeling jaded', 'I'm becoming bitter', 'I'm starting to feel hopeless', 'I'm ending up frazzled', 'I'm growing irritable'.",
    expected: "Each triggers the hot-state chip. The ONSET_VERBS vocabulary now multiplies into EMOTIONAL_STATES via the regex composition — adding a new onset verb or a new emotional state cascades to all combinations automatically.",
    assignee: "partners",
  },
  {
    id: "coach-v3.3-blame-projection-with-comprehensive-emotion",
    title: "Blame projection works across the full emotional-state vocabulary",
    instructions: "Try: 'you guys are making me jaded', 'they made me hopeless', 'y'all are making me bewildered'.",
    expected: "Each triggers the 'Locating cause in someone else' chip. v3 had a hand-typed short list (mad / angry / furious / upset / stressed / anxious / crazy / nuts / insane / frustrated / annoyed / miserable); v3.3 inherits the full EMOTIONAL_STATES library by reference.",
    assignee: "partners",
  },
  {
    id: "coach-v3.3-vocabulary-as-library-not-arrays",
    title: "(JOHN) Vocabulary lives in src/lib/coach/vocabulary.ts, NOT in heuristics.ts arrays",
    instructions: "(JOHN) Inspect src/lib/coach/heuristics.ts — verify every word in any regex pattern comes via `vocabAlt(VOCAB_LIST)` from vocabulary.ts, not as inline `(word1|word2|word3)` arrays.",
    expected: "All vocabulary-driven regex patterns are built from vocabAlt(...) over imports from vocabulary.ts. Per §1.3, ad-hoc inline vocabulary lists are the error-loop shape the v3.3 refactor explicitly stopped. Adding a new word means editing vocabulary.ts, not heuristics.ts.",
    assignee: "john",
  },

  // ─── Coach v3.4 — render path verification (closed + expanded) ──
  {
    id: "coach-v3.4-closed-chip-draft-aware-fallback",
    title: "Closed chip references the trigger excerpt even when LLM is offline",
    instructions: "In any Coach-enabled topic, type 'this is dumb' (a regex hit). Open Network tab and verify whether /api/coach/analyze returns hits. If the LLM is slow / empty / down, observe the closed chip text.",
    expected: "Closed chip's question line reads 'You wrote \"this is dumb\" — first occurrence, pattern starting, or fair callback to a real situation?' — references the actual draft excerpt rather than the previous generic 'First occurrence — pattern starting?' question. Even regex-only fires now feel draft-aware.",
    assignee: "partners",
  },
  {
    id: "coach-v3.4-expanded-chip-shows-context-note",
    title: "Expanded chip shows LLM context_note PROMINENTLY when present",
    instructions: "Type 'I'm hungry and you guys are making mad'. Wait for the chip to land. CLICK the chip to expand it.",
    expected: "Expanded view's TOP section is the System's read on THIS draft (LLM context_note), styled as an amber card titled 'SYSTEM'S READ ON THIS DRAFT' with the LLM-generated 1-2 sentence note. BELOW that is the static principle + kindExplanation labeled 'UNDERLYING PRINCIPLE'. The new context-specific read takes visual priority over the generic theory.",
    assignee: "partners",
  },
  {
    id: "coach-v3.4-verdict-badge-visible",
    title: "Expanded chip shows a verdict badge so the user knows whether LLM read the context",
    instructions: "Open various Coach chips with the expand toggle.",
    expected: "Inline badge next to the source label shows ONE of: 'System read the context · verdict: confirmed' (emerald), 'verdict: uncertain' (amber), 'verdict: vetoed' (muted), OR 'Regex-only · LLM didn't read context' (muted) when no LLM verdict came back. The user can now tell at a glance whether the System actually evaluated their specific message.",
    assignee: "partners",
  },
  {
    id: "coach-v3.4-expanded-fallback-when-llm-down",
    title: "When LLM didn't return, expanded view ONLY shows static principle (not a fake LLM card)",
    instructions: "Force a regex-only fire (LLM unavailable or empty hits). Expand the chip.",
    expected: "Expanded view shows the 'Regex-only' badge AND skips the 'System's read on this draft' card entirely — falling through to just the underlying principle + kindExplanation. Per §0 honesty: never fabricate a context note when none was generated.",
    assignee: "partners",
  },
  {
    id: "coach-v3.4-render-path-verification-meta",
    title: "(JOHN) Both closed AND expanded chip render paths consume active.contextNote",
    instructions: "(JOHN) Grep src/components/chats/CoachPanel.tsx for active.contextNote — should appear in BOTH the closed chip body AND the expanded chip body, not just one.",
    expected: "active.contextNote is consumed in: (a) the closed chip's primary text line, AND (b) the expanded view's 'System's read' card. v3.2 wired only (a) which is what produced the user's complaint that the expanded view looked identical for every fire. A14 captured the meta-rule: 'data path complete ≠ render path complete.'",
    assignee: "john",
  },

  // ─── Coach v3.5 — honest expanded view (no fake draft-specific paragraph) ──
  {
    id: "coach-v3.5-no-kindexplanation-in-regex-only",
    title: "Expanded view does NOT show kindExplanation paragraph when LLM didn't read",
    instructions: "Force a regex-only fire (type 'this is dumb' and expand immediately before LLM returns). Look at the expanded view's content.",
    expected: "Expanded view shows: source + 'Regex-only · LLM didn't read context' badge + 'Have the System read this draft' button + 'Underlying principle' label + italic principle. The static kindExplanation paragraph ('Built-in evaluation — words like broken, always, obviously...') is HIDDEN. Previously this paragraph rendered immediately under the 'I didn't read' badge — two contradictory claims as one block. Per §0 honesty: don't fake a draft-specific reading.",
    assignee: "partners",
  },
  {
    id: "coach-v3.5-on-demand-llm-trigger-button",
    title: "'Have the System read this draft' button fires an explicit LLM call",
    instructions: "On a regex-only chip, expand it. Click the 'Have the System read this draft' link. Watch the chip.",
    expected: "Clicking the button immediately calls /api/coach/analyze (bypassing the 1.2s debounce). The button disappears. An inline 'System reading this draft…' spinner shows until the LLM returns. When the LLM responds with a context_note, the 'System's read on this draft' card surfaces. If the LLM responds with no draft-specific note, 'System read this draft — no concern beyond the pattern itself' shows instead.",
    assignee: "partners",
  },
  {
    id: "coach-v3.5-reading-state-in-expanded-view",
    title: "'System reading…' state is visible IN the expanded view, not just the closed pre-chip state",
    instructions: "Type a draft >12 chars that fires a regex hit. Within ~1s (before LLM returns), expand the chip. Watch the expanded view.",
    expected: "Expanded view shows an inline 'System reading this draft…' spinner while the LLM is in flight. Previously the in-flight state only showed when no chip was active (pre-surface pulse). Now the expanded view tells the user 'I'm reading' instead of falsely claiming 'I didn't read.' Eliminates the brief window where the badge said 'didn't read' but the LLM was actually reading.",
    assignee: "partners",
  },
  {
    id: "coach-v3.5-empty-llm-response-distinct-state",
    title: "Empty LLM response shows 'no concern beyond the pattern' — distinct from never-tried",
    instructions: "Type a draft that the LLM is likely to read but verdict-veto (e.g. quoting someone). Wait for LLM to return. Expand the chip.",
    expected: "When the LLM read the draft but returned no context-specific note, the expanded view shows: 'System read this draft — no concern beyond the pattern itself.' This is a DIFFERENT state from 'haven't tried yet' (which shows the trigger button). Three states now distinguishable to the user: reading, read-and-empty, never-tried.",
    assignee: "partners",
  },
  {
    id: "coach-v3.5-llmReadAttempted-reset-on-draft-change",
    title: "(JOHN) llmReadAttempted resets cleanly between drafts",
    instructions: "(JOHN) Read CoachPanel.tsx — confirm setLlmReadAttempted(false) is called inside the same useEffect that wipes llmHits + llmAnalyzing on draft change.",
    expected: "Every draft change wipes ALL three: llmHits, llmAnalyzing, llmReadAttempted. The 'no concern beyond the pattern' state never bleeds across drafts. Same canonical-reset discipline the C2/M2 audit fix established for llmHits — extended to v3.5's new state.",
    assignee: "john",
  },
  {
    id: "coach-v3.5-render-states-mutually-exclusive",
    title: "(JOHN) The four expanded-view states are mutually exclusive",
    instructions: "(JOHN) Read CoachPanel.tsx render block. Confirm the four states (has contextNote / is reading / never tried / read-empty) are mutually exclusive booleans.",
    expected: "Exactly one of these four branches renders at a time: (a) System's read card when contextNote exists; (b) inline spinner when !contextNote && llmAnalyzing; (c) trigger button when !contextNote && !llmAnalyzing && !llmReadAttempted; (d) 'no concern beyond' when !contextNote && !llmAnalyzing && llmReadAttempted. A14 multi-render-branch discipline applied: every branch consumes the data that distinguishes it.",
    assignee: "john",
  },

  // ─── Audit C1 — decision_dialogues append-only at SQL layer ──
  {
    id: "decision-dialogues-no-update-rule",
    title: "(JOHN) UPDATE statements against decision_dialogues are silently no-op (DO INSTEAD NOTHING)",
    instructions: "(JOHN) After migration 0025 is applied, attempt: UPDATE decision_dialogues SET chosen_note = 'tampered' WHERE id = '<any existing id>'; from a non-service-role context. Verify 0 rows affected and the original value preserved.",
    expected: "Statement reports 0 rows affected. The chosen_note value is unchanged. §3.1 append-only discipline now enforced at the SQL rule layer for decision_dialogues, matching chat_messages / events / signals / brain_evolution_events.",
    assignee: "john",
  },
  {
    id: "decision-dialogues-no-delete-rule",
    title: "(JOHN) DELETE statements against decision_dialogues are silently no-op (DO INSTEAD NOTHING)",
    instructions: "(JOHN) Attempt: DELETE FROM decision_dialogues WHERE id = '<any existing id>'; — and confirm the row remains.",
    expected: "0 rows deleted. Row remains in the table. Closes §1.7 audit finding C1: decision_dialogues was claimed append-only but lacked the SQL-rule enforcement that chat_messages / events / signals all have.",
    assignee: "john",
  },

  // ─── Audit C2 + H1 + M2 — Coach state lifecycle refactor ────
  {
    id: "coach-stale-llm-hits-cleared-on-draft-change",
    title: "Stale LLM verdicts can no longer suppress new regex hits across draft changes",
    instructions: "Type 'this is dumb' and wait for the Coach chip (regex fires). Wait for LLM to potentially veto/confirm it (1.2s). Now without dismissing, change the draft to 'this is broken instead'. Watch the chip.",
    expected: "Draft change wipes llmHits + llmAnalyzing immediately. The new draft triggers fresh regex detection and a fresh LLM call. No leftover veto from the previous draft can suppress the new regex hit. Closes audit finding C2.",
    assignee: "partners",
  },
  {
    id: "coach-expanded-resets-between-fires",
    title: "Expanded chip state does NOT carry across different chip fires",
    instructions: "Type a draft that triggers Coach. Click the chip to expand it. Now clear the draft (chip vanishes). Type a NEW draft that triggers Coach with a DIFFERENT heuristic.",
    expected: "The new chip surfaces in COLLAPSED state, not expanded. The expanded boolean resets whenever active.citation.id changes (or active goes null). Closes audit finding H1 — previously the next chip resurrected stale expanded=true.",
    assignee: "partners",
  },
  {
    id: "coach-llm-hits-cleared-on-short-draft",
    title: "Short drafts (<12 chars) cleanly clear LLM state including in-flight",
    instructions: "Type a long draft (>20 chars) triggering both regex and LLM. Wait for LLM. Then delete chars until draft is <12 chars.",
    expected: "llmHits cleared, llmAnalyzing cleared, in-flight LLM call aborted via AbortController. No stale chip from the cancelled call appears. The canonical reset on every draft change handles this without a separate threshold-crossing check. Closes audit finding M2.",
    assignee: "partners",
  },
  {
    id: "coach-api-json-parse-graceful-fallback",
    title: "(JOHN) Malformed LLM JSON falls back to empty hits, not 500",
    instructions: "(JOHN) Mock the LLM to return non-JSON text (e.g. 'Rate limit reached'). Hit /api/coach/analyze.",
    expected: "Route returns 200 with { hits: [] } instead of crashing to 500. In dev mode (NODE_ENV !== production) a console.warn surfaces the first 200 chars of the malformed response so failure rate is observable. Closes audit finding M3.",
    assignee: "john",
  },
  {
    id: "coach-empty-trigger-excerpt-guard",
    title: "(JOHN) Closed-chip fallback handles empty trigger_excerpt without rendering 'You wrote \"\"'",
    instructions: "(JOHN) Inspect CoachPanel.tsx — the closed-chip render is now a three-state ternary: contextNote → draft-aware fallback (only if triggerSnippetShort non-empty) → generic question.",
    expected: "If a future code path ever produces an active citation with empty triggerExcerpt, the closed chip falls through to the generic question text rather than rendering nonsense. Defense-in-depth — the regex factories guarantee non-empty excerpts today, but the guard removes the cliff. Closes audit finding M6.",
    assignee: "john",
  },
  {
    id: "coach-a14-render-walk-verified",
    title: "(JOHN) A14 verification — every active.* field has a render branch",
    instructions: "(JOHN) Grep `active\\.` in src/components/chats/CoachPanel.tsx and confirm each property (citation, count, contextNote, verdict) is consumed in at least one render branch.",
    expected: "active.contextNote → closed-chip primary + expanded 'System's read' card. active.verdict → closed 'context uncertain' tag + expanded badge (confirmed/uncertain/vetoed/regex-only). active.citation.source/principle/kindExplanation → expanded view. active.count → mirrorChipText call. active.citation.id → expanded reset effect dependency. No orphaned state.",
    assignee: "john",
  },

  // ─── Audit H3 + H4 + M7 — orphan event documentation ─────────
  {
    id: "orphan-events-documented-disabled-rows",
    title: "(JOHN) Every orphan event kind has a disabled signal_sources row with A4 §4 question",
    instructions: "(JOHN) After migration 0026 is applied, query: SELECT event_kind, signal_kind, enabled, notes FROM signal_sources WHERE enabled = false ORDER BY event_kind;",
    expected: "14 rows returned, covering coach.* (6), decision.* (4), task.gate_cleared/nudge_sent/system_message/participant_added (4). Each row's `notes` field states the explicit §4 readout question the deferral is waiting on — not 'TODO' or 'future work', a concrete testable hypothesis. Closes audit findings H3 + H4 + M7.",
    assignee: "john",
  },
  {
    id: "signal-sources-enabled-true-by-default-still",
    title: "(JOHN) signal_sources.enabled default is still TRUE — disabled-by-default would have been a §3.4 violation",
    instructions: "(JOHN) Confirm \\d signal_sources shows enabled is boolean with default true, and that the 0026 INSERTs explicitly pass false.",
    expected: "Default remains true. Explicit false on every documentation-only row. If enabled were flipped to false-by-default, real signal mappings would silently turn off — exactly the kind of structural change that should require explicit per-row opt-in per §3.4 (no instant results).",
    assignee: "john",
  },
  {
    id: "0026-migration-safe-to-rerun",
    title: "(JOHN) Migration 0026 re-runs cleanly (ON CONFLICT DO NOTHING)",
    instructions: "(JOHN) Apply migration 0026, confirm 14 rows inserted. Re-apply the same migration without resetting. Confirm 0 NEW rows inserted, no error.",
    expected: "ON CONFLICT (event_kind, signal_kind) DO NOTHING guarantees idempotent re-application per A12. The (event_kind, signal_kind) unique constraint also blocks any later migration from adding a CONFLICTING enabled=true mapping for the same pair without first deleting the disabled marker — which is the correct behavior, surfacing the documentation/active transition as an explicit change rather than a silent drift.",
    assignee: "john",
  },
  {
    id: "a4-deferred-rows-distinct-from-todo",
    title: "(JOHN) Disabled signal_sources `notes` fields name §4 questions, not generic deferrals",
    instructions: "(JOHN) Read each notes field in the 14 disabled rows from migration 0026.",
    expected: "Each `notes` field ends with a concrete §4 readout question (e.g. 'do admin nudges actually move work forward...within 72h'). Per A4, deferral is honest signal ONLY when the §4 question is named. Generic 'future work' notes would defeat the purpose — an outside auditor should be able to read the row and know what evidence to look for.",
    assignee: "john",
  },

  // ─── Audit M1 — atomic in-thread decide RPC (migration 0027) ──
  {
    id: "decide-rpc-atomic-success-path",
    title: "(JOHN) Finalizing an in-thread Decision Dialogue is now a single RPC call",
    instructions: "(JOHN) After migration 0027 is applied, open Network tab and finalize an in-thread Decision Dialogue (any chosenPath). Watch the POST /api/chat/topic-decisions/[id]/decide call.",
    expected: "Backend now performs a single supabase.rpc('decide_chat_topic_decision', {p_topic_decision_id, p_chosen_path, p_chosen_note}) instead of five sequential .from(...).insert/update calls. All five writes (decisions / decision_dialogues / chat_topic_decisions update / chat_messages system message / events chain entry) commit or roll back together. Closes audit finding M1.",
    assignee: "john",
  },
  {
    id: "decide-rpc-rollback-on-failure",
    title: "(JOHN) If any of the five writes fails, ALL writes roll back",
    instructions: "(JOHN) In Supabase SQL editor, temporarily revoke INSERT on `events` from authenticated. Attempt to finalize a Decision Dialogue. Then check decisions, decision_dialogues, chat_topic_decisions, chat_messages — each should show NO new rows. Restore the grant after.",
    expected: "The events INSERT fails inside the RPC. The whole transaction rolls back — no decisions row, no decision_dialogues row, no phase='decided' update, no system message. Previously this was the worst case: first four writes landed, the chain event dropped, and §3.1 readout under-counted decisions silently.",
    assignee: "john",
  },
  {
    id: "decide-rpc-rls-still-applies",
    title: "(JOHN) SECURITY INVOKER means RLS still applies to every write",
    instructions: "(JOHN) From a non-member user account, attempt to call POST /api/chat/topic-decisions/<some-other-company-dialogue-id>/decide.",
    expected: "Request returns 4xx — the RLS policy on chat_topic_decisions blocks the SELECT inside the function, raising 'Dialogue not found' (P0002 → 404). No privilege elevation. SECURITY INVOKER preserves the caller's auth.uid() throughout the function body.",
    assignee: "john",
  },
  {
    id: "decide-rpc-already-decided-rejected",
    title: "Re-deciding an already-decided dialogue returns 409 (same as before refactor)",
    instructions: "Finalize a Decision Dialogue. Note its decision id. Replay the same POST request (Postman or fetch console).",
    expected: "Returns 409 with body { error: 'This dialogue is already decided.' }. The SQL function raises P0001 'Dialogue already decided'; the route maps to 409. The error contract that the UI consumes (data.error string) is identical to the pre-M1 sequential-write version.",
    assignee: "partners",
  },
  {
    id: "decide-rpc-message-text-matches-pre-m1-exactly",
    title: "(JOHN) System message text in topic timeline is byte-for-byte identical to pre-M1 version",
    instructions: "(JOHN) Finalize a dialogue with chosenPath='system' and chosenNote='confirming the approach'. Inspect the resulting chat_messages row.",
    expected: "Body reads exactly: 'Decision recorded: Going with the System\\'s suggestion.\\n\\nconfirming the approach'. Straight apostrophe (U+0027) in 'System\\'s', trailing period after the path label, two-newline gap before the note. A14 discipline applied at migration-author time — data path changed but rendered text in the topic timeline did not drift.",
    assignee: "john",
  },
  {
    id: "decide-rpc-typed-errcodes-mapped",
    title: "(JOHN) Function raises typed errcodes; route maps each to its HTTP status",
    instructions: "(JOHN) Read the decide route — confirm error.message string-match maps to: 28000→401 (Not authenticated), P0002→404 (Dialogue not found), P0001→409 (already decided) or 400 (system hasn't responded), 22023→422 (Invalid chosen_path), else 500.",
    expected: "Five typed error paths mapped explicitly. The UI's decideTopicDecision() helper throws Error(data.error) — exact strings preserved so the surface-level UX is unchanged. The transaction discipline is structural; the error contract is the visible-output guarantee.",
    assignee: "john",
  },
  {
    id: "decide-rpc-migration-0027-idempotent",
    title: "(JOHN) Migration 0027 re-runs cleanly (CREATE OR REPLACE FUNCTION)",
    instructions: "(JOHN) Apply migration 0027. Re-apply without resetting the DB.",
    expected: "Second run is a clean no-op — CREATE OR REPLACE FUNCTION replaces in place. Per A12, every migration must be replayable against a partially-applied target. Zero error, zero side-effects beyond function re-creation.",
    assignee: "john",
  },

  // ─── Audit M4 — atomic task engagement increment (migration 0028) ──
  {
    id: "engagement-rpc-no-lost-increments-under-concurrency",
    title: "(JOHN) Concurrent engagement events no longer lose increments",
    instructions: "(JOHN) After migration 0028 is applied, simulate 10 concurrent calls to record_task_engagement(SAME_task_id) for the SAME user (e.g. via psql: SELECT record_task_engagement('<task-uuid>') FROM generate_series(1,10);). Then SELECT engagement_count FROM task_participants WHERE ...",
    expected: "engagement_count is exactly 10 (or N-prior+10). Previously the client-side read-then-write could lose up to N-1 increments under any concurrent burst. The single-statement INSERT … ON CONFLICT DO UPDATE holds the row lock through the increment expression; concurrent calls serialize cleanly. Closes audit finding M4.",
    assignee: "john",
  },
  {
    id: "engagement-rpc-first-time-engagement",
    title: "First-time engagement (no prior row) creates row with count=1",
    instructions: "Open a task you've never engaged with as a fresh user (or query task_participants confirming no row exists for {task_id, user_id}). Trigger an engagement action (post a message, change status).",
    expected: "Row created with engagement_count=1, role='member', last_engaged_at=now. Per A8, joining happens automatically through engagement — no explicit 'join task' click needed.",
    assignee: "partners",
  },
  {
    id: "engagement-rpc-subsequent-engagement",
    title: "Subsequent engagements increment count and refresh last_engaged_at",
    instructions: "On a task where you already have a participant row, trigger several engagement actions in quick succession (post 3 messages, change status twice).",
    expected: "engagement_count goes up by 5 (not by 1, 2, or 3 from lost increments). last_engaged_at is the most recent action's timestamp. The §4 readout's 'meaningful action frequency' signal is now trustworthy.",
    assignee: "partners",
  },
  {
    id: "engagement-rpc-rls-still-applies",
    title: "(JOHN) SECURITY INVOKER means RLS still applies to task_participants writes",
    instructions: "(JOHN) From a user account that's NOT a member of the task's company, attempt: SELECT record_task_engagement('<other-company-task-uuid>');",
    expected: "Returns an error from the RLS policy on task_participants (INSERT or UPDATE policy violation). No privilege elevation — SECURITY INVOKER preserves the caller's auth.uid() and the policies see it as the actual user. The atomic-write benefit doesn't bypass authorization.",
    assignee: "john",
  },
  {
    id: "engagement-rpc-recordengagement-helper-now-single-call",
    title: "(JOHN) recordEngagement() in src/lib/data/tasks.ts is a single RPC call",
    instructions: "(JOHN) Read src/lib/data/tasks.ts — the recordEngagement function should be: supabaseEnabled check + supabase.rpc('record_task_engagement', {p_task_id: taskId}). No SELECT, no UPSERT, no read-then-write pattern.",
    expected: "Function body is 3 lines (plus return). The old read-then-write pattern is gone. All callers (createTask, transitionTaskStatus, message posts) still invoke recordEngagement(taskId) the same way — fire-and-forget — but the underlying write is now atomic. Same client contract, structural fix below.",
    assignee: "john",
  },
  {
    id: "engagement-rpc-migration-0028-idempotent",
    title: "(JOHN) Migration 0028 re-runs cleanly (CREATE OR REPLACE FUNCTION)",
    instructions: "(JOHN) Apply migration 0028. Re-apply without resetting the DB.",
    expected: "Second run is a clean no-op — CREATE OR REPLACE FUNCTION replaces in place. Per A12, every migration is replayable against a partially-applied target.",
    assignee: "john",
  },

  // ─── Audit M5 — observePatterns idempotency (resolved: not a defect) ──
  {
    id: "audit-m5-non-idempotency-is-the-contract",
    title: "(JOHN) observePatterns non-idempotency is by design, not a bug — M5 resolved not-a-defect",
    instructions: "(JOHN) Read the doc comment at the top of src/lib/coach/observe.ts and the in-line comment near the rows mapping. Confirm both state that EACH heuristic hit IS a separate observation by design (Rule 3.1 append-only + A11 mirror-frame).",
    expected: "Doc comment explicitly: '§1.7 audit M5 (2026-06-12) evaluation — NOT A DEFECT.' Diagnosis: outside-view scan of the call graph confirms each invocation fires exactly once per post (no retries, no double-submit paths). Even if it did fire twice, append-only §3.1 means each call would be a separate observation, not a duplicate of one. Idempotency would CONTRADICT A11 mirror semantics. The §1.7 audit flag is honestly resolved as 'not a defect' rather than fixed — that distinction matters per §0 (don't fix what you haven't diagnosed).",
    assignee: "john",
  },

  // ─── Audit L1 — confidence/verdict coupling (named, not split) ──
  {
    id: "audit-l1-confidence-verdict-named-coupling",
    title: "(JOHN) confidence/verdict shared filter is named llmConfidenceCounts with §0/A11 rationale",
    instructions: "(JOHN) Grep `llmConfidenceCounts` in src/components/chats/CoachPanel.tsx. Read the block comment above it.",
    expected: "Predicate appears as a named arrow function used in BOTH the verdict-application loop (LLM verdict overrides regex hit) AND the new-citation surface filter (LLM-only patterns the regex missed). The comment names both decision sites and explains why §0/A11 conservatism makes them share the same threshold — when the LLM isn't confident, the conservative choice is 'don't influence behavior' for both. Audit L1 resolved as named-coupling, not a split — explicit so a future maintainer doesn't treat it as a bug.",
    assignee: "john",
  },

  // ─── Audit L2 — actionable event-emission failure logs ──
  {
    id: "audit-l2-emit-error-context",
    title: "(JOHN) Coach event-emission failures log kind + subject + code, not just 'failed'",
    instructions: "(JOHN) In Supabase SQL editor, temporarily REVOKE INSERT on events FROM authenticated. Open the app, fire a Coach chip (type a pattern-matching draft). Open browser devtools console.",
    expected: "Console shows two structured log lines from src/lib/coach/emit.ts: one with {kind: 'coach.suggestion_offered', subject: 'chat_topic:...', code: '42501', message: '...'} from the inline `if (error)` path. Previously the same scenario logged only 'event emit failed' with no kind/subject — invisible. Restore the GRANT after. The §4 readout still catches mass-drop via volume-comparison; this is per-event observability.",
    assignee: "john",
  },
  {
    id: "audit-l2-observe-error-context",
    title: "(JOHN) observePatterns failures log subject + row_count + code, not just 'failed'",
    instructions: "(JOHN) Same setup as L2 emit test (revoke INSERT on events). Post a chat message containing a regex-matching pattern. Watch devtools console.",
    expected: "Console shows '[coach] observePatterns insert failed' with {subject: 'chat_topic:...', row_count: N, code: '42501', message: '...'}. Previously logged only the raw err. The fix uses the same inline `{ error } = await insert()` pattern as emit.ts because supabase-js returns 4xx INSERT failures through the response object, not by throwing. Restore the GRANT after.",
    assignee: "john",
  },
  {
    id: "audit-l2-readout-volume-defense-documented",
    title: "(JOHN) §4 readout volume-comparison defense still named as the mass-drop catcher",
    instructions: "(JOHN) Read the header comment in src/lib/coach/emit.ts and the equivalent block in src/lib/coach/observe.ts. Confirm both reference the §4 readout volume-comparison as the structural defense against systemic event drop, not just per-event logging.",
    expected: "Both files state: per-event observability via console.error is for individual failures (RLS, FK, payload regression); systemic drop (entire deploy can't write events) is caught by the §4 readout comparing event volume to chat_message volume. Two layers, both named on the record. §1.7 audit L2 closed.",
    assignee: "john",
  },

  // ─── Coach v3.6 — ellipted pejorative + first-person evaluation ──
  {
    id: "coach-v3.6-stupid-move-fires",
    title: "'stupid move' / 'dumb idea' / 'terrible decision' surface the Coach chip",
    instructions: "Open any chat composer. Type 'stupid move' (no other words). Wait 350ms.",
    expected: "Coach chip surfaces with the 'Reads as evaluation, not observation' header and 'stupid move' as the trigger excerpt. Previously the regex only fired on explicit 'this is/that is X' phrasing; the ellipted 'X move' / 'X idea' shape (where X is a pejorative adjective and the noun is an actional/output target) now also fires via the new EVALUATABLE_NOUNS pattern. Closes the bug surfaced by 'stupid move i don't like it' showing only the COACH READING pulse with no chip.",
    assignee: "partners",
  },
  {
    id: "coach-v3.6-i-dont-like-fires",
    title: "'I don't like it' / 'I hate this' surfaces the Coach chip",
    instructions: "Type 'i don't like it' OR 'I hate this approach' in any composer. Wait 350ms.",
    expected: "Coach chip surfaces. The first-person evaluation pattern catches: don't like, hate, can't stand, loathe, despise, can't take, don't love. The NVC principle applies identically to direct speaker-state judgments — strip the evaluation, name what specifically was observed.",
    assignee: "partners",
  },
  {
    id: "coach-v3.6-pejorative-noun-boundary",
    title: "(JOHN) Pejorative+noun pattern stays out of identity-attack territory",
    instructions: "(JOHN) Read src/lib/coach/heuristics.ts. Confirm EVALUATABLE_NOUNS contains ACTIONAL/OUTPUT nouns (move, idea, decision, design, etc.) but NOT person-words (person, people, friend, colleague, team).",
    expected: "EVALUATABLE_NOUNS is bounded by category — calling a MOVE/IDEA/DECISION stupid is NVC evaluation; calling a PERSON stupid is identity-attack and routes to stone-identity-collision via the pronoun-led 'you're a stupid X' shape. Keeping the noun list category-bounded is the §1.5 holistic boundary between two detectors that share vocabulary. No bleed; tests in heuristics.test.ts pin this down.",
    assignee: "john",
  },

  // ─── Coach v3.7 — dedupe contextNote + surface citation.suggestion ──
  {
    id: "coach-v3.7-no-duplicate-context-note",
    title: "Expanded chip does NOT show contextNote twice (once in primary line + once in System's Read card)",
    instructions: "Open a chat composer. Type a draft that triggers a Coach chip with an LLM context_note (e.g. 'stupid move'). Click the chip to expand. Count how many times the System's draft-specific sentence appears.",
    expected: "Sentence appears EXACTLY ONCE — inside the 'System's read on this draft' card. The closed-chip primary line is suppressed when the chip is expanded AND a contextNote exists, since the card below already shows it. Previously the same sentence rendered in both places, producing the 'two exact sentence creates unnecessary content' duplication.",
    assignee: "partners",
  },
  {
    id: "coach-v3.7-how-to-revise-renders",
    title: "Expanded chip surfaces the actionable 'How to revise' guidance",
    instructions: "Expand any Coach chip. Look for a card labeled 'How to revise' (yellow uppercase header).",
    expected: "Card shows citation.suggestion text — draft-specific actionable guidance (e.g. for nvc-evaluation: '\"stupid move\" is a judgment — what specifically did you notice happen?'). Previously this field was authored in every citation factory but the expanded view never rendered it — the user only saw the abstract 'Underlying principle' which flagged as 'unclear guidance for correction.' A14 strike again: data path had the actionable text; render path didn't consume it. Now it's the first thing shown after the System's-read card.",
    assignee: "partners",
  },
  {
    id: "coach-v3.7-principle-collapsed-by-default",
    title: "'Why this matters (principle)' is collapsed by default, expandable on click",
    instructions: "Expand a Coach chip. Look at the bottom of the expanded area.",
    expected: "A collapsed `<details>` element labeled 'Why this matters (principle)' renders below the How-to-revise card. Clicking expands it to show citation.principle (the abstract durable theory). The kindExplanation paragraph is REMOVED entirely — it duplicated the principle's abstract framing without adding draft-specific value. Three honest layers now: System's Read (draft-specific), How to revise (actionable), Why this matters (collapsed theory). No duplication.",
    assignee: "partners",
  },
  {
    id: "coach-v3.7-a14-render-walk-complete",
    title: "(JOHN) Every citation.* field has a render branch (A14 verified)",
    instructions: "(JOHN) Grep `active\\.citation\\.` in src/components/chats/CoachPanel.tsx. Confirm: source (expanded header), principle (Why-this-matters details), suggestion (How-to-revise card), triggerExcerpt (closed + expanded), id (mirrorChipText + reset effect).",
    expected: "Five citation fields, five render branches. citation.kindExplanation is intentionally NOT rendered post-v3.7 — the System's Read card supersedes it for draft-specific content, the principle covers durable theory. Per A14, removing a render path is as much an audit-able choice as adding one — documented inline in CoachPanel.tsx so future maintainers see the intent.",
    assignee: "john",
  },

  // ─── Coach v3.8 — feeling-as-judgment vocabulary ────────────
  {
    id: "coach-v3.8-thats-annoying-fires",
    title: "'thats annoying' / 'that's frustrating' surface the Coach chip",
    instructions: "Type 'thats annoying' (or 'that's frustrating', 'this is exhausting', 'it's tiresome'). Wait 350ms.",
    expected: "Coach chip surfaces with NVC evaluation. Closes the 'loading icon shows up but Coach doesn't activate' bug — the regex had a category gap where 'feeling-projected-as-thing-property' adjectives (annoying/frustrating/irritating/exhausting/tiresome) weren't in PEJORATIVES_FOR_THINGS, so 'that's annoying' matched the structural shape but no vocabulary entry to fire. v3.8 added FEELING_AS_JUDGMENT_ADJECTIVES as a named category and combined it with PEJORATIVES via EVALUATION_ADJECTIVES_ALT so both fire from the existing pattern.",
    assignee: "partners",
  },
  {
    id: "coach-v3.8-feeling-adj-ellipted-noun",
    title: "'annoying behavior' / 'frustrating decision' / 'tiresome approach' fire ellipted-verb NVC pattern",
    instructions: "Type 'annoying behavior' (no other words). Then 'frustrating decision'. Then 'tiresome approach'. Each on its own.",
    expected: "Each triggers the Coach chip — feeling-as-judgment adjective + EVALUATABLE_NOUN. The v3.6 ellipted shape now consumes both PEJORATIVES_FOR_THINGS (stupid/dumb/terrible) and FEELING_AS_JUDGMENT (annoying/frustrating/tiresome). v3.8 also expanded EVALUATABLE_NOUNS to include behavior, attitude, pattern, habit, tactic, strategy, process, workflow, policy, rule — common evaluation targets the v3.6 noun list missed.",
    assignee: "partners",
  },
  {
    id: "coach-v3.8-vocabulary-by-category-not-word",
    title: "(JOHN) New vocab additions are by category (A13), not per-word",
    instructions: "(JOHN) Read src/lib/coach/vocabulary.ts and confirm FEELING_AS_JUDGMENT_ADJECTIVES is exported as its own named category, distinct from PEJORATIVES_FOR_THINGS. Confirm the docstring explains the structural distinction (quality-of-thing vs speaker-emotional-impact-projected-as-property).",
    expected: "FEELING_AS_JUDGMENT_ADJECTIVES is a top-level export with ~40 entries grouped by sub-shape (irritation, exhaustion, frustration, stress, confusion, etc.). Per A13, the discipline is: when the same shape recurs, name the CATEGORY once at the right altitude rather than patching per-word. 'thats annoying' was the trigger; the category was the missing space.",
    assignee: "john",
  },
  {
    id: "diagnose-engine-renders",
    title: "Living Diagnosis 7-step engine renders",
    instructions: "Visit /dashboard/diagnose.",
    expected: "Seven steps visible: Data-as-Asset · Retrospective · Outside View · Understanding Gate · Ripple Trace · Decide · Close the Loop. Each shows status (advance allowed / gate not cleared / etc.).",
    assignee: "partners",
  },
  {
    id: "problem-awaiting-evidence",
    title: "Awaiting Evidence panel shows when below Gate",
    instructions: "Visit /dashboard/problems with few or no signals accumulated.",
    expected: "AwaitingEvidence panel: lock icon, 'Awaiting evidence' headline, explanation referencing Understanding Gate · §3.2, hint on what would unblock it.",
    assignee: "partners",
  },
  {
    id: "resolution-create",
    title: "Create a resolution",
    instructions: "Visit /dashboard/resolutions. Click New resolution. Link to a problem (if any). Submit.",
    expected: "Resolution appears in list with status open or held.",
    assignee: "partners",
  },

  // ─── Settings ──────────────────────────────────────────────────
  {
    id: "settings-password-change",
    title: "Change password works",
    instructions: "Visit /dashboard/settings. Change password section. Enter new password twice. Save.",
    expected: "Confirmation message. Sign out + sign in with new password works.",
    assignee: "partners",
  },
  {
    id: "settings-llm-provider",
    title: "LLM provider configurable",
    instructions: "(JOHN) On /dashboard/settings, switch LLM provider. Trigger an AI feature (Summarize / Guide).",
    expected: "AI features use the newly-selected provider without restart.",
    assignee: "john",
  },

  // ─── Maintenance (John) ────────────────────────────────────────
  {
    id: "maint-npm-check",
    title: "npm run check passes locally",
    instructions: "(JOHN) From repo root, run `npm run check`.",
    expected: "Typecheck + lint + theme:audit (0 leaks) + rls:audit (0 gaps) + 50/50 unit tests all green.",
    assignee: "john",
  },
  {
    id: "maint-chain-integration",
    title: "Chain integration test passes",
    instructions: "(JOHN) Run `npm run test:chain`.",
    expected: "3/3 chain integration tests pass against the live Supabase.",
    assignee: "john",
  },
  {
    id: "maint-rls-audit",
    title: "RLS audit shows 0 gaps",
    instructions: "(JOHN) Run `npm run rls:audit`.",
    expected: "Every RLS-enabled table is covered or documented. 0 missing policies. 31 allowlisted omissions.",
    assignee: "john",
  },
  {
    id: "maint-migrations-applied",
    title: "Migration 0019 applied to live DB",
    instructions: "(JOHN) Check Supabase that chat_topics has coach_enabled column.",
    expected: "coach_enabled boolean not null default false exists. Backfilled to false for all existing rows.",
    assignee: "john",
  },
  {
    id: "maint-vercel-build",
    title: "Vercel build succeeds + deploy is live",
    instructions: "(JOHN) After latest push, check Vercel dashboard.",
    expected: "Build green. Latest commit deployed at team-pilot-iota.vercel.app. No 500s on the deployed instance.",
    assignee: "john",
  },
];

console.log(`Authored ${items.length} items.`);
console.log(
  `Assignees: ${items.filter((i) => i.assignee === "john").length} john / ${items.filter((i) => i.assignee === "partners").length} partners`
);

const patch = await fetch(
  `${SUPA_URL}/rest/v1/smoke_test_versions?id=eq.${VERSION_ID}`,
  {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      label: "Comprehensive verification — 2026-06-12 (in-thread Decision Dialogue added)",
      items,
    }),
  }
);

if (!patch.ok) {
  console.error("PATCH failed:", patch.status, await patch.text());
  process.exit(1);
}

const data = await patch.json();
console.log(
  `✓ Updated version ${VERSION_ID}: ${data[0].items.length} items, label "${data[0].label}"`
);
console.log(
  `Company: ${COMPANY_ID === data[0].company_id ? "ELOSTATE matches" : "WARNING mismatch"}`
);
