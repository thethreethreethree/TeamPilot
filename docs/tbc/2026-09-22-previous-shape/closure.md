# CLOSURE — the previous-shape harness

## What is true now

The three crashes that happened today cannot silently return. Reverting either hardening fails a
test that names the surface and quotes the original error.

## What it does not do, stated plainly

**It protects four cases, not a class.** Nothing sweeps the codebase for wire fields at risk, and
nothing will notice a *fifth* field added tomorrow unless someone adds a case for it. That is a
deliberate limit — a version that guessed which fields were new would either miss the one that
matters or assert against every optional property in the product — but it is a real limit and it
should not be described as a gate.

The honest claim is: **the cost of writing this test for a new field is now three lines**, and the
reason to write it is on the record where the next author will meet it. That is better than a
comment in a file that has already been fixed, which is where the first two lessons lived and is
precisely where nobody looks.

## What I am relying on that nobody named

1. **Nobody adds the case.** The harness is opt-in per field. If the next wire field ships without
   one, this build bought nothing for it. The mitigation is that the test file is named after the
   problem and sits beside the boards it protects.

2. **`cleanup()` between cases is enough isolation.** Each case mounts, is caught, and is cleaned
   up in a `finally`. A case that leaves a timer or a subscription behind would leak into the next
   one. None of the four do today.

3. **The bar is "does not throw".** A surface that renders visible nonsense — a `NaN`, an
   `undefined` printed into the DOM — passes this harness. It catches the crash, not the wrong
   render, and the wrong render is the quieter half of the same class.

## The thing worth keeping from today

Three instances of one defect in one session, and I wrote the fix for two of them before shipping
the third.

The tempting reading is carelessness. The accurate one is that **the rule was unrecallable at the
moment it applied**: when you have just edited the route, the field always exists, and nothing in
the editor, the types or the test run represents the client that loaded before the deploy.

That generalises past this bug. A rule that must be remembered at the exact moment everything
looks correct is a rule that will be missed, and the number of times you have already applied it
is not protection — it is what makes the miss surprising.

The three corrections available were: remember harder (what failed), a large refactor (correct and
disproportionate), and a test that makes the invisible state visible (this). Only the third does
not depend on recall.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build. No new source document was consulted.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser
— twenty-first consecutive build shipped from jsdom.
