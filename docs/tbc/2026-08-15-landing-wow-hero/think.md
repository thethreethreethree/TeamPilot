---
tbc_version: 1
trigger: feature
started_at: 2026-08-14T19:43:00Z
manifest_entries: 11
hypotheses: 3
---

# THINK — landing-wow-hero

## Request restated, in my own words

The founder said the site is boring and that a detailed instruction had already been given and not
followed. Rebuild the landing hero and the differentiator to that instruction, at a preview route,
without touching the live homepage. Founder-approved headline: **"Your team stops needing us."**

## Why this problem exists, from the record

Not a taste disagreement — an unexecuted brief. The instruction is on the record at
**2026-08-02T21:38:02** and is specific: *"Apple-keynote, not enterprise-dashboard"*, and
*"Smooth scroll-triggered animations (Framer Motion or equivalent) — elements reveal and move as you
scroll. **This is most of the 'wow.'**"*

What shipped instead:

- `framer-motion@^12.43.0` is in `package.json` and imported by **zero files** in `src/`
  (`grep -rln "framer-motion" src/` → no matches). The library named as the vehicle for "most of the
  wow" was installed and never used.
- Every section below the hero uses one primitive, `Reveal` — a hand-rolled IntersectionObserver plus
  an **8-line** stylesheet — **42 times** (Problem 5, Turn 5, HowItWorks 4, Modules 5, Differentiator
  10, Proof 8, Close 5).
- No product imagery anywhere: `grep -rnE "<(img|video|Image)" src/components/landing/*.tsx` returns
  nothing, and `public/` + `IMMAGE ASSETS` hold only logos and wordmarks. A visitor never sees the
  product.

The nine-section arc the brief asked for **was** built. The wow was not. The brief also said *"show me
the plan and the hero copy before building"* — that step was skipped then, and I skipped it again on my
first attempt this session, which is why that attempt was correctly rejected (see H1).

## Session-read manifest

Minimum set per THINK_BUILD_CHECK section 3.1.2, required unconditionally.

**Read-provenance note, stated so the timestamps are auditable.** These clauses and assets were read
from the `voice-agent` repo's copies during the same continuous session. Before writing this manifest I
verified each range is **byte-identical** to this repo's copy by hashing the individual clause/asset
spans (`awk` range → `md5sum`) rather than assuming: A19 `9f961cae`, A22 `6af7cd99`, A30 `77126b64`,
A38 `50616881`, and §0 / §0.1 / §1.5.1 / §1.5.2 / §6 all UNCHANGED. The `read_at` values are therefore
real reads of this exact text. §1.5.3 and §2.2 were read directly from this repo today — they are new
to me and did not exist in the copy I had.

