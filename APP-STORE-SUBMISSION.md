# App Store submission — the answers you will be asked for

Everything here was read out of this repository, not recalled. Where a fact came from a file, the file is named so
you can check it rather than trust it.

Companion to `DEVICE-CHECK.md`. That one is "does it work"; this one is "what do I type into App Store Connect".

---

## 1. App Review notes — paste this into the review submission

**This is not optional.** The app declares the `audio` background mode, and Apple rejects that declaration by
default unless you explain why it is needed. The reviewer sees a form field called **Notes** on the submission
screen; this is what goes in it.

> Elostate Sales Coach is a field tool for door-to-door sales representatives. It records the rep's own sales
> conversations so they can be transcribed and coached afterwards.
>
> **Why the app requires the audio background mode:** a representative presses record and then puts the phone in
> their pocket to have the conversation. Without the background audio mode, iOS suspends the app the moment the
> screen turns off and the recording stops — losing the entire conversation, which is the one thing the app exists
> to capture. Recording is always started deliberately by the user, is visible on screen while it runs, and stops
> when they stop it.
>
> **To test the app you will need an account.** Demo credentials are supplied in the App Review sign-in fields.
> After signing in, tap "Record a call" on the Home screen to see the recording flow.

**You must also fill in the demo account fields** on the same screen — an account the reviewer can sign in with.
The app has no way in without one, so a reviewer with no credentials will reject it on that alone.

### Who this account is actually for — TESTERS DO NOT NEED IT

Clarified 4 September. The partner company's reps are the TestFlight testers, and **they need nothing prepared**:
they sign in with their own credentials and see their own data. That is what TestFlight is for.

**The demo account exists for exactly one person: the Beta App Review engineer.** They are not a tester, not on
your team, and they receive credentials through the Test Information form. So this is **one purpose-made account**,
not a data exercise — and it is the account that must contain nobody who did not agree to be in it.

**Make it a MANAGER account**, or supply a second manager login alongside it. Alerts, Your Team and Score
Calibration are manager-only; a reviewer signed in as a plain rep finds three destinations that render empty by
design and reads them as broken.

### What that account has to CONTAIN, which is the part that gets missed

A reviewer with valid credentials and an **empty** account is arguably worse than one with no credentials. Every
screen in this app is honest about having nothing, and here is exactly what a reviewer would read, taken from the
source rather than from memory:

| Screen | What it says with no data |
|---|---|
| Sessions | *"No calls yet"* |
| Skills (Analytics) | *"Nothing measured yet"* |
| Pitches | *"No pitches yet"* |
| One Liners | *"No lines yet"* |
| Scoreboard | *"Nothing scored this week"* / *"You are not on this board yet"* |
| Alerts | *"No alerts"* |
| Team chat | *"No topics yet"* |
| Waiting to send | *"Nothing waiting"* |

Eight screens. Every one of those sentences is correct, and every one is exactly right for a real rep on their
first morning — it is the honesty the whole app is built on. **To a reviewer with ten minutes it reads as an app
that does not work.**

**The demo account needs enough history that the product demonstrates itself.** Minimum:

| It needs | So the reviewer sees | Otherwise they see |
|---|---|---|
| **3+ scored sessions** | Sessions list, Analytics grades, the skill breakdown | "No sessions yet" on three screens |
| **1 session with audio still attached** | The recording player, and the feature the permission is for | A session with no recording, on an app whose whole App Store pitch is recording |
| **2+ pitches with outcomes** (Macro Mode) | Door Log, Pitch Performance, Today's Metrics | Empty door figures |
| **Points on the ledger** | The Arena gauge and at least one earned milestone | A gauge at zero |
| **A second rep in the company** | A Scoreboard that is a board rather than a list of one | "You are not on this board yet" |
| **Manager role, or a second manager account** | Alerts, Your Team, Calibration | Three destinations that render empty by design |

### Using the existing sessions for the reviewer's account — FOUNDER DECISION, 4 September

**Yes, use them.** Asked and answered the same day, in three steps, and the record is kept because the reasoning
matters more than the conclusion:

1. I said no, on three grounds: the rep's voice, whose data it is, and the member of the public at the door.
2. The founder: the partner company and its reps are **part of the development team** — which settles the first
   two, and leaves only the person at the door.
