---
started_at: 2026-09-19T07:20:00+08:00
trigger: Three hand-run service-role password resets for one team in one session is a pattern, not three incidents.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the admin could see the locked-out rep and do nothing about it

## Why (the record)

This build is not from a feature request. It is from counting what the session actually did.

The founder asked for two Align Sales Pros agents to be given access. That became: create one
account, reset a second person's password, and then — a message later — reset a third person's
(`sanpedrodf@gmail.com`, who turned out to be Anthony, already an active member who simply could
not get in). Three credential operations for one team, all performed by an agent running a
service-role script by hand.

Retrospective identification (§1.2): the request was "add these two", but the record says the
actual problem is that **an admin has no way to give a teammate a working password**, so every
instance escalates out of the product entirely.

## The defect

A member who cannot sign in has exactly one self-serve route: `/auth/forgot` → an emailed link.

That flow's correctness depends on configuration the repository cannot hold. `docs/AUTH-REDIRECTS.md`
exists *because it already failed*: on 2026-08-14 reset links opened the marketing project instead
of the form, because Supabase silently falls back to the Site URL for any `redirectTo` that is not
in its Redirect-URLs allowlist. The code was correct on both ends. It is the §1.5.3 class — a
feature that is not operationally complete because an external precondition is unmet — and its
failure mode is silence.

When that flow does not work, or the mail simply does not arrive, the admin looking directly at
that person in their team list has **no action**. The row offers a role selector and a remove
button. There is no `/api/team/*` route for resetting a member's password; the only password
routes are `set-password` (the member's own, requiring them to already be signed in — the thing
they cannot do) and `passwords` (shared team passwords, for creating new users).

So the escalation path is: rep → founder → agent → service-role script. Which is what happened,
three times, today.

## Why this is layer 2, not a nice-to-have

§1.5.1 layer 3 asks whether the completed feature leaves the user able to continue. "Add a member"
works. "The member cannot get in afterwards" is the very next step in the same workflow and it
dead-ends inside the product. An admin surface that can create an account and delete an account,
but not restore access to one, is not a complete team-management surface — it just fails at the
step that happens most often.

## The hard part

Not the reset. The blast radius of who may perform it.

An admin resetting **another admin's** password is an account-takeover path: admin is already the
top of this product's authority, so the only thing left to escalate to is somebody else's account —
including the owner's. That risk does not exist for the case this was built for, which is a rep who
cannot get in.

So the reset is refused for admin targets. That single condition also happens to refuse a
self-reset, because the caller must be an admin to reach the endpoint at all and their own row is
an admin row — but self is refused explicitly and separately, because relying on that coincidence
would break the moment the role model changes.

Conservative on purpose, and recorded as conservative rather than as correct-for-all-time: an admin
who is locked out still has `/auth/forgot` and the Supabase dashboard. Widening this is a founder
decision, not a refactor.

## What makes the credential temporary rather than a second shared secret

The password is generated, not chosen by the admin, and returned exactly once. Letting an admin
type it invites the thing `add-member` already institutionalised — one memorable string handed to
everybody. It is paired with `must_change_password`, so it stops working the moment its owner signs
in, and with the extension gate shipped earlier today that flag now holds on every surface rather
than only the dashboard.

## Session-read manifest