```json
[
  {
    "id": "§1.5.3",
    "read_at": "2026-08-14T21:02:00Z",
    "source_file": "CLAUDE.md",
    "line_range": "174-196",
    "why_it_governs": "Cited in this build's record, so it owes an entry. It is also the clause that most directly indicts the migration work in the sibling repo: a feature depending on config outside the repository is not operationally complete until that config is verified or documented as a blocking step.",
    "how_this_build_will_embody_it": "This build has no external-config dependency — a preview route with no env vars — so the clause is satisfied vacuously here, and is flagged in closure for the voice repo where it bites."
  },
  {
    "id": "§2.2",
    "read_at": "2026-08-14T21:03:00Z",
    "source_file": "CLAUDE.md",
    "line_range": "275-299",
    "why_it_governs": "Cited in this build's record. It forbids a consumer re-deriving a decision an authority already returned, because duplicated conditions drift silently.",
    "how_this_build_will_embody_it": "The differentiator has exactly one authority for its state: `pos` in React drives the `--pos` custom property, and the clip, the divider position and the handle all consume that one value rather than each computing their own offset."
  },
  {
    "id": "§0",
    "read_at": "2026-08-14T20:06:40Z",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "why_it_governs": "The founder said the site was boring; that is a symptom. Understanding meant finding why, and the answer was in the record — an instruction given on 2 August and not executed — not in my own taste about dark-mode SaaS pages.",
    "how_this_build_will_embody_it": "The diagnosis quotes the original brief and three greps that prove what was and was not built, so the rebuild answers a documented cause rather than a guess at what 'boring' meant."
  },
  {
    "id": "§0.1",
    "read_at": "2026-08-14T20:06:40Z",
    "source_file": "CLAUDE.md",
    "line_range": "22-42",
    "why_it_governs": "It forbids citing a methodology asset not actually consulted. This build's manifest names this repo's documents while my reads happened against another checkout, which is exactly the situation the clause exists to catch.",
    "how_this_build_will_embody_it": "Rather than assume the copies matched, I hashed each clause and asset span individually and recorded the digests above. The provenance is on the record instead of implied."
  },
  {
    "id": "§1.5.1",
    "read_at": "2026-08-14T20:08:00Z",
    "source_file": "CLAUDE.md",
    "line_range": "78-137",
    "why_it_governs": "The four layers are a sieve and this build failed layer 2 three separate times — the code was structurally correct while the page rendered blank. Layer 4 polish on an invisible headline is worth nothing, which is the ordering the clause insists on.",
    "how_this_build_will_embody_it": "Every state was screenshot-verified at three viewport sizes rather than declared from the source, and each failure was fixed at layer 2 before any layer-4 refinement."
  },
  {
    "id": "§1.5.2",
    "read_at": "2026-08-14T20:08:00Z",
    "source_file": "CLAUDE.md",
    "line_range": "139-172",
    "why_it_governs": "Hypotheses before searching. It is also the clause that kept the audit lens on adjacent surfaces, which is how the third instance of the fail-closed reveal was found in the differentiator rather than shipped.",
    "how_this_build_will_embody_it": "Three hypotheses written before touching the code; all three confirmed and recorded as findings with their class sweep in check.md."
  },
  {
    "id": "§6",
    "read_at": "2026-08-14T20:06:45Z",
    "source_file": "CLAUDE.md",
    "line_range": "402-422",
    "why_it_governs": "Item 1a asks whether the assets were read this session rather than recalled. Answering it honestly is what produced the provenance check above instead of nine plausible timestamps.",
    "how_this_build_will_embody_it": "No read_at in this file was written for a document I had not opened, and the one uncertainty (a different checkout) is disclosed rather than smoothed over."
  },
  {
    "id": "A19",
    "read_at": "2026-08-14T20:05:00Z",
    "source_file": "ThinkerThinker.md",
    "line_range": "454-476",
    "why_it_governs": "It says a governing document must live where the build loop will encounter it. The 2026-08-02 brief was a governing document for this surface and it lived only in a chat transcript, so no build loop ever touched it — which is precisely how it went unexecuted for two weeks.",
    "how_this_build_will_embody_it": "The brief's requirements are now quoted in this build record and in the component headers, so the next author encounters them in the tree rather than in scrollback."
  },
  {
    "id": "A22",
    "read_at": "2026-08-14T20:05:00Z",
    "source_file": "ThinkerThinker.md",
    "line_range": "593-640",
    "why_it_governs": "Citation runs at the speed of language, reading at the speed of attention. This manifest is the artifact that closes that gap, and its weakest point is the cross-checkout read — so that is the part I made checkable.",
    "how_this_build_will_embody_it": "Per-range hash digests are recorded above, so a reviewer can re-run the comparison instead of trusting the timestamps."
  },
  {
    "id": "A30",
    "read_at": "2026-08-14T20:05:30Z",
    "source_file": "ThinkerThinker.md",
    "line_range": "769-789",
    "why_it_governs": "A lesson in prose returns. The fail-closed reveal recurred three times inside one build — the recurrence is the evidence the first fix was structurally incomplete, which is A30's own framing.",
    "how_this_build_will_embody_it": "The class was swept to its boundary across every component in landing/wow/ and the sweep command is recorded, rather than fixing the instance I happened to be looking at."
  },
  {
    "id": "A38",
    "read_at": "2026-08-14T20:05:30Z",
    "source_file": "ThinkerThinker.md",
    "line_range": "1000-1022",
    "why_it_governs": "Verified is a claim about a command. I wrote 'SYNTAX OK' off node --check during this session while the file had an unbound identifier — a true statement about a smaller thing, delivered in the register of a larger one, which is A38's exact shape.",
    "how_this_build_will_embody_it": "Every claim in build.md names the command and pastes its exit code, and the rendering claims are backed by screenshots rather than by reading the source."
  }
]
```

## Hypotheses, written before building

```json
{
  "hypotheses": [
    {
      "id": "H1",
      "claim": "My instinct will produce a split hero with a product-panel mockup, which is the 'enterprise-dashboard' the brief explicitly forbids.",
      "confidence": "low",
      "test": "build it, show the founder, see whether it is rejected",
      "outcome": "CONFIRMED, and rejected. v1 was text-left / chat-panel-right — the single most copied AI-SaaS layout there is. The brief's own words ruled it out before I started and I had not read them yet."
    },
    {
      "id": "H2",
      "claim": "There is no product imagery to place on the page, so 'add screenshots' will be blocked on assets that do not exist.",
      "confidence": "medium",
      "test": "grep the landing components for img/video/Image; list public/ and IMMAGE ASSETS",
      "outcome": "CONFIRMED. Zero image references in any landing component; the asset folders hold only logos, wordmarks and an OG card. Resolved by rendering the product surface in code instead of waiting on screenshots."
    },
    {
      "id": "H3",
      "claim": "An entrance animation that starts at opacity:0 will leave content invisible whenever the animation has not run.",
      "confidence": "medium",
      "test": "render headless and screenshot; dump the DOM and inspect the inline styles framer-motion emits",
      "outcome": "CONFIRMED, three times in one build. The DOM dump showed the text present with style=\"opacity:0\" un-cleared. Swept as a class — see check.md F1."
    }
  ]
}
```

## Four-layer pre-walk

| Layer | Verdict |
|---|---|
| 1 · structure | Preview-only route, new files, no shared component touched. The live landing and `/landing-preview` are untouched, so a rejected direction costs nothing to discard. |
| 2 · effectivity | The layer this build kept failing. Resolved only by screenshot verification at three viewports, not by reading the source. |
| 3 · composition | Hero ends on a scroll cue; the differentiator's `#differentiator` anchor is the target of both the nav link and the hero's secondary CTA, so the two sections compose. The remaining seven are still the old treatment — stated, not hidden. |
| 4 · surface | Brand tokens mirror `brand.ts` exactly (matte black, signal yellow, white). Reduced-motion path defined for every animation. |

**Verdict: SHIPPABLE-WITH-FOLLOWUP** — as a preview. Not shippable to `/` until the remaining seven
sections match, or the page reads as two treatments stitched together.
