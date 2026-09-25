# REMEDIATE

### A per-file sweep cannot see a page's children

gate-or-promise: promise, and it invalidates a number I have quoted all day

Every sweep in this session has been per-file: render a route, grep THAT file, fix what it holds.
`TeamTrainingBriefPanel` is mounted by `/training` and lives somewhere else, so it was never in any
of them.

**The promise: the unit of a sweep is the RENDER TREE, not the file.** Before declaring a route
swept, list what it mounts and sweep those too — `grep -oE "<[A-Z][A-Za-z]+" page.tsx` is enough to
get the list.

**And the consequence for the counts:** "nine sites in `/settings`" and "six in `/training`" are
counts of FILES, and I have been reporting them as counts of SCREENS. They are not the same number
and the second is the one that matters.

### An exact-string replace is a silent no-op when the string is one step off

gate-or-promise: promise

Every fix today replaced `border border-white/[0.07] bg-white/[0.02]`, chosen because it is the
deck kit's exact string. `bg-white/[0.03]` is the same defect, the same intent, a different
hundredth — and the replace passed over it without a word.

**The promise: fix this class by PATTERN, not by string.** `bg-white/\[0\.0\d\]` costs nothing more
to write and cannot miss by an alpha step. An exact-string edit is safe when the string is a token;
it is a trap when the string is one sample of a family.

This is also why the per-file counts have been believable and wrong: a grep for the exact string
returns 0 for a file that is full of the defect.

### A selected state marked only by a white wash

gate-or-promise: promise

`bg-white/10` on the selected period segment. Fifth instance of this exact shape today — after the
Macro Mode switch, the roleplay persona cards, the "Solid" band chip, and the leaderboard's own-row
highlight.

**The promise, now with five instances behind it: a SELECTED state needs a token, never a white
wash.** The failure is worse than an invisible border, because an invisible border loses a line and
an invisible selection loses the answer to "which one is on".

### Providers that throw, and a capture that renders nothing

gate-or-promise: promise

`useTheme` and `useToast` throw deliberately outside their contexts, and the throw unmounts the
tree — so the capture came back as one empty `<div>`.

**The promise: when a capture renders nothing, find out WHY before adding a provider.** Both were
verified against `layout.tsx` before being worked around. The failure mode of skipping that check
is wrapping a genuine production crash in enough scaffolding to make it photograph cleanly, and
then reporting the screen as fine.
