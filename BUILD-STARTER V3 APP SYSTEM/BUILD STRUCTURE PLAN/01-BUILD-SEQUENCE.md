# 01 — BUILD SEQUENCE

The order is not a preference. Each phase produces the constraint the next phase
needs, and skipping one means inventing that constraint ad hoc later and
retrofitting a system that was never a system.

```
0  GOVERN       run the §2 protocol, quote the clauses            (no code)
0b ARM          design-system/install.sh, then RESTART            (hooks load at session start ONLY)
1  INTAKE       DESIGN-CONTRACT.md exists and is complete         (no UI code before this)
2  DIRECTION    art direction chosen AND justified against intake
3  SCAFFOLD     Expo (RN + TS) + NativeWind, foundation/install.sh
4  TOKENS        theme.ts + NativeWind tokens, contrast-verified, fonts wired
5  DATA          on-device schema, migrations, seed — before any screen reads it
6  CORE FLOW     the one primary action, end to end on a device
7  SCREENS       remaining screens
8  HARDEN        permission-denied paths, offline, error surfaces, secure storage
9  DEVICE VERIFY real iOS AND real Android, smallest supported device
10 REVIEW        independent audit
11 EAS BUILD     signed release builds, both platforms
12 OFF-STORE     TestFlight + Play internal, real testers
13 SUBMIT        store review, release report, honest report of what is untested
```

---

## Phase 0 — GOVERN

Before the first file. Read the governing docs **in this session**; do not cite
them from memory. State the task in your own words. Surface every ambiguity and
conflict now, while they are cheap.

**Gate:** the owner has confirmed your restatement matches what they meant.

## Phase 0b — ARM

Install the design system before the intake, because `/design-intake` is one of
its skills and its `PreToolUse` hook is what makes Phase 1's gate real rather
than advisory.

```bash
bash "BUILD-STARTER V3 APP SYSTEM/design-system/install.sh" .
```

Then **stop and have the owner restart Claude Code.** Claude Code loads hooks at
session start and at no other time, so an installed-but-not-restarted design
system enforces nothing — this is the single most common reason the gates
appear not to work. After the restart, `/hooks` should list `SessionStart`,
`UserPromptSubmit`, `PreToolUse`, `PostToolUse` and `Stop`.

The installer runs five probes of its own and prints the result of each. If a
probe did not fire, say so plainly instead of continuing. A gate that did not
fire is a gate that is not there.

**Gate:** `/hooks` shows the hooks registered, and the installer's contract
probe reported that it blocked a UI write.

## Phase 1 — INTAKE

Interview. Do not assume. The single most-skipped and most-valuable question is
**"how much real content will exist on launch day?"** — a list built for twelve
of something collapses with two.

Establish at minimum: the business in one falsifiable sentence · **which
platforms and the minimum OS on each** · the audience, their device, and their
physical context — on the move, one-handed, offline, in bright sun · **one**
primary action · **which device permissions and capabilities the app needs, and
why** · whether it is fully on-device or genuinely needs a backend · competitors
and specifically what the owner *dislikes* about them · brand inputs · real
content counts · who owns the Apple Developer and Google Play accounts · locale,
deadline, constraints.

**Gate:** the contract exists with no unfilled placeholders. UI code is blocked
until it does.

## Phase 2 — DIRECTION

Choose an art direction and justify it against two *specific* intake answers.
Name the one bold move and what stays quiet around it. Name what you rejected and
why — a decision with no recorded alternatives is not a decision.

**Gate:** the direction would be obviously wrong for the named competitors. If it
would suit all of them equally, it is generic.

## Phase 3 — SCAFFOLD

Scaffold **Expo (React Native + TypeScript)** and wire **NativeWind**. Do this
**before** tokens: NativeWind's config and preset are where the generated theme
lands, and its babel/metro setup must already be in place, or the token pass has
nowhere to write to and styles will not apply. Complete the NativeWind setup the
current docs describe (verify current) before you generate a single token.

Then lay the foundation code in:

```bash
bash "BUILD-STARTER V3 APP SYSTEM/BUILD STRUCTURE PLAN/foundation/install.sh" .
```

It never overwrites — anything already present is skipped and listed, so it is
safe to re-run and safe on a project already underway. **Read the `NOT
INSTALLED` list it prints.** The app's root entry / layout is always in it,
because every scaffold creates one, and the foundation's version is the file that
carries the font wiring, the theme and safe-area providers, and the app-wide
configuration the scaffold's bare default lacks. Merge those in by hand or you
will ship an app missing its fonts, its theme, or its providers.

Then do what the installer tells you to do next, in the order it says: resolve
every `TODO(project)`, install the runtime dependencies (all of them — a missing
native module fails the build, not just the render), complete any native-module
configuration it names, and set the app configuration (bundle identifier, app
name, icon, permission strings) and the environment.

