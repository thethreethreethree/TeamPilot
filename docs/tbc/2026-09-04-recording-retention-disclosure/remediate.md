# REMEDIATE — recording retention and deletion on the privacy page

## F1 — the policy carried a claim about the codebase that was false

**Fixed here.** The note saying the two facts "could not be read out of the code" is gone, replaced by four bullets
that state the rule and are each traceable to the file implementing it. The file header now records what actually
happened — that the earlier note was a claim made without opening the file — so the next author inherits the
lesson rather than the conclusion.

**Gate or promise? A promise, and deliberately so.** A check that greps the policy whenever the cron changes would
fire on any edit to a 500-line route, and would pass happily if someone wrote the wrong number in both places. The
precise form of this check is "does the policy describe the system", which is not mechanically decidable — A33's
case for prose being the honest choice rather than the lazy one.

## F2 — the founder's stated policy and the running system disagree

**Not fixed here, and not fixable here.** The page states behaviour, which is correct and is what a privacy policy
must do. The disagreement is a fact the founder needs:

- nobody can delete a specific recording — there is no endpoint, for anyone;
- a representative can already exempt their own recording from deletion via `save-recording`, which is *more*
  control than the stated policy describes, not less.

**Surfaced on the founder's decision board with a recommendation**, and repeated in closure.md so it is not carried
only in a conversation. Making the stated policy true is a separate build: an endpoint, an authorisation check, the
storage removal, and a control on the web.

## Nothing was remediated by weakening a check

No gate, test or rule was changed to make this pass. `tbc:freshness` refused the first commit attempt — correctly,
because the change touched an enforced path with no build directory — and the answer was to write this build, not
to exempt the path.
