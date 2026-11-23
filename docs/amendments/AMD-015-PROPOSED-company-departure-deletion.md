# AMD-015 — Company departure: deleting a former customer's data (PROPOSED)

- **Status:** PROPOSED — awaiting founder ratification. Nothing is built or deleted under this text until it is ratified.
- **Proposed:** 2026-11-23 (founder picker 2026-11-23: "Draft amendment")
- **Author:** Claude Code agent
- **Type:** Structural-gap fill (adds a rule for a case §3.1 and §3.1.1 do not address; narrows nothing else)

---

## Trigger (evidence — §7.2.1)

1. The Gong comparison ledger grades "Post-termination data retention and deletion" (F36.36) LACK: "Per-customer
   erasure exists; nothing deletes a company's data after its contract ends." Gong publishes that it deletes a
   customer's data after their contract ends.
2. The product cannot do it. Every company-owned table that holds the System's record or call content is append-only,
   enforced in the database by `create rule … on delete … do instead nothing` (0070 onward; 243 migrations name
   `company_id`). §3.1 says "Never update or delete"; §3.1.1 lifts that only for one customer's personal data, on an
   admin's request, through `rss_erase_sessions` and its two extensions (0322 day plans, 0323 prospects).
3. The privacy page's "Retention and deletion" section (src/app/privacy/page.tsx:337) promises redaction of a person's
   identifiers and says deletion beyond that is "discuss[ed]" on request. It says nothing about what happens when a
   company leaves. So today a departed company's recordings, transcripts, notes and pipeline stay forever, and the
   only way to remove them would be someone disabling database rules by hand, off the record — the same failure
   AMD-014 found for customer erasure.

## Diagnosis (§7.2.2)

§3.1 protects the System's reasoning record so retrospective analysis stays honest. That reason holds while a company
is a customer: its own history is what the System learns from on its behalf (§3.4, §3.6). When the contract ends, the
company is no longer served by that history, and the vendor has no right of its own to keep another company's call
recordings, transcripts and business data indefinitely. §3.1 is silent about a company leaving; silence defaulted to
"keep everything forever", which no one chose and which a customer contract will usually forbid.

## The rule this amendment would add (CLAUDE.md §3.1.2)

When a company's contract ends, its data is deleted on a recorded schedule, after it has been offered back to them:

1. **Started only by a vendor founder** recording the contract's end date for that company in the vendor back office —
   never automatically from a payment failure or inactivity. The company's admins are told the date and what will
   happen.
2. **Export first.** Until the deletion date the company's admins can download a full export of their data (calls,
   transcripts, scores, notes, pipeline, tasks). The deletion date is the contract end plus a grace period
   (**founder to set: 30 or 90 days**). A founder can cancel or move the date until it runs (a reinstated contract).
3. **What is deleted:** every row the company owns (keyed to its `company_id`) and every stored file under its storage
   prefix — recordings, transcripts in every version, AI outputs, notes, pipeline, tasks, chat, settings, people's
   profiles in that company.
4. **What stays:** only the vendor's own records the law requires it to keep (invoices and payments in the vendor back
   office), and the record of the deletion itself (below). No anonymised copy, aggregate or benchmark built from the
   company's data is kept unless that company's contract explicitly allowed it.
5. **The deletion is itself append-only:** which company (its id and name as the vendor's customer record), who set the
   date, when it ran, and how many rows and files were removed per table — no content.
6. **Single path.** Only this scheduled job, for a company whose recorded deletion date has passed, may lift the
   append-only rules for company-wide deletion. It cannot be used for part of a company, a person, or a period.

## Soundness gate (§7.2)

1. **Triggered by evidence.** ✓ The ledger gap (F36.36), the database rules that make deletion impossible on the record,
   and the privacy page's silence. Structural-gap exception (§7.2.1): no existing rule covers a departing company.
2. **Diagnosed, not preferred.** ✓ §3.1's purpose (the System's reasoning for a current customer) does not extend to a
   former customer's data; the default was never decided.
3. **Ripple-traced.** ✓ §3.1 and §1 step 1 ("nothing is discarded") gain a second named exception; §3.1.1 is unchanged
   (per-person erasure stays the only deletion while a company is a customer); §3.4–§3.6 and §4 lose nothing they rely
   on for a current customer (a departed company's data no longer informs anything). The vendor back office (CRM,
   billing) is unaffected except for the deletion record. Invariant 38 (one path into erasure) would gain this job as a
   named second path, documented like 0316/0322/0323.
4. **Alternative-tested.** ✓ Against "export only, keep the data" (fails the trigger: indefinite retention of another
   company's recordings) and "manual deletion on request" (impossible on the record, as AMD-014 found). Only a
   scheduled, recorded deletion after an export both returns the data and removes it.
5. **Outside-view checked.** ✓ A reader with no stake sees a narrow exception with stricter conditions than any other
   write: founder-started, dated, announced, exportable, cancellable, single path, recorded.
6. **Does not soften under pressure.** ✓ It loosens append-only only for companies that have left, and only after
   notice and export; it removes no friction anywhere else.

## Decisions for the founder before ratifying

- The grace period after the contract ends: **30 days** or **90 days**.
- Whether contracts may allow keeping anonymised aggregates (default in this text: no).
- Whether a company may ask for earlier deletion than the date (default in this text: yes, by the same founder step).

## Distrust-of-evolution note (§7.5)

If the job is ever used against a current customer, or a company is deleted without its admins having been told, that
is grounds to tighten the conditions; the deletion record makes both visible.