3. The founder: **those members of the public agreed the calls are recorded for training and development.**

That is a real consent basis, and demonstrating the product to a platform reviewer in order to ship it sits inside
"development". **The decision is the founder's and it is sound.** It also removes the twenty minutes of staged
recording entirely, and gives a reviewer better content than anything staged would.

**Two practical refinements, about review outcome rather than ethics:**

- **Rename the client labels in the reviewer's account.** Consent to record does not oblige you to hand Apple a
  real person's name and street. *"Mrs Patel, 14 Oak Road"* as a session title is identifying detail that serves
  no purpose in a demo — and Sessions is a screen a reviewer definitely opens. Two minutes, and it touches neither
  the audio nor the transcript.
- **Make it a manager account**, per the note above, or Alerts / Your Team / Calibration render empty.

**If you are building this account from scratch instead**, use invented client names and invented reps. The
founder decision above means you probably do not have to — the existing sessions are cleared for use.

**The cheapest way to get there:** record three or four calls yourself, out loud, playing both parts, with
invented names. Twenty minutes, the pipeline scores them like any other call, and every screen above fills with
data that belongs to nobody.

### What those calls must CONTAIN, or half the screens stay empty

This is the part that would cost you a retake. The coach grades five dimensions, and **a dimension it cannot find
is left out rather than scored zero** — deliberately, because "Questions: 0" would tell a rep they never ask any.
So a thin call produces a session with almost no chart.

Read from the scorer's own prompt (`doorlog/analyze.ts`), each call should contain:

| Dimension | What the call needs in it |
|---|---|
| **objection** | the "prospect" pushes back or hesitates, and the rep answers it |
| **talk_listen** | the prospect actually talks — not a monologue with grunts |
| **questions** | the rep asks something to understand them, not just pitch |
| **tone** | warmth and pacing — this one comes free if you speak normally |
| **close** | the rep asks for a next step, out loud |

**So: not fifteen seconds of "hello, would you like solar".** A minute or two each, with one real objection
("we already have a company"), a couple of questions, and an explicit ask at the end. Vary the outcomes across the
three or four — one sold, one go-back, one not interested — so the Door Log and the KPI trio have something to
show as well.

There is **no minimum duration** on either the phone or the server — checked, not assumed — so nothing will be
rejected for being short. It will simply be scored on less, and the screens will show less.

### Add this paragraph too — it pre-empts the question a reviewer is most likely to ask

> This app does not support account creation. Access is granted by an administrator at the customer's company;
> there is no sign-up in the app, and the sign-in screen says so. Guideline 5.1.1(v)'s in-app account deletion
> requirement therefore does not apply. A representative who wants their account removed asks their administrator,
> who deletes it from the web application.

**Why this is worth saying before they ask.** Guideline 5.1.1(v) requires in-app account DELETION from any app that
supports account CREATION. This app has a login but no sign-up — verified by reading
`src/app/(auth)/sign-in.tsx`, which tells the rep in as many words: *"Access is granted by an Elostate admin, so
there is no sign-up."* So the requirement does not bind.

But a reviewer sees a login screen and reasonably wonders. Answering it in the notes costs you two sentences;
being asked costs you a review cycle.

### One thing you do NOT need

**Sign in with Apple.** It is required only where an app offers a third-party or social login. This app is
email-and-password against your own Supabase — no Google, no Facebook, no OAuth of any kind (checked in
`auth-context.tsx`). Nothing to add.

---

## 2. App Privacy — what to declare

Apple asks per data type: is it collected, is it linked to the user, is it used for tracking. Read from the code:

| Data type | Collected | Linked to the user | Tracking | Where it comes from |
|---|---|---|---|---|
| **Audio Data** | Yes | Yes | No | The recording feature. Uploaded to your Supabase storage and transcribed. |
| **Contact Info — email** | Yes | Yes | No | `signInWithPassword` (`auth-context.tsx:87`). |
| **Contact Info — name** | Yes | Yes | No | `profiles.full_name`, read for the greeting (`profile.ts:37`). |
| **User Content — other** | Yes | Yes | No | Team chat messages and attachments the rep sends. |
| **Identifiers — user ID** | Yes | Yes | No | The Supabase account id. |
| **Diagnostics — crash data** | **No** | — | No | The phone keeps its own crash log and sends nothing on its own. See the note below — this answer changed on 4 September. |

