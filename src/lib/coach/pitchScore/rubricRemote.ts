import type { RubricBonus, RubricElement, RubricViolation } from "./rubric";

/**
 * The phone & video pitch rubric — DRAFT (decision D6). Transcribed line by line from docs/rss/REMOTE-RUBRIC-DRAFT.md,
 * which the founder is reviewing. NOT USED FOR SCORING until REMOTE_RUBRIC_APPROVED (rubricRegistry.ts) is set on
 * approval; until then every call is scored with the door rubric, as today.
 *
 * IDS. An element or bonus that is unchanged — or whose label is unchanged and only its "what counts" wording adapts —
 * keeps the door id, so patterns and comparisons across both rubrics line up. A swapped item, or one whose LABEL
 * changes, gets a new id, so a label lookup by id can never show the door wording on a remote score.
 *
 * Same six sections and weights as the door rubric (sums asserted in __tests__/rubricRemote.test.ts).
 */
export const REMOTE_RUBRIC_VERSION = "attfiber-remote-v1" as const;

export const REMOTE_ELEMENTS: readonly RubricElement[] = [
  // Introduction — 12
  { id: "intro.reasonForCall", section: "introduction", label: "Reason for the call", points: 3, whatCounts: "A clear, specific reason in the first 20 seconds (fiber just became available at their address)" },
  { id: "intro.who", section: "introduction", label: "Who and what", points: 3, whatCounts: "AT&T Fiber, connecting the neighbors" },
  { id: "intro.newAtAddress", section: "introduction", label: "What's new at their address", points: 3, whatCounts: "Fiber is live / old lines replaced where they live" },
  { id: "intro.permissionAgenda", section: "introduction", label: "Permission and agenda", points: 3, whatCounts: "Asks for a few minutes and says what the call will cover" },

  // Discovery — 16
  { id: "disc.usage", section: "discovery", label: "Internet usage", points: 4, whatCounts: "Asked, with a follow-up on the answer" },
  { id: "disc.currentSpeeds", section: "discovery", label: "Current speeds", points: 2, whatCounts: "Asked before the speed test" },
  { id: "disc.guidedSpeedTest", section: "discovery", label: "Guided speed test", points: 4, whatCounts: "Walks them through running it on their own device and waits for the number; calling the number first is required for the full 4" },
  { id: "disc.currentBill", section: "discovery", label: "Current bill", points: 3, whatCounts: "Got a dollar figure" },
  { id: "disc.painAmplifier", section: "discovery", label: "Pain amplifier", points: 3, whatCounts: "Made the customer feel the cost over time" },

  // Consulting — 14 (unchanged)
  { id: "cons.sharedVsDedicated", section: "consulting", label: "Shared vs. dedicated", points: 4, whatCounts: "Why current service slows down and fiber does not" },
  { id: "cons.hotButtons", section: "consulting", label: "Hot buttons", points: 4, whatCounts: "Pitch tied back to the customer's usage answers" },
  { id: "cons.checklistSpeed", section: "consulting", label: "Checklist: speed", points: 2, whatCounts: "Current speed vs. fiber speed" },
  { id: "cons.checklistPrice", section: "consulting", label: "Checklist: price", points: 2, whatCounts: "Current bill vs. new price" },
  { id: "cons.checklistEquipment", section: "consulting", label: "Checklist: equipment", points: 1, whatCounts: "Equipment included" },
  { id: "cons.checklistInstall", section: "consulting", label: "Checklist: install", points: 1, whatCounts: "Install fee waived" },

  // Close — 15
  { id: "close.qualification", section: "close", label: "Catch: qualification", points: 3, whatCounts: "Credit check framed; customer confirms they pay on time" },
  { id: "close.deposit", section: "close", label: "Catch: deposit", points: 3, whatCounts: "Deposit framed as going toward the first bill" },
  { id: "close.simple", section: "close", label: "Simple close", points: 3, whatCounts: "Reserving the tech slot, with demand urgency" },
  { id: "close.options", section: "close", label: "Options close", points: 3, whatCounts: "Morning vs. afternoon choice" },
  { id: "close.enrollOnCall", section: "close", label: "Into enrollment, on the call", points: 3, whatCounts: "Moves straight to enrolling while still on the line — not \"I'll send you a link\"" },

  // Transitions — 8 (unchanged)
  { id: "trans.introToDiscovery", section: "transitions", label: "Intro to Discovery", points: 2, whatCounts: "A bridge such as \"let's see if this even makes sense\"" },
  { id: "trans.discoveryToConsulting", section: "transitions", label: "Discovery to Consulting", points: 2, whatCounts: "Pivot from the customer's numbers into the explanation" },
  { id: "trans.consultingToClose", section: "transitions", label: "Consulting to Close", points: 2, whatCounts: "Checklist tie-down into the catches" },
  { id: "trans.closeToQualify", section: "transitions", label: "Close to Qualify", points: 2, whatCounts: "Time slot locked, then straight into customer info" },

  // Delivery — 35 (labels unchanged; tone and pace wording adapted for a call)
  { id: "deliv.objectionHandling", section: "delivery", label: "Objection handling", points: 8, whatCounts: "Acknowledge, isolate, answer, return to the close" },
  { id: "deliv.talkListen", section: "delivery", label: "Talk / listen balance", points: 7, whatCounts: "Customer gets real airtime" },
  { id: "deliv.tone", section: "delivery", label: "Tone and certainty", points: 7, whatCounts: "Confident and conversational; on a call the voice carries everything, so energy drops and audible script-reading count against it" },
  { id: "deliv.questionQuality", section: "delivery", label: "Question quality", points: 5, whatCounts: "Open questions and follow-ups beyond the scripted three" },
  { id: "deliv.spokenYes", section: "delivery", label: "Spoken \"yes\" at hinge moments", points: 4, whatCounts: "Pauses for agreement instead of rolling through" },
  { id: "deliv.pace", section: "delivery", label: "Pace", points: 4, whatCounts: "Not rushed; no dead air (silence over ~5 seconds with nobody speaking)" },
] as const;

