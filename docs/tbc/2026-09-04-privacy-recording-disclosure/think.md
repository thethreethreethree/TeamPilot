---
started_at: 2026-09-04T07:05:58+08:00
---

# THINK — the privacy policy does not mention the recording

## Why (found while preparing the App Store submission, not by anyone reading the policy)

The owner is shipping the mobile app to Apple. App Privacy requires declaring **Audio Data**, and Apple
cross-checks that declaration against the published privacy policy. Reading `src/app/privacy/page.tsx` to answer
the questionnaire is what surfaced this.

## Understanding — three separate problems, of increasing seriousness (§0)

**1. There is no section about recording at all.** The policy uses "record" and its inflections **23 times**
(`grep -oic record`) and every one means *a record of events* — I first wrote "eleven" here from memory and the
count was wrong, which is a poor way to open a document about a policy being inaccurate. It never says audio, recording, microphone, or transcription. The single most sensitive
thing the product does is absent from the document that exists to describe what the product does.

**2. A processor that receives the audio is undisclosed.** `transcribeWithDiarization` in
`src/lib/care/voice/elevenlabs.ts` sends recorded conversations to **ElevenLabs** for speech-to-text — used by
`sales-session/[id]/retranscribe`, `sales-session/[id]/auto-recover` and the door-log worker. "Third-party services
we use" lists Supabase, Vercel, Anthropic and Web Push. ElevenLabs is not there. A processor that receives audio of
two people talking is not an omission to leave for a later revision.

**3. A sentence in the policy is now false.** The Anthropic entry says:

> *"We do not send any data through Anthropic that you haven't already authored in the product."*

That was true when the Coach analysed text a user typed. Sales Coach sends the **transcript of a recorded
conversation** to `dissectCoachV5`, and that transcript contains **what the prospect said**. The prospect has
authored nothing in this product; they were spoken to at their own front door. The sentence is not merely
incomplete, it asserts something untrue.

## The person this is actually about

The policy's own backbone is *"no shadow read: what the System sees about you, you see too."* It is written to the
user of the product. **The other party in a recorded sales conversation is not a user**, will never open this
product, and is the one person in the transaction who has no way to find out what happens to their voice.

That is not something a privacy policy can fix on its own — lawful recording is the representative's obligation
where they work — but a policy that is silent about them cannot even be checked.

## Four layers (§1.5.1)

1. **Structure.** Additive: one new `<Section>`, one new processor entry, one corrected paragraph. The file's own
   voice and markup are matched rather than a new style introduced into a legal document.
2. **Operational.** Apple's App Privacy answers and this page now describe the same product.
3. **The person.** A representative can find out who can hear their recordings. Someone reading on behalf of the
   other party can find out that ElevenLabs and Anthropic receive their voice and their words.
4. **Finish.** The header comment records what changed and — more importantly — what was deliberately NOT written.

## What I will NOT write, because I cannot read it out of the code (§3.2.1)

**How long audio is retained, and whether a representative can delete a recording themselves.**

The existing "Retention and deletion" section speaks to the append-only event chain, which is a different question
from "how long is the audio file kept in storage". Nothing in the repository states an audio retention period. A
privacy policy is the wrong place to guess: an invented number is a promise the business has not made, in a
document people are entitled to rely on.

Marked in the file and raised to the owner instead.

## What could go wrong, before searching (§1.5.2)

- **ElevenLabs might not actually be in the sales-session path**, only in the C.A.R.E. voice feature. Checked:
  `retranscribe/route.ts:12` and `auto-recover/route.ts:14` both import `transcribeWithDiarization` from it, and
  `coach/doorlog/worker.ts:5` imports `transcribeSpeech`. It is in the path.
- **The Anthropic sentence might already be qualified elsewhere.** Read the whole section: it is not.
- **This page might not be the live one.** It is `src/app/privacy/page.tsx` in the deployed application, the URL
  Apple will be given.

## Session-read manifest (§3.1.2 / A22 / A35)