**Nothing is used for tracking**, and the app contains no advertising SDK and no third-party analytics. You can
answer "No" to every tracking question.

**About the crash-data row:** answer **No**, and that is now a fact about the build rather than a fact about an
unset variable.

### The crash reporting system, and why the answer is No

Crash reporting used to mean one thing here: hand the error to Sentry, *if* somebody had bought a Sentry project and
set `EXPO_PUBLIC_SENTRY_DSN`. Nobody had. So the honest description of this app's crash reporting was that it had
never reported anything to anyone, and the rep who watched the failure happen had no way to tell you about it.

On 4 September the owner asked for a crash reporting system, and this is what was built:

- **The phone keeps its own log.** Every error an error boundary catches is recorded on the device — scrubbed
  through the same rules the Sentry path used, so a signed recording URL or anything JWT-shaped never enters it
  (`crash-log.ts`, seventeen tests, three of them proven by breaking the source and watching the named test fail).
- **The rep can see it and send it.** *Menu → Report a problem* lists what the phone recorded in plain rows, asks
  what they were doing in a labelled box, and sends the lot through the phone's own share sheet.
- **Nothing leaves the device on its own.** No background upload, no DSN, no third party in the path. A report is
  sent because a person pressed a button, to a recipient that person chose.

**Which is why Diagnostics is "No".** Apple's question is whether the app collects diagnostics *from* the user. This
one does not: it shows the log to the rep and lets them send it. That is a share sheet, not a collection.

**For an app that records customer conversations, this is the better arrangement rather than the cheap one.** A
crash service is a processor that has to be named in the privacy policy, disclosed in App Privacy, and trusted with
whatever slips past the scrubber. This design has none of that surface, and it works on the build you are
submitting this week instead of after somebody opens an account.

**What it costs, stated plainly:** you do not get automatic aggregate crash counts. You find out when a rep tells
you, which is a real downside — it under-reports. If you later want the aggregate view, `crash-init.ts` still holds
the DSN-gated Sentry path, switched off; setting the variable and re-adding the config plugin turns it back on, and
you would then declare Diagnostics after all.

### The build failure this fixed

Your `eas build` on 3 September failed at the *Run fastlane* step with `An organization ID or slug is required`.
That was the `@sentry/react-native` **config plugin** in `app.json`. Its only job is to add an Xcode step that
uploads source maps to a Sentry organisation — and with no organisation to upload to, that step could only fail.
It has been removed. The plugin was doing nothing for you except breaking the build.

---

## 3. The privacy policy needs a section it does not have

**This is the thing most likely to get the submission rejected**, and it matters beyond Apple.

Your policy at `elostate.com/privacy` is thorough and well written. But it uses the word "record" only in the sense
of *a record of events*. It never mentions **audio, recording, microphones, or transcription** — checked by reading
`TeamPilot/src/app/privacy/page.tsx`.

Apple cross-checks your App Privacy answers against your policy. Declaring **Audio Data** against a policy that is
silent about audio is a mismatch review looks for.

It also matters for a reason Apple will not raise: **the person at the door is being recorded too**, and the policy
currently says nothing to them.

The section needs to answer, in the voice the rest of that policy already uses:

- what is captured, and that it starts only when a rep presses record
- that the other party's voice is in it
- who can listen — the rep, their manager, and who cannot
- what the transcription service receives, and that it is a processor, not an owner
- how long a recording is kept and how a rep deletes one

**Written on 4 September — and the last line came out of the code, not out of a decision.** The retention rule was
already running: `recording-purge-cron` has deleted recordings nightly since 26 August, and it is **not a duration
at all**. It keeps each representative's **twenty most recent** unsaved recordings and deletes the audio of anything
older, keeping the transcript and the scores. A recording anyone presses Save on is exempt.

Two things follow that the policy now states rather than glosses:

- **No one can delete a recording on demand.** There is no delete endpoint — not for a rep, not for a manager, not
  for an administrator. The only removal is the nightly rule.