export const REMOTE_BONUSES: readonly RubricBonus[] = [
  { id: "bonus.decisionMakerJoins", label: "Decision maker joins the call", points: 5, detectionNotes: "The other decision maker comes onto the call" },
  { id: "bonus.directv", label: "Pitches DIRECTV", points: 5, detectionNotes: "An actual pitch, not a passing mention" },
  { id: "bonus.wireless", label: "Pitches AT&T Wireless", points: 5, detectionNotes: "An actual pitch, not a passing mention" },
  { id: "bonus.adt", label: "Pitches ADT", points: 5, detectionNotes: "An actual pitch, not a passing mention" },
  { id: "bonus.referralNamed", label: "Referral with a name", points: 5, detectionNotes: "Customer names a friend or neighbor to contact" },
  { id: "bonus.nonDecisionMakerSave", label: "Non-decision-maker save", points: 4, detectionNotes: "Books a confirmed time with the decision maker" },
  { id: "bonus.icebreaker", label: "Icebreaker / tactical empathy", points: 3, detectionNotes: "Genuine personal connection before the pitch" },
  { id: "bonus.laughs", label: "Customer laughs", points: 3, audioInferred: true, detectionNotes: "Once per pitch" },
  { id: "bonus.pullsUpBill", label: "Customer pulls up their bill or account", points: 3, detectionNotes: "Customer opens their bill, app, or account during the call" },
  { id: "bonus.hardFollowUp", label: "Hard follow-up set", points: 3, detectionNotes: "Exact time, confirmed. \"Maybe like 6:00\" does not qualify" },
  { id: "bonus.localProof", label: "Local proof with real names", points: 2, detectionNotes: "Named neighbors, streets or local customers — \"people in your area\" does not count" },
  { id: "bonus.painOwnWords", label: "Customer states the pain in their own words", points: 2, detectionNotes: "Customer, not the rep, describes the problem" },
  { id: "bonus.buyingQuestions", label: "Buying questions", points: 2, repeatable: true, maxTotal: 6, detectionNotes: "e.g. \"When can you install?\", \"Is there a contract?\", \"What about my TV?\"" },
] as const;

/** Violations are the door rubric's, unchanged (the draft keeps all five). Re-exported here so a rubric is one bundle. */
export type RemoteViolations = readonly RubricViolation[];
