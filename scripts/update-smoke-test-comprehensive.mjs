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