- **A count is not a time limit.** A rep who stops recording keeps their last twenty indefinitely, and a saved
  recording is kept forever. See §7 for the recommendation about that.

---

## 4. What is already correct — verified, not assumed

| Item | State | Where |
|---|---|---|
| Bundle identifier | `com.elostate.salescoach` | `app.json` |
| App icon | 1024×1024 PNG | `assets/images/icon.png` |
| Microphone purpose string | Written for a person, explains when and why | `app.json` `NSMicrophoneUsageDescription` |
| Encryption declaration | `ITSAppUsesNonExemptEncryption: false` | `app.json` |
| Version / build number | 1.0.0, build numbers auto-increment | `app.json`, `eas.json` |
| Apple credentials | Working — an iOS build has already finished | EAS build history |
| Photo / camera permissions | **None needed.** The app displays attachments and shares files it already owns; it never opens a picker or the camera. A missing purpose string would crash on iOS, so this was checked rather than assumed. | swept `src/**` |
| Device family | iPhone only (`supportsTablet` unset) — so only iPhone screenshots are required | `app.json` |

---

## 5. Screenshots

### The one that matters more than composition

**A screenshot of this app is a screenshot of somebody's customer.** Client labels, session names, transcripts,
one-liners taken from real calls, a scoreboard with your reps' real names on it — all of it renders straight onto
the screen you are about to publish to a public store page, permanently, in a place that gets indexed.

So before you take a single frame:

1. **Sign in as a demo account with invented data**, not your own. The same account you give App Review — a
   reviewer opening the app and finding a real customer's name is its own problem.
2. If you must shoot from a real account, **check every frame at full size before uploading**. A client name in a
   list you were not looking at is the failure mode; the eye goes to the thing being demonstrated.
3. **Never screenshot a transcript or a one-liner.** Both are, word for word, what a member of the public said at
   their own front door. There is no version of that which belongs in a store listing.

This is not a legal opinion. It is the same rule the privacy policy commits you to, applied to a page you control.

### Sizes Apple actually wants

| Display | Pixels (portrait) | Device |
|---|---|---|
| **6.7"** — required | **1290 × 2796** | iPhone 15/16 Pro Max, 14 Pro Max |
| 6.5" — recommended | 1242 × 2688 | iPhone 11 Pro Max, XS Max |

6.7" alone is accepted for a new app in most cases; supplying both avoids a round trip. A screenshot taken on the
phone you already have is already the right size for its own class — you do not need to resize anything.

### Before you press the buttons

- **Charge the phone above 80%.** A 22% battery in the corner of all five frames reads as a rushed listing.
- **Clear the Dynamic Island.** The screenshot you sent me this morning had a personal photo and a media player
  sitting in it. Both appear in a store screenshot exactly as they appear on your screen.
- **Turn on Do Not Disturb**, so a notification banner does not land mid-capture.
- Text size **back to default** if you were running check 26.

### The five, in this order — they tell the story rather than list the screens

1. **Home**, Macro Mode on — the Door Log and Start Knocking. What a rep opens the app to do.
2. **Today's Metrics → Progress** — the Arena gauge. The most visually distinctive screen in the app, and the
   reason to look twice.
3. **The recorder mid-recording** — the thing the app is actually for.
4. **Pitch Performance** — a scored pitch with its breakdown. This is the payoff the first three are building to.
5. **Scoreboard** — the team board. Invented names.

### Timing

**Take these after the device pass, not before.** They are the same screens the pass is checking, and a screenshot
of a bug is a screenshot you retake. Two of these five — Home and Today's Metrics — are screens that crashed on the
first phone this app ever ran on.

---

## 5b. TestFlight — and why external is not much harder than internal

Asked on 4 September: *"are we ready for TestFlight, and how hard is external?"*

**Ready for internal today.** `eas.json` has a `production` profile with `autoIncrement` and a `submit` profile,
and `ITSAppUsesNonExemptEncryption: false` is already in `app.json` — that flag is the single most common reason an
upload stalls, and yours is set.

### What external adds