Re-opened for THIS build. A first pass piped every clause to /dev/null — the motion of a read with the reading
removed — and was redone rather than recorded. That is the failure A22 describes, committed while writing A22's
own manifest, so it is written down instead of quietly fixed.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "Understand before solving. The understanding here is what the code actually sends to whom — not what the policy assumes it sends.",
    "how_this_build_will_embody_it": "think.md traces the audio to ElevenLabs and the transcript to Anthropic by naming the importing files, before a word of the policy changed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All three governing documents were re-opened at the ranges below. An earlier attempt piped them to /dev/null, which is the motion of a read without the reading; that was redone." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "L3 is the reason this is not a paperwork task: the person whose voice is recorded is not a user of the product and has no other way to find out where it goes." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-152", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "Think first about how this could be wrong, then search to confirm.",
    "how_this_build_will_embody_it": "Three hypotheses written before searching — ElevenLabs might be C.A.R.E.-only, the Anthropic sentence might be qualified elsewhere, this page might not be the live one. All three checked; the first two were wrong in my favour and the third held." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-452", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "The checklist, item 6: explain the WHY, not just the WHAT.",
    "how_this_build_will_embody_it": "The header comment in the policy file records why each of the three changes was made, so the next reader is not left guessing whether the Anthropic edit was a softening or a correction." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "Citing a label without its content is the canonical failure.",
    "how_this_build_will_embody_it": "Every asset below was opened at its range in this build's window." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-542", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "Same name, different feature — what a within-module audit cannot see.",
    "how_this_build_will_embody_it": "'What we send to a third party' spans the coach routes, the door-log worker and the policy page. Reading any one of them alone leaves the omission invisible." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "This build's reads are its own, and the first attempt at them was discarded for being a motion rather than a read." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-703", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "A pattern match is a suspect; confirm the shape manifests.",
    "how_this_build_will_embody_it": "'The policy does not mention audio' was a suspect until the processor was traced to a named import in three route files." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "A lesson in prose returns unless a gate catches it.",
    "how_this_build_will_embody_it": "Declined here, with the reason in remediate.md: this IS the prose, and a gate that checked a legal document against the code would be the noisy kind A33 forbids." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "The seam between the system and what a person can see.",
    "how_this_build_will_embody_it": "The seam here is the policy itself: the code was correct and the document describing it was not, which is the same shape one level up." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-866", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "A gate must be PRECISE or not exist.",
    "how_this_build_will_embody_it": "No gate is invented for 'the policy matches the code'. The honest answer is a documented review trigger, not a check that would fire on every unrelated edit." },
  { "id": "A35", "source_file": "ThinkerThinker.md", "line_range": "900-912", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "The hook charges for the citation, not the reliance.",
    "how_this_build_will_embody_it": "The minimum set is present whether or not the prose quotes it." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-936", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "Read the residual from the top of the confidence ranking.",
    "how_this_build_will_embody_it": "The highest-confidence entry was opened before closure." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T07:09:04+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the canonical gate, and the one number I asserted from memory — how often 'record' appears — was recounted with grep and corrected from eleven to 23." },
  { "id": "§3.1.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "119-160", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Defines this manifest and requires an in-session read_at.",
    "how_this_build_will_embody_it": "Re-opened after this build's started_at, not carried from the earlier builds this session." },
  { "id": "§3.2.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "223-228", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Deviating is a violation; if a deviation is necessary, flag BEFORE acting.",
    "how_this_build_will_embody_it": "The retention period and self-service deletion are deliberately NOT written, and that is flagged in the file and in think.md rather than reported afterwards." },
  { "id": "§3.2.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "229-262", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Write path and read path, both asserted.",
    "how_this_build_will_embody_it": "The read path is a published web page; build.md names the URL a person opens." },
  { "id": "§3.2.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "263-292", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Run the canonical command by name.",
    "how_this_build_will_embody_it": "check.md leads with npm run check and its exit code." },
  { "id": "§3.3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "298-301", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Audit the built files, not the intent.",
    "how_this_build_will_embody_it": "The policy was read end to end, including the sections I did not change, which is how the false Anthropic sentence was found." },
  { "id": "§3.3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "302-313", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "A CHECK with no cross-module pass is incomplete.",
    "how_this_build_will_embody_it": "The pass inventories every third party that receives conversation data and checks each against the policy's list." },
  { "id": "§3.3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "314-330", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Name the class by its root shape; record the command.",
    "how_this_build_will_embody_it": "The class is 'a document that describes the system, drifting from the system'. Swept with the command in check.md." },
  { "id": "§3.3.4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "331-345", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Gate or promise, per fix.",
    "how_this_build_will_embody_it": "All three are promises, declined with reasons — one of them names a review trigger that is cheaper and more honest than a gate." },
  { "id": "§3.3.5", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "347-352", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "Never report clean for something not inspected.",
    "how_this_build_will_embody_it": "The two things not written are named, and the legal review the file's own header already demands is restated rather than quietly assumed satisfied." },
  { "id": "§4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "418-457", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "The residual is a queue read from the top of the confidence ranking.",
    "how_this_build_will_embody_it": "Three entries; the high-confidence one opened before closure." },
  { "id": "§6.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "515-528", "read_at": "2026-09-04T07:09:19+08:00",
    "why_it_governs": "The gate that reads this manifest.",
    "how_this_build_will_embody_it": "Ranges checked to contain their ids before the block was written." }
]
```