Foundation before tokens is safe: its templates lint clean against the design
system's own rules, so nothing here turns a gate red before `theme.ts` exists.
It must come *after* the scaffold, though, because the scaffold provides the
NativeWind configuration and the entry file the foundation's layout builds on.

**Gate:** a debug build compiles and launches on a simulator, and
`grep -rn "TODO(project)"` returns nothing.

## Phase 4 — TOKENS

Generate, never hand-pick. Tokens land in `theme.ts` and the NativeWind config,
not a stylesheet. Verify contrast on what actually landed on disk, not on what
the generator claims, and check it in **both light and dark** — the phone
chooses, not you. Wire fonts. See `03-DESIGN-BLUEPRINT.md` for the traps —
particularly the one where the generator cannot reach your brand colour.

**Gate:** every semantic pair passes AA in both themes.

## Phase 5 — DATA

On-device schema, idempotent migrations, seed. **Before** any screen reads it.
Building the UI first means inventing a data shape from the outside, which is how
you end up with a schema that serves one screen. Migrations run on app start
against the on-device store, so a change needs a relaunch to apply — build for
that, not against it.

**Gate:** migrations applied against an existing on-device database and re-run
identically on the next launch. Not "it ran once on a fresh install".

## Phase 6 — CORE FLOW

The single primary action, working end to end, before any secondary screen
exists. If the capture / log / booking / submission does not work, nothing else
matters.

**Gate:** you have driven the real path on a device or simulator and confirmed
the resulting row in the on-device database. A screen that renders is not proof
the record was written.

## Phase 7 — SCREENS

Remaining screens. Every screen orients on its own — a notification or a shared
link drops people mid-app with no context, and the back gesture must always
resolve somewhere sensible.

**Gate:** no tab, link or navigation action leads to a missing or blank screen.
A destination that isn't built is a broken build, not an unfinished one.

## Phase 8 — HARDEN

The unglamorous phase that decides whether the app survives contact with a real
phone. Every permission the app requests has a **designed denied-path** — the app
keeps working in a reduced form and tells the user how to change their mind.
Offline is handled — cached data, queued actions, or a clear message, never a
spinner forever. Error boundaries catch and show a human message. Secrets, tokens
and credentials live in **secure storage**, never in the bundle or the repo.
Reduced motion honoured.

**Gate:** with the permission denied and with airplane mode on, the app still
does something sensible. Deny each one and pull the network to prove it, rather
than assuming the happy path is the only path.

## Phase 9 — DEVICE VERIFY

Run the whole thing on a **real iOS device and a real Android device** — not one
simulator and a guess about the other. Check the smallest supported OS and the
smallest supported screen, safe areas on a notched device, 60fps scrolling with
real amounts of data, VoiceOver and TalkBack, and Dynamic Type at a large
setting. "The store has the row" and "the user can see it on the device" are
different facts; this phase confirms the second.

**Gate:** the primary flow completed by hand on both platforms, on the smallest
device you promised to support. A green test suite is necessary and never
sufficient.

## Phase 10 — REVIEW

Audit by a context that did not write the code. Self-review is systematically
blind to its own intent — it knows what it *meant*, so it reads the result as if
the meaning were visible. Use the coverage checklist in `07-HANDOVER-GATE.md`.

## Phase 11 — EAS BUILD

Produce signed **release builds via EAS** for both platforms. This is the first
step of the release lifecycle proper — see `05-DEPLOYMENT-METHOD.md`. Derive
build numbers and versions from the tooling, never from a document; documents go
stale silently, the build system does not lie.

**Gate:** a release build for each platform completed and its identifiers were
read back from EAS, not assumed.

## Phase 12 — OFF-STORE

Distribute to real testers **before** public release: **TestFlight** on iOS and
**Play internal testing** on Android. This is where a build meets a phone you do
not own — a different OS version, a different screen, a permission prompt worded
by the real OS. Gather what breaks.

**Gate:** the build is installed and the primary flow run by at least one real
tester on each platform, and their feedback is triaged — not merely uploaded.

## Phase 13 — SUBMIT

Submit for store review. A release report. State plainly what was skipped and
what remains untested. The stores are an external gate you do not control:
privacy labels, the Data Safety form, and the review guidelines are checked by
someone else, so the honest data list from intake is what you declare — not a
convenient one. If a gate did not run, the build is unverified — say so in the
first sentence, not the last.

---

## On phase order under pressure

The temptation is always to jump to Phase 6 or 7 because that is where visible
progress lives. Resist it in exactly one direction: **never build screens before
the contract and tokens exist.** Everything downstream of a missing contract is
rework, and it looks like progress right up until it is deleted.

Phases 8–9 and 12 are the ones that get dropped when a deadline bites — the
permission-denied paths, the offline behaviour, the run on a real second device,
the round with real testers. They are also what decides whether the app survives
a phone that isn't yours and an OS version you didn't develop on. Drop them
consciously and say so, or not at all. And unlike a server you control, the store
review at Phase 13 will not be hurried — a rejection there costs days, so the
work that prevents one is not the work to cut.