| | Internal | External |
|---|---|---|
| Apple review | none | **Beta App Review**, typically 24–48 hours |
| Testers | 100, must be users on your App Store Connect team | up to 10,000, any email address |
| Test Information | not required | **required** — beta description, feedback email, privacy policy URL |
| **Demo credentials** | not required | **required**, and a reviewer will sign in |

**The form-filling is an hour. The prerequisites are the work**, and they are the same two that gate a full
release:

1. **A demo account with content.** A reviewer signing into an empty account reads *"No calls yet"*, *"Nothing
   measured yet"*, *"No pitches yet"* across eight screens. Every one of those sentences is correct and the whole
   thing reads as an app that does not work. See §1 for exactly what the account needs. Roughly twenty minutes:
   record three or four short calls yourself, playing both parts, with invented names.
2. **No crashes.** Beta App Review looks for them. As of writing, 1 of 26 device checks has been run and that one
   crashed twice.

### The sequence that costs nothing extra

**A build can be promoted from internal to external without rebuilding.** So there is no reason to choose:

```
eas build --profile production --platform ios     # once
eas submit --platform ios --latest                # to App Store Connect
```

→ **internal** TestFlight, no review, on real phones in minutes
→ run the 26 checks against the build you will actually ship
→ fix what it finds
→ **promote the same build to external** in App Store Connect

If the pass is clean you have lost nothing and gained a verified build. If it is not, you have avoided sending a
crashing build to review — which costs days, not minutes.

### The Test Information form — paste-ready

App Store Connect asks for these before it will let an external group have a build. Every field below is written
and can go straight in.

**Beta App Description** (what testers see in TestFlight, before they install)

```
Elostate Sales Coach is for representatives who knock doors for a living.

Record a pitch at the door, get it back transcribed and scored on the things that decide a sale — how you handled
the objection, whether you let them talk, your questions, your tone, and how you asked for the next step. Log
every door in one tap, with or without signal.

This build is for testing the recording flow and the coaching that comes back from it.
```

**What to Test** (the field that decides whether your feedback is useful)

```
The two things worth your time:

1. RECORD A CALL, END TO END. Press record on the Home screen, put the phone in your pocket, talk for a minute or
   two, then stop and name it. It should appear under "Waiting to send" and go on its own. Come back later and
   check the transcript and the score arrived.

2. USE IT WITH NO SIGNAL. Turn on aeroplane mode and log four or five doors, or record a pitch. Nothing should be
   lost, and the app should say plainly what is still on the phone and what has reached the server. Then turn
   signal back on and watch it catch up without you doing anything.

Also worth a look: Today's Metrics has two pages — swipe between them, or use the tabs.

WHAT TO TELL US. If a screen shows a number you think is wrong, say which number and what you expected. If
anything goes wrong at all, use the menu at the top of Home → "Report a problem" — it sends what the app recorded
along with your description. That is more useful to us than a screenshot.

WHAT THIS BUILD DOES NOT DO YET: driving a Decision Dialogue from the phone (that is on the website), and there is
no way to delete a recording from the app — a manager does that on the website.
```

**Feedback email** — an address you will actually read.

**Privacy Policy URL** — `https://elostate.com/privacy` (confirm it is live first; it must show the recording
section, which merged on 4 September).

**Sign-in required: YES.** Give the demo account from §1 — the one WITH recorded calls in it. A reviewer signing
into an empty account sees eight screens saying nothing is there.

**Contact information** — first name, last name, email, phone. Apple uses this if Beta App Review has a question;
an unanswered query stalls the review.

### TestFlight does NOT need App Store screenshots

Worth saying plainly, because §6's order implies otherwise and it takes a whole step off your path: the 6.7" /
6.5" screenshots in §5 are for the **App Store listing**, not for TestFlight. External testers see the app's icon,
your beta description and the "what to test" note — no screenshots at all.

So for external TestFlight the order is shorter than §6 reads:

```
confirm the privacy policy is live
record the demo calls              (~20 min — see §1; do it BEFORE the build)
eas build --profile production --platform ios
eas submit --platform ios --latest
internal TestFlight → run the 26 checks on the real build
promote THAT build to external     → Beta App Review, 24–48h
```

Screenshots come back onto the path only when you go for the full App Store release.

### One thing to check in App Store Connect rather than take from me