Every clause below was opened in THIS session, from the file named, at the line range given.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "Understanding precedes solving — articulate WHY the problem exists before fixing it.",
    "how_this_build_will_embody_it": "The request was 'add two users'. The build is a password-reset action, because the record — three hand-run credential operations in one session — says the request was a symptom of admins having no way to do this themselves." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "The methodology must be in the working tree and read now, not cited from cached labels.",
    "how_this_build_will_embody_it": "§1.5.3 and A33 were printed from this tree before being cited here, because both are load-bearing to this build's argument and neither had been opened earlier in the session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "236", "read_at": "2026-09-18T23:25:00Z",
    "why_it_governs": "Identify the problem by looking BACKWARD at the record, detecting patterns across incidents rather than the symptom in front of you.",
    "how_this_build_will_embody_it": "Three credential operations for one team were treated as one pattern rather than three requests. The third — Anthony, an ALREADY-ACTIVE member who could not sign in — is the one that proved this was not about adding users at all." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-130", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "Layer 3 asks whether the completed feature leaves the user able to continue, or stalls them at a dead end.",
    "how_this_build_will_embody_it": "Adding a member succeeds and the very next step — that member signing in — had no in-product recovery. The route alone would not discharge this, which is why the team-page action and the copyable one-time panel ship with it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "THINK first about what could be wrong, then search to confirm; the agent co-owns quality rather than only executing the ask.",
    "how_this_build_will_embody_it": "Nobody asked for this feature. It came from noticing the same manual operation had been performed three times, then searching the team API surface to confirm no route existed." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-18T23:26:00Z",
    "why_it_governs": "A feature depending on config outside the repo is not operationally complete until that precondition is verified or documented and surfaced; prefer failing LOUD over failing silently.",
    "how_this_build_will_embody_it": "This IS the remedy for a §1.5.3 failure: /auth/forgot depends on the Supabase Site URL and Redirect-URLs allowlist, already failed silently once (2026-08-14), and left no in-product fallback. The reset path depends on no external config at all — a service-role write and a string on screen — so it cannot fail in that silent way." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "A decision computed by an authority must be consumed as a verdict, not re-derived by consumers.",
    "how_this_build_will_embody_it": "The password policy is not re-expressed. generateTempPassword asserts its own output against the SHARED validateStrongPassword, and the route test asserts the returned password against that same validator rather than a regex copied into the test — so the generator and the two screens that accept a password cannot drift." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "Guide, don't overtake; never take the decision away from the human.",
    "how_this_build_will_embody_it": "The admin-target refusal is the conservative reading and is labelled as such in the source, with the widening named as a founder decision rather than taken. The earlier resolveApiAuth gap was likewise left open because the founder chose the narrow fix." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "The biggest risk is the builder under pressure making the account less honest for a faster result.",
    "how_this_build_will_embody_it": "Built under an explicit urgency instruction. The partial-failure path was the temptation: a clean 500 when the flag write fails would have been shorter. That strands a member whose password HAS already changed, so the route returns the password with the failure and the UI shows it with a warning." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-440", "read_at": "2026-09-18T23:35:00Z",
    "why_it_governs": "Item 0 — a decision offered to the founder must be a picker with a recommendation, never prose.",
    "how_this_build_will_embody_it": "The offboarding finding went to the founder as a picker with four costed options. This build's own conservative choice (no admin targets) is stated as taken-and-why rather than posed as a question, because it is the safe default and reversible." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-18T23:35:50Z",
    "why_it_governs": "Everything is an event, append-only; entity state is derived by replaying them, and full history must stay intact because retrospective analysis depends on it.",
    "how_this_build_will_embody_it": "It is the clause this build does NOT satisfy, and naming it is the point. An admin rotating a colleague's credential is exactly the kind of fact that belongs on the append-only record, and this route writes none — only a console line. Carried as residual R1 as a CLASS (set-role and removal emit nothing either) rather than patched at one site, because an event on this route alone would read as coverage while the neighbouring privileged operations stayed unrecorded." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-18T23:35:40Z",
    "why_it_governs": "Holding the LABELS without the CONTENT produces work written in the language of the discipline while violating it.",
    "how_this_build_will_embody_it": "§1.5.3 is the backbone of this build's argument and was opened and read before being leaned on, not recalled from the fact that an AUTH-REDIRECTS doc exists." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-18T23:35:40Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "The previous build's manifest was rejected by the gate for exactly this, and the correction was to read the clauses, not drop the citations. §1.2, §1.5.3 and A33 were read for THIS build before being cited." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "92", "read_at": "2026-09-18T23:35:40Z",
    "why_it_governs": "A lesson in prose returns — encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Seventeen tests. The ones that matter assert the refusals (removed / admin target / another tenant / self) AND that no credential is touched on each refusal, because a refusal that still rotated the password would be a denial with the damage already done." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-858", "read_at": "2026-09-18T23:27:00Z",
    "why_it_governs": "A gate must be PRECISE or not exist; when the pattern resists detection, find the chokepoint where the invariant holds by construction.",
    "how_this_build_will_embody_it": "The generator's self-assertion is the chokepoint version of 'temp passwords must satisfy the policy' — one function every temp password passes through, so the invariant holds by construction rather than by inspecting call sites." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "96, 1001", "read_at": "2026-09-18T23:35:40Z",
    "why_it_governs": "'Verified' is a claim about a COMMAND you ran, in the words of the project's own gate.",
    "how_this_build_will_embody_it": "check.md pastes the canonical commands with counts and exit codes, and states plainly that the new UI was never opened in a browser." }
]
```
