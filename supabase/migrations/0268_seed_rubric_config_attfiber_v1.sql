-- 0268_seed_rubric_config_attfiber_v1.sql
--
-- THE ROW EVERY PITCH SCORE NEEDED, AND NO MIGRATION EVER CREATED (found 2026-09-29).
--
-- pitch_scores.rubric_version is a foreign key to rubric_config(version) (0252). The scorer stamps every score
-- "attfiber-v1" (rubric.ts RUBRIC_VERSION). No migration inserted that row, and nothing READS rubric_config (the
-- rubric is served from rubric.ts) — so nothing noticed until a save needed it. In production the table was
-- empty and pitch_scores had never held a row: every score ever attempted was refused by store_pitch_score with
-- "violates foreign key constraint pitch_scores_rubric_version_fkey" — 164 in three days after the DeepSeek
-- top-up, each an AI grading paid for and discarded. Recordings, the leaderboard, best pitches, milestones and
-- Pattern Interrupt have been empty since they shipped.
--
-- GENERATED from rubricConfigRow() in src/lib/coach/pitchScore/rubric.ts — do not hand-edit. A test
-- (rubricConfigMigration.test.ts) fails if this file and the code disagree, so the rubric cannot become two
-- hand-kept copies (§2.2). A NEW rubric version is a NEW migration, never an edit: scores reference this row.
--
-- company_id NULL = the shared default rubric (0252's select policy lets every company read it).
-- Re-runnable (A12): on conflict do nothing — an existing row is never overwritten.

insert into rubric_config (
  version, company_id, label, elements, bonuses, violations,
  base_max, bonus_cap, qualifying_min_base, audio_confidence_threshold, is_active
) values (
  'attfiber-v1',
  null,
  'AT&T Fiber Pitch Scoring Rubric v1',
  $rubric$[
  {
    "id": "intro.trucks",
    "section": "introduction",
    "label": "Trucks / neighborhood notice",
    "points": 3,
    "whatCounts": "Crews will be working in the neighborhood"
  },
  {
    "id": "intro.who",
    "section": "introduction",
    "label": "Who and what",
    "points": 3,
    "whatCounts": "AT&T Fiber, connecting the neighbors"
  },
  {
    "id": "intro.done",
    "section": "introduction",
    "label": "What we've done",
    "points": 3,
    "whatCounts": "Old lines out, new fiber in"
  },
  {
    "id": "intro.why",
    "section": "introduction",
    "label": "Why we're here",
    "points": 3,
    "whatCounts": "Neighbors unhappy with price and/or speed"
  },
  {
    "id": "disc.usage",
    "section": "discovery",
    "label": "Internet usage",
    "points": 4,
    "whatCounts": "Asked, with a follow-up on the answer"
  },
  {
    "id": "disc.currentSpeeds",
    "section": "discovery",
    "label": "Current speeds",
    "points": 2,
    "whatCounts": "Asked before the speed test"
  },
  {
    "id": "disc.speedTest",
    "section": "discovery",
    "label": "Speed test",
    "points": 4,
    "whatCounts": "Run live; calling the number before it appears is required for the full 4"
  },
  {
    "id": "disc.currentBill",
    "section": "discovery",
    "label": "Current bill",
    "points": 3,
    "whatCounts": "Got a dollar figure"
  },
  {
    "id": "disc.painAmplifier",
    "section": "discovery",
    "label": "Pain amplifier",
    "points": 3,
    "whatCounts": "Made the customer feel the cost over time"
  },
  {
    "id": "cons.sharedVsDedicated",
    "section": "consulting",
    "label": "Shared vs. dedicated",
    "points": 4,
    "whatCounts": "Why current service slows down and fiber does not"
  },
  {
    "id": "cons.hotButtons",
    "section": "consulting",
    "label": "Hot buttons",
    "points": 4,
    "whatCounts": "Pitch tied back to the customer's usage answers"
  },
  {
    "id": "cons.checklistSpeed",
    "section": "consulting",
    "label": "Checklist: speed",
    "points": 2,
    "whatCounts": "Current speed vs. fiber speed"
  },
  {
    "id": "cons.checklistPrice",
    "section": "consulting",
    "label": "Checklist: price",
    "points": 2,
    "whatCounts": "Current bill vs. new price"
  },
  {
    "id": "cons.checklistEquipment",
    "section": "consulting",
    "label": "Checklist: equipment",
    "points": 1,
    "whatCounts": "Equipment included"
  },
  {
    "id": "cons.checklistInstall",
    "section": "consulting",
    "label": "Checklist: install",
    "points": 1,
    "whatCounts": "Install fee waived"
  },
  {
    "id": "close.qualification",
    "section": "close",
    "label": "Catch: qualification",
    "points": 3,
    "whatCounts": "Credit check framed; customer confirms they pay on time"
  },
  {
    "id": "close.deposit",
    "section": "close",
    "label": "Catch: deposit",
    "points": 3,
    "whatCounts": "Deposit framed as going toward the first bill"
  },
  {
    "id": "close.simple",
    "section": "close",
    "label": "Simple close",
    "points": 3,
    "whatCounts": "Reserving the tech slot, with demand urgency"
  },
  {
    "id": "close.options",
    "section": "close",
    "label": "Options close",
    "points": 3,
    "whatCounts": "Morning vs. afternoon choice"
  },
  {
    "id": "close.paperwork",
    "section": "close",
    "label": "Into paperwork",
    "points": 3,
    "whatCounts": "Moves straight to qualifying without hesitation"
  },
  {
    "id": "trans.introToDiscovery",
    "section": "transitions",
    "label": "Intro to Discovery",
    "points": 2,
    "whatCounts": "A bridge such as \"let's see if this even makes sense\""
  },
  {
    "id": "trans.discoveryToConsulting",
    "section": "transitions",
    "label": "Discovery to Consulting",
    "points": 2,
    "whatCounts": "Pivot from the customer's numbers into the explanation"
  },
  {
    "id": "trans.consultingToClose",
    "section": "transitions",
    "label": "Consulting to Close",
    "points": 2,
    "whatCounts": "Checklist tie-down into the catches"
  },
  {
    "id": "trans.closeToQualify",
    "section": "transitions",
    "label": "Close to Qualify",
    "points": 2,
    "whatCounts": "Time slot locked, then straight into customer info"
  },
  {
    "id": "deliv.objectionHandling",
    "section": "delivery",
    "label": "Objection handling",
    "points": 8,
    "whatCounts": "Acknowledge, isolate, answer, return to the close"
  },
  {
    "id": "deliv.talkListen",
    "section": "delivery",
    "label": "Talk / listen balance",
    "points": 7,
    "whatCounts": "Customer gets real airtime"
  },
  {
    "id": "deliv.tone",
    "section": "delivery",
    "label": "Tone and certainty",
    "points": 7,
    "whatCounts": "Confident and conversational; no drop-off when thrown a curveball"
  },
  {
    "id": "deliv.questionQuality",
    "section": "delivery",
    "label": "Question quality",
    "points": 5,
    "whatCounts": "Open questions and follow-ups beyond the scripted three"
  },
  {
    "id": "deliv.spokenYes",
    "section": "delivery",
    "label": "Spoken \"yes\" at hinge moments",
    "points": 4,
    "whatCounts": "Pauses for agreement instead of rolling through"
  },
  {
    "id": "deliv.pace",
    "section": "delivery",
    "label": "Pace",
    "points": 4,
    "whatCounts": "Not rushed, no dead air"
  }
]$rubric$::jsonb,
  $rubric$[
  {
    "id": "bonus.inside",
    "label": "Gets inside the house or backyard",
    "points": 5,
    "audioInferred": true,
    "detectionNotes": "Inferred from audio. Counts whether the rep was invited or assumed their way in"
  },
  {
    "id": "bonus.directv",
    "label": "Pitches DIRECTV",
    "points": 5,
    "detectionNotes": "An actual pitch, not a passing mention"
  },
  {
    "id": "bonus.wireless",
    "label": "Pitches AT&T Wireless",
    "points": 5,
    "detectionNotes": "An actual pitch, not a passing mention"
  },
  {
    "id": "bonus.adt",
    "label": "Pitches ADT",
    "points": 5,
    "detectionNotes": "An actual pitch, not a passing mention"
  },
  {
    "id": "bonus.referral",
    "label": "Referral / next-door walk",
    "points": 5,
    "detectionNotes": "Customer names a neighbor or walks the rep over"
  },
  {
    "id": "bonus.nonDecisionMakerSave",
    "label": "Non-decision-maker save",
    "points": 4,
    "detectionNotes": "Firm return time plus something left behind for the decision maker"
  },
  {
    "id": "bonus.icebreaker",
    "label": "Icebreaker / tactical empathy",
    "points": 3,
    "detectionNotes": "Genuine personal connection before the pitch"
  },
  {
    "id": "bonus.laughs",
    "label": "Customer laughs",
    "points": 3,
    "audioInferred": true,
    "detectionNotes": "Once per pitch"
  },
  {
    "id": "bonus.pullsUpBill",
    "label": "Customer pulls up their bill or account",
    "points": 3,
    "detectionNotes": "Customer opens their bill, app, or account during the pitch"
  },
  {
    "id": "bonus.hardFollowUp",
    "label": "Hard follow-up set",
    "points": 3,
    "detectionNotes": "Exact time, confirmed. \"Maybe like 6:00\" does not qualify"
  },
  {
    "id": "bonus.neighborHook",
    "label": "Neighbor hook with real names",
    "points": 2,
    "detectionNotes": "Specific neighbors or addresses, not \"your neighbors\""
  },
  {
    "id": "bonus.painOwnWords",
    "label": "Customer states the pain in their own words",
    "points": 2,
    "detectionNotes": "Customer, not the rep, describes the problem"
  },
  {
    "id": "bonus.buyingQuestions",
    "label": "Buying questions",
    "points": 2,
    "repeatable": true,
    "maxTotal": 6,
    "detectionNotes": "e.g. \"When can you install?\", \"Is there a contract?\", \"What about my TV?\""
  }
]$rubric$::jsonb,
  $rubric$[
  {
    "id": "viol.rude",
    "label": "Rude, dismissive, or condescending to the customer",
    "deduction": 10,
    "flagsForReview": true,
    "trigger": "Any instance; flag for manager review"
  },
  {
    "id": "viol.talkingTooMuch",
    "label": "Talking too much",
    "deduction": 5,
    "trigger": "Rep talk share above ~75% for the full pitch, or a monologue over ~90 seconds with no customer input"
  },
  {
    "id": "viol.notEnoughQuestions",
    "label": "Not asking enough questions",
    "deduction": 5,
    "trigger": "Fewer than 3 discovery questions before the checklist"
  },
  {
    "id": "viol.talkingOver",
    "label": "Talking over the customer",
    "deduction": 2,
    "repeatable": true,
    "maxTotal": 6,
    "trigger": "Rep cuts in while the customer is mid-sentence"
  },
  {
    "id": "viol.ignoringQuestion",
    "label": "Ignoring a customer question",
    "deduction": 2,
    "repeatable": true,
    "trigger": "Customer asks something and the rep moves on without answering"
  }
]$rubric$::jsonb,
  100,
  30,
  40,
  0.8,
  true
)
on conflict (version) do nothing;