Whether it requires the **App Privacy** questionnaire to be complete before it will let you distribute
externally. It is definitely required before App Store release; I am not certain it gates external TestFlight, and
guessing either way would be worse than saying so. Your answers are ready in §2 regardless — the short version is
that **Diagnostics is "No"**, and nothing is used for tracking.

---

## 6. The order that avoids rework

Updated 4 September, mid-flight. Struck-through steps are done.

| # | Step | State |
|---|---|---|
| 1 | Set the three EAS environment variables | **Done.** A build without them installs and dies on launch. |
| 2 | Get a build onto a phone | **Done** — development build over a tunnel. |
| 3 | Run the device pass (`DEVICE-CHECK.md`, 26 checks) | **In progress.** Two crashes found and fixed on the first screen. |
| 4 | Merge and deploy the privacy policy | **Merged and pushed** (`main` at `7ee0a911`). Still to confirm it is LIVE: open elostate.com/privacy and look for "twenty most recent recordings". |
| 5 | Prepare the REVIEWER account (§1) | Now small: pick a manager account with existing sessions, rename a few client labels. ~2 minutes. Testers need nothing — they use their own accounts. |
| 6 | Remove the three genuinely-unused native modules (§8) | Immediately before the production build. Read §8 — my first version of this advice was wrong. |
| 7 | `npx eas build --platform ios --profile production` | |
| 8 | `npx eas submit --platform ios --latest` | Lands in App Store Connect. |
| 9 | **Internal TestFlight** — no review (§5b) | Run the 26 checks against the build you will actually ship. |
| 10 | Take the screenshots | After the pass, and read §5 first — this app's screens contain customers. |
| 11 | **Promote the same build to external TestFlight** (§5b) | No rebuild. Beta App Review, 24–48h. |
| 12 | Fill in the listing, App Privacy, the review notes above, and the demo account | Listing copy is written in `APP-STORE-LISTING.md`. |

**Step 5 moved up, because it gates two later steps.** The demo account is needed for the screenshots AND for
external TestFlight, and it is the item most likely to be left until it is blocking.

**Steps 1 and 4 are the two that cause a resubmission if skipped.** Apple cross-checks your App Privacy answers
against the published policy, and this app declares Audio Data.

**Step 3 is the one that stops you shipping something you have never seen.** It has already earned its place twice:
the first screen anyone opened crashed, then crashed again for a different reason, with a clean typecheck, a clean
lint and a full green test run throughout.

---

## 7. The duration you asked me to suggest

You asked for a retention duration for the audio. The honest first answer is that **you already have a retention
rule and it is not a duration** — `recording-purge-cron` keeps each representative's twenty most recent unsaved
recordings and deletes the rest nightly. That rule is good, and it is better than a time limit for the thing it was
chosen for: a rep who did not pitch for a fortnight still has recent recordings for their manager to pull from,
which a two-day age rule destroyed.

**But a count has no outer bound, and that is the gap.** Three cases where it holds customer audio forever:

- a representative who leaves the company — their last twenty stay;
- a representative who records rarely — twenty recordings might span two years;
- any recording anyone pressed Save on — exempt from the purge, kept indefinitely, with nothing that ever removes it.

That is the first thing a regulator asks about, and it is the one sentence a privacy policy cannot defend.

### The suggestion: keep the count, and add twelve months on top

**Delete the audio of any unsaved recording after 12 months, regardless of where it sits in the rep's window.**

| Why twelve and not less | Why twelve and not more |
|---|---|
| An active rep cycles twenty recordings in weeks, so this never touches anyone who is actually selling — it only catches the audio that has been sitting still. | Past a year, nobody coaches from a recording. You are holding a customer's voice for no purpose you could name in a sentence. |
| It comfortably covers a full year of review cycles, disputes and onboarding comparisons. | Every extra month is more customer audio to lose if you are ever breached, and more to explain if you are ever asked. |

**Saved recordings need their own answer, and I would not guess it.** They are exempt by design — a manager pressed
Save precisely to keep one. A twelve-month sweep that deleted those would break the feature. The two coherent
options are to leave them exempt forever, or to give managers a delete control and let them curate. That is your
call, and it is on the board.

