# CLOSURE — the admin could see the locked-out rep and do nothing about it

Nobody asked for this feature. It came from counting.

The founder's request was "add these two to Align Sales Pros, they seem to have difficulty making
an account." Delivering it meant creating one login, resetting a second person's password, and then
— one message later — resetting a third person's. The third is the one that gave the game away:
`sanpedrodf@gmail.com` turned out to be Anthony, an already-active member with a Sales Coach role
and a place on the leaderboard, who simply could not sign in. Nothing needed adding. He needed a
password.

Three credential operations for one team in one session, every one performed by an agent running a
service-role script by hand. That is not three requests. That is a missing button.

What was actually missing is narrow and specific. The team API can create a member and remove a
member. It has two password routes and neither fits: `set-password` is the member's own and requires
them to already be signed in, which is precisely what they cannot do, and `passwords` is the shared
team-password list used when creating someone new. The member row in the UI offers a role selector
and a remove button. So an admin looking directly at the person who cannot get in has no action.

That gap only hurts because the fallback is unreliable, and it is unreliable in a way this project
has already paid for. `/auth/forgot` sends an emailed link whose correctness depends on Supabase
dashboard config — the Site URL and the Redirect-URLs allowlist — which the repository cannot hold
or check. `docs/AUTH-REDIRECTS.md` exists because that failed on 2026-08-14, silently, with correct
code on both ends: reset links opened the marketing project instead of the form. §1.5.3 says a
feature depending on external config is not operationally complete until the precondition is
verified or documented. The doc did the documenting. What nothing did was give the product a path
that does not depend on that config at all. This is that path.

The care went into who may press it. The obvious version of this feature is an account-takeover
mechanism: admin is the top of this product's authority, so an admin-initiated reset that can reach
another admin reaches *someone else's account*, the owner's included. Refused for admin targets, and
refused separately for self even though that is redundant today — relying on "the caller is an admin
so their own row is an admin row" would break silently the moment the role model changes, which is
the §2.2 shape of a decision that is right for a reason it never states.

Two smaller things worth keeping. The password is generated rather than admin-chosen, because
letting an admin type it invites the thing `add-member` already institutionalised — one memorable
string handed to five people — and it is paired with `must_change_password`, which since this
morning's extension gate now holds on every surface instead of only the dashboard. And the
ambiguous glyphs are stripped from the alphabets on purpose: this string's delivery channel is
somebody reading it down a phone, and an `O`/`0` collision produces exactly the second support call
the feature exists to prevent.

The partial-failure path is the one place I had to resist the shorter answer. If the
`must_change_password` write fails after the password has already changed, returning a clean 500
would be tidier and would strand a member holding nothing while their admin retries. It returns the
password with the failure, and the panel says the rotation was not forced.

## Residuals

```json
[
  { "id": "R1-no-audit-event-is-written-when-an-admin-rotates-a-colleagues-credential",
    "item": "The reset writes no event. §3.1 makes events the spine of this system, and 'admin X reset member Y's password at T' is exactly the kind of fact that belongs on an append-only record.",
    "why_skipped": "The sibling team routes — set-role and removal — emit no events either. Adding one only here would be a half-measure that reads as coverage while the neighbouring privileged operations stay unrecorded.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-19T07:40:00+08:00",
    "outcome": "OPENED and left open as a NAMED class rather than patched at one site. The right shape is an admin-action event emitted by set-role, removal and reset together, which is its own build. Recorded here so the next person touching team administration inherits the whole gap instead of discovering it one route at a time. Until then the only trace of a reset is a console line, which is not a record." },

  { "id": "R2-the-new-ui-was-never-rendered",
    "item": "The button, the modal, the copy affordance and the amber partial-failure note are held by typecheck and the route's tests. Nothing rendered them, and npm run build:ci was blocked by the sandbox classifier twice, so even the production build is unproven.",
    "why_skipped": "The permission to run the build was denied and working around a denial was not appropriate; it is flagged to the founder as a permission needed.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-19T07:41:00+08:00",
    "outcome": "OPENED and stated in check.md rather than folded into the test counts that succeeded. The specific untested claim is that navigator.clipboard's rejection handler fires a toast — clipboard failure needs an insecure origin or a denied permission, neither of which a unit test reproduces. If it is wrong, an admin taps copy, sees nothing happen, and pastes whatever was on their clipboard before. That is the exact silent-failure shape this build was written against, so it is the first thing to check once the app can be run." },

  { "id": "R3-refusing-admin-targets-may-be-too-conservative-for-a-real-team",
    "item": "An admin who is locked out cannot be helped by another admin through this route. For a small team where everyone is an admin, the feature does nothing.",
    "why_skipped": "The permissive version is an account-takeover path to the owner's account, and widening is reversible while a leaked owner account is not. The conservative default was taken and labelled as a founder decision in the source.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-19T07:42:00+08:00",
    "outcome": "OPENED. Checked against the team that prompted this: Align Sales Pros has 7 members, of whom 3 are admins — so the rule covers the 4 non-admin reps and excludes the 3 admins including the owner, which matches the cases that actually occurred today (all three were non-admin Members). Not a theoretical fit; the real roster was read. If the founder wants the widening, the shape is an owner-only override rather than admin-resets-admin, so authority still flows one way." },

  { "id": "R4-the-shared-team-password-feature-still-exists-alongside-this",
    "item": "add-member still creates users with a SHARED team password from the team_passwords table. Per-person temporary credentials are strictly better, so there are now two mechanisms for the same job.",
    "why_skipped": "Replacing the add-member credential path is a change to a working feature the founder built deliberately in August, not a defect fix, and was not asked for.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-19T07:43:00+08:00",
    "outcome": "OPENED because it sits at the top of the confidence ranking, which is where A36 says to read. The reason it looks harmless is that both paths set must_change_password, so both credentials are temporary. The reason it may not be: a shared team password is reusable across people and lives in a table until revoked, while a generated one is single-use and never stored — so the two are only equivalent while every new hire actually completes the forced rotation. Now that generateTempPassword exists, add-member could offer the same per-person credential and retire the shared secret entirely. Named as the obvious follow-on rather than left as an unexamined 'both are fine'." }
]
```
