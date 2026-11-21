# AMD-014 — Legal erasure: the one exception to append-only

- **Status:** RATIFIED (founder picker, 2026-11-20)
- **Ratified:** 2026-11-20
- **Author:** Claude Code agent, proposed in the RSS Phase 8 build (docs/tbc/2026-11-20-rss-p8)
- **Type:** Structural-gap fill (adds a rule for a case §3.1 does not address; narrows nothing else)

---

## Trigger (evidence — §7.2.1)

1. The Remote Sales build plan requires customer erasure (docs/rss/docs/07-BUILD-ORDER.md Phase 8: "erasure job";
   "Looked at: an erasure request for a phone number removes that customer's sessions"; reference F33.6, "Find and
   erase all data for an email address or phone number").
2. The Phase 8 build found it cannot be done under the current rule (docs/tbc/2026-11-20-rss-p8/think.md):
   customer phone numbers and emails exist only inside transcript text; transcripts are append-only, enforced in the
   database by `create rule … on delete … do instead nothing` (0070, kept by 0269); §3.1 says "Never update or
   delete" and §1 step 1 says "Nothing is discarded".
3. Consequence on the record today: erasure is "manual, by email" (gong-vs-elostate-what-it-takes-to-match.md:209).
   But a manual DELETE on those tables also does nothing (the rule rewrites it for every role), so a person asking to
   be erased cannot actually be erased without someone disabling a database rule by hand, off the record. The
   existing rule therefore produces wrong behaviour: a legal obligation the product cannot honestly meet.

## Diagnosis (§7.2.2)

§3.1 was written for the System's own reasoning record — events, signals, problems, resolutions — where deleting
history would corrupt retrospective analysis. It did not consider that some of what is stored is a third party's
personal data (a customer's words and voice on a sales call), which that person may lawfully require removed. The
rule is right about the System's record and silent about someone else's data; silence defaulted to "never delete",
which is not a choice anyone made.

## The rule this amendment adds (CLAUDE.md §3.1.1)

A person's right to have their personal data erased overrides append-only, for that data only:

1. Erasure runs only from a **filed request by a company admin**, and only after the matches have been shown to them
   and confirmed.
2. It deletes that customer's **personal data and nothing else**: recordings, transcript lines in every version, and
   stored text derived from them (AI summaries, quotes, matched phrases, the client label).
3. The **non-personal facts stay**: that a call happened, who the rep was, its scores and points — so retrospective
   analysis survives without the words.
4. **Erasure is itself append-only**: who asked, when, how many calls were erased, with the phone/email/name stored
   only as a one-way hash, so the record of the erasure does not re-store what was erased.
5. It is the **only** path that may delete these rows. No other feature may use the erasure mechanism to delete.

## Soundness gate (§7.2)

1. **Triggered by evidence.** ✓ The plan's requirement and the Phase 8 record above; structural-gap exception
   (§7.2.1) — no existing rule covers third-party erasure.
2. **Diagnosed, not preferred.** ✓ §3.1's scope (the System's record) vs third-party personal data; the database rules
   make even today's manual process impossible.
3. **Ripple-traced.** ✓ §3.1 (adds §3.1.1, the exception), §1 step 1 ("nothing is discarded" — §3.1.1 names itself as
   the only exception), §3.5 measurement (scores and resolution facts are kept, so hard metrics are unaffected), §3.4
   control/intervention data (a month-1 baseline loses only the erased calls' words, not their counts). No other
   section deletes data, so nothing else is loosened. The database keeps its delete rules; only the erasure function,
   on the record, lifts them for its own statements.
4. **Alternative-tested.** ✓ Against the two alternatives the founder was shown: "keep it manual" fails trigger 3
   (manual deletion is blocked by the same rules, so it is either impossible or off the record); "blank it out, keep
   history" leaves the words recoverable from older versions, so it is not erasure. Only this rule both erases and
   keeps a permanent record that it happened.
5. **Outside-view checked.** ✓ A reader with no stake sees a narrow, legally motivated exception with stricter
   conditions than any other write in the product (admin-only, reviewed, hashed, single path) — not a convenience.
6. **Does not soften under pressure.** ✓ It loosens append-only for one case only, under conditions that are themselves
   enforced and recorded; it removes no friction from any other path.

## Distrust-of-evolution note (§7.5)

If, in operation, erasure is used to remove data that is not a customer's personal data (a rep's bad call, a score a
manager dislikes), that is grounds to tighten the conditions — the hashed request record makes such use visible.
