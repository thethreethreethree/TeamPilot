# REMEDIATE

### `white/N` used as a theme-neutral tone

gate-or-promise: declined

**Declined deliberately, and this is the part worth reading.**

The gate is obvious and I can write it: extend `theme-audit.mjs` with a `whiteAlpha` category
matching `(bg|text|border|ring|divide|from|to|via)-white/N`, excepting lines that also name an
intrinsically dark ground.

I measured what it would do before adding it: **256 violations across 47 files.** Shipping it
today means adding roughly 47 FILE_ALLOWLIST entries — most of them written by me, in an afternoon,
about files I have not rendered — so the check would go green on my say-so rather than on the code
being right.

A30's standard is a gate that **fails without the author's cooperation**. A gate whose first act is
47 author-written exemptions is the opposite: a check the author routed around, wearing the
appearance of rigour. Adding it would make this build look more thorough and the codebase less
honest.

**What the gate needs first** is the render pass, because only a rendered screen distinguishes
"white/10 on a fixed-dark console, correct" from "white/10 on a theme-following card, invisible".
The allowlist is then a record of things somebody looked at, which is what an allowlist is for.

**The promise until then:** `white/N` is not a neutral. On a surface whose ground follows the
theme, a border is `border-default`, a card is `bg-surface`, and a neutral dot or track is the
`ink` scale — chosen by reading what the variable resolves to in BOTH modes, not by picking
something that looks right in the one currently on screen.

### The harness could invent layout bugs

gate-or-promise: gate

`capture()` **throws** if `width` is missing and **throws** if handed a null element, and
`shoot.mjs` **exits 1** if no Chromium is found, printing the paths it tried.

All three failures are ones I hit or nearly hit within an hour of building it: a subtree rendered
without its parent flex chain showed a clipped button that was not clipped, and a tool that
silently produced no images would have read as "the surfaces are fine".

These are real gates — they fail on the author, without cooperation, and they already have.

### theme-audit answers a nearby question

gate-or-promise: promise

No fix. The script is correct about what it checks and the finding is what it does not check.

**The promise:** when a gate passes on a surface that is visibly wrong, the next question is what
the gate's categories actually ARE — read the script, not its name. `theme-audit.mjs`'s header
claims it "Exits non-zero if any theme-bound leaks remain", and that sentence is true only for the
seven categories it defines. The claim a gate makes about itself is not its coverage.

Third time today: `writer:audit` confirms every table has a writer and cannot ask whether anything
calls it; `enum:audit` audits only mirrors that opted in; this one has no concept of white.
