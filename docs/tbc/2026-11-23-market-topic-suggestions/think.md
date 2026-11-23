---
started_at: 2026-11-23T20:25:17Z
trigger: Founder picker 2026-11-23 — "How should the app decide two topics are the same?" → "AI suggests, manager OKs" (residual from docs/tbc/2026-11-23-market-topic-groups).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - AI-suggested topic groups, approved by a manager

## The record

- After wording-only grouping, production still splits one meaning across labels: "pricing" (54), "monthly price"
  (10), "monthly pricing" (9), "monthly bill amount" (11), "bill amount" (7).
- 720 labels; many one-off labels name a person or a specific ("winning against jd").
- Existing AI helpers: claude.ts call() → runBrainCall; day-1 analytics helpers are controlExempt (dayPlanCoach,
  askCoachTurn) and consume the `suppressed` verdict.

## Outside view

Grouping by meaning is a judgement. A model doing it alone would over-merge ("price increase" into "pricing") and
overstate a topic. A manager doing it alone rarely happens. The founder chose the middle: the model proposes from the
company's own topics, a manager decides.

## Design

0319 market_topic_groups + market_topic_group_retirements (append-only). market.ts topicGrouper (group membership by
topicKey). marketRead.ts (shared reads). topicSuggest.ts (candidates on 2+ calls, prompt, strict parse). Routes:
topic-groups (GET/POST/DELETE), topic-groups/suggest (POST, AI). TopicGroups panel on Market for managers.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Understand before building: the production topic labels were counted (720 labels, 1,430 mentions) and the wording-only rule shipped first; what remains split is meaning, which the founder decided should be AI-suggested and manager-approved.",
    "how_this_build_will_embody_it": "The AI only proposes; a stored group exists only after a manager accepts it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T20:29:34Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Layer 3: a manager tidying topics should not lose their other suggestions when one is accepted, and Market should recount at once.",
    "how_this_build_will_embody_it": "The panel sits outside the reloading view; accept/ungroup triggers a recount."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Holistic: Market's reads move into marketRead.ts so the Market route, the suggestion route and the save check all see the same topics.",
    "how_this_build_will_embody_it": "One reader, three consumers; the Market route's behaviour is unchanged apart from applying groups."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Look past the task: a one-off topic label can be one customer's specifics, and a company-wide table is outside legal erasure.",
    "how_this_build_will_embody_it": "Only topics raised on 2+ calls can be sent to the model or saved in a group; the residual on erasure is recorded."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "Migration 0319 must be applied to production (db:apply), checked live before closure."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "One rule decides which topics count together; the screen, the save check and the suggestion list must not each decide.",
    "how_this_build_will_embody_it": "topicGrouper in market.ts is the one key; candidates() is the one 'may be grouped' rule, used by both routes."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Groups change over time; editing in place would lose what Market showed before.",
    "how_this_build_will_embody_it": "Append-only: an edit is a new group plus a retirement row; ungroup is a retirement row; DB rules refuse update/delete."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Legal erasure is the one deletion exception and reaches call-keyed tables only.",
    "how_this_build_will_embody_it": "Group members are topics on 2+ calls, not call-keyed; recorded as a residual rather than claimed covered."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Guide, don't overtake: the founder chose 'AI suggests, manager OKs'.",
    "how_this_build_will_embody_it": "Suggestions are editable (name, which topics) and inert until accepted."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Honesty: a model that invents or over-merges topics would overstate how often they come up.",
    "how_this_build_will_embody_it": "parseSuggestions drops any member not in the given list, any label used twice, any group under two; prompt tells it to leave out the unsure; a failed group read is a 500, not ungrouped counts."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "The meaning-grouping method was a decision: asked as a picker; founder chose 'AI suggests, manager OKs'."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Tests pin: one-off labels refused; invented members dropped; replace retires; accept saves only kept topics."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T20:29:34Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
