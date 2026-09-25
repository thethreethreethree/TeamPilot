# REMEDIATE

### A count is not a finding — third instance, so it becomes a rule

gate-or-promise: promise, now with three cases behind it

| scanner | said | truth | why |
|---|---|---|---|
| wrong-namespace probe | 0 | 56 | a bug in the probe |
| accent-colour scan | 18 | 5 | truncated JSX at the first `>`, inside arrow functions |
| render-tree sweep | 94 → 82 | 80 | counted `dark:` halves, then code comments |

Every one was caught by reading the members. Reading six elements took under a minute; each
scanner took longer than that to write.

**The rule: report the members, and let the count be their length.** A number produced by a tool
nobody has spot-checked is a claim about the tool. And the most dangerous of the three was the
zero, because a zero looks like good news and ends the investigation — which §1.7 names exactly:
an empty flag list is itself a suspicious finding.

### A capture drives one state and gets reported as the component

gate-or-promise: promise, and it is the session's most repeated lesson

Six occurrences today: Standard/Expert on After Pitch, three branches on Sessions, the ELO gauge
in Expert-only Analytics, status-driven Training, two tabs on Settings, and now four states on
DoorLog.

**The promise: before writing a capture, grep the component for its branch selectors** —
`isStandard`, `isManager`, `isOwner`, `state ===`, `res.status`. Each is another screen. The
version of this I wrote three builds ago said "grep for mode gates"; it did not say `state ===`,
and a state machine is the case where one component IS four screens.

### The unselected branch of a conditional

gate-or-promise: promise

`t.accent ? <card> : <white-alpha>`. The accented tile rendered correctly on both grounds and the
other three did not.

**The promise, sharpened by this one: check the branch that is NOT highlighted.** And the reason it
survived a look, which is the part worth carrying: **a missing container reads as a design choice
when something beside it has one.** Three bare numbers next to one card looks like emphasis. Four
bare numbers would have looked like a bug.

That is why the light/dark PAIR is the method and a single image is not. In dark all four had
cards, and the comparison says in one glance what the light image alone could not.

### A mock that lies about a return contract

gate-or-promise: promise

`start: vi.fn()` → `undefined` → the component's mic-denial path on every click. The comment
warning about this for the sibling function is two lines above it, and I wrote that comment.

**The promise: a stub's return shape is READ from the real function, never assumed** — and the
tell that it was not is a component that sits in its initial state no matter what you click.

### And the fixes themselves

`bg-white/\[0\.0\d\]` by pattern, not `bg-white/[0.02]` by string — applied in this build, one hour
after the build that learned it.