### What building it costs

The change is small and lands in the job that already exists: one extra clause in `recording-purge-cron`, which
already fetches candidates, deletes bytes and nulls `audio_asset_url`. It is roughly an hour including tests.

**It is not built yet, and the policy does not promise it.** The published policy describes the count rule, which is
what actually runs. Say the word and the twelve-month cap goes in before you submit; until then nothing on the site
claims an outer bound that the system does not enforce.

### The other half of your answer: who can delete

You said a representative cannot delete their own recording, and that managers and administrators can. **Today
neither half is true, and it is worth knowing which way the gap runs.**

- **Nobody can delete a specific recording** — the product has no delete endpoint for one at all. Managers and
  administrators have no more power here than a rep does.
- **A rep can already keep one forever.** `save-recording` authorises *the owning representative* as well as a
  manager, so a rep can exempt their own recording from the nightly deletion. That is the opposite direction from
  the policy you described, and it is live today.

Making your stated policy true is one route (managers and admins only, delete plus save) and is real work: an
endpoint, an authorisation check, the storage removal, and a control on the web. It is not needed to submit — the
policy now describes what the system does — but it is the gap between the product you described to me and the one
that is running.

---

## 8. Native modules the app never uses

Found by sweeping every dependency against actual imports, rather than by reading the list and recognising names.

| Module | Used in `src/` |
|---|---|
| `expo-device` | never |
| `expo-glass-effect` | never |
| `expo-image` | never |
| `expo-linking` | never |
| `expo-symbols` | never |
| `expo-system-ui` | never |

Each is compiled into the binary. None is imported by a single line of this app.

**`expo-image` deserves a note, because the design law names it** — *"Use `expo-image` for images (caching,
priority)"*. That rule is not being broken: **this app renders no images at all.** Checked rather than assumed —
there is no `<Image>` of any kind in `src/`, and the only image files in the project are the icon, the splash and
the favicon, all of which are handled by `app.json` and never by a component. A data tool for reps at doorsteps
turns out not to need one.

**`expo-glass-effect` is worth removing on principle as well as size.** Glassmorphism on large surfaces is banned
outright by the design law. It is not used, so nothing is wrong today — but a module that exists to do a banned
thing is an invitation, and the next person to open the project will not know it is banned.

### The recommendation — CORRECTED, because my first version of it was wrong

I originally wrote "remove all six" and gave you the command. **Do not run that.** I checked what depends on each
one afterwards, which is the order I should have done it in, and three of the six are not yours to remove:

| Module | What actually depends on it | Safe to remove? |
|---|---|---|
| `expo-device` | nothing | **yes** |
| `expo-image` | nothing | **yes** |
| `expo-system-ui` | nothing | **yes** |
| `expo-linking` | **`expo-router` (peerDependency)** | **no — uninstalling it breaks routing** |
| `expo-glass-effect` | `expo-router` (dependency) | **pointless** — npm reinstalls it under expo-router |
| `expo-symbols` | `expo-router` (dependency) | **pointless** — same |

So the honest version is **three, not six**, and the two "pointless" ones are worth understanding rather than just
skipping: removing them from `package.json` deletes your *declaration*, not the package. `expo-router` pulls them
back into `node_modules` and into the binary either way. You would get a tidier manifest and an identical app.

**`expo-glass-effect` therefore stays whatever you do**, which is worth knowing given the design law bans
glassmorphism on large surfaces: the module is in your app because expo-router depends on it, not because anyone
chose it. Nothing in `src/` imports it. The ban is on using it, and it is not being used.

### What to actually run, immediately before the production build

```
cd "C:/Users/johns/IOS-APP/Elostate-Sales-coach"
npm uninstall expo-device expo-image expo-system-ui
npx tsc --noEmit && npm run lint && npm test && node ../tools/gate.mjs
```

If any of those four fails, one of the three was load-bearing in a way this sweep missed — reinstall it and tell
me which.

**How much does this matter? Honestly, very little now.** Three small modules out of a binary. It is listed
because the cheapest moment to do it is a rebuild you are already making, and because the wrong version of this
advice is still worth correcting even when the stakes are low — a command that breaks `expo-router` the night
before a submission is a bad hour.
