# Device check — Elostate Sales Coach

The static gates (G1–G4) all pass and both bundles export. **G5, the runtime
check, is the one gate still red, and it cannot be run from a laptop** — a React
Native app is verified on a real device, not in a browser.

This list exists because a lot of what was fixed on **3 September 2026** cannot
be proven by any test: navigation reachability, a restored draft, a tab bar's
order, whether a queue resumes. Each item below says what to do, what you should
see, and what *wrong* looks like — so a failure is recognisable rather than
something you have to interpret.

---

## Part 1 — Getting a build onto a phone

### If you are testing from TestFlight, most of this Part does not apply

**Added 4 September**, when the first production build went up. TestFlight
installs a finished, store-signed app: there is no Metro, no QR code, no
`npx expo start`, and no Expo Go. Everything in this Part about dev servers and
tunnels is for the *development* build.

**From TestFlight the whole install is:**

1. Accept the TestFlight invitation email (or tap the public link).
2. Install **TestFlight** from the App Store if you have not already.
3. Open it, tap **Elostate Sales Coach**, tap **Install**.
4. Launch it from your home screen like any other app.

**Then start at check 1.** Everything from Part 2 onward applies unchanged,
with one exception, flagged where it appears: **check 2 cannot be run from
TestFlight** — it needs Expo Go, where recording is genuinely unavailable.

**Why the production build is the one worth testing on.** It is what your
testers and Apple will actually run. Both defects found on 4 September were in
the native layer — a missing gesture provider, and two animation systems that
cannot share a value — and that layer is exactly what a development build
exercises differently.

---

**The rest of this Part is for a DEVELOPMENT build.**

**Recording needs a development build, not Expo Go.** `expo-audio` is a native
module and Expo Go ships a fixed set of them, so in Expo Go the Record screen
deliberately shows "recording isn't available in this build" rather than
crashing. Everything *except* recording can be checked in Expo Go.

### Step 0 — confirm the project is build-ready

This catches native problems that never appear in a laptop build, because they
resolve when the *native* app is compiled. It found a real one on 3 September: a
missing `expo-asset`, which `expo-audio` needs and whose absence can crash the
app **outside Expo Go** — that is, in the very build you need for recording.

```bash
cd Elostate-Sales-coach
npx expo-doctor
```

Expect **21/21 checks passed**. If anything fails, send me the output before
building — a failed check here usually means a build that installs and then
crashes, which is the most expensive way to find out.

### Step 0b — give the build your backend settings (REQUIRED, one minute)

You chose **"store them with Expo, as environment variables"** on the board. I
had briefly written them into `eas.json` instead; that is now removed, because
your choice was the other option and the repo is not where you wanted them.

Run these three from the app folder. Each prompts for the value — copy them from
your local `.env.local` — and asks which environments to apply to. Choose
**development** and **preview** at minimum.

```bash
cd Elostate-Sales-coach
npx eas env:create --name EXPO_PUBLIC_SUPABASE_URL --type string --visibility plaintext
```

```bash
npx eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --type string --visibility plaintext
```

```bash
npx eas env:create --name EXPO_PUBLIC_API_BASE --type string --visibility plaintext
```

Confirm they registered:

```bash
npx eas env:list
```

*Why plaintext, not secret:* these three are public by design — the anon key is
meant to ship inside the app, and Row-Level Security is what protects your data.
A `secret` variable is not readable back by the build in the same way, and
`EXPO_PUBLIC_*` values are inlined into the bundle regardless. **The service-role
key is not among these and must never be.**

**Until these exist, an EAS build will install and then die as it opens** — the
app throws on a missing setting. That is one minute of work standing between you
and a testable build.

### Step 0c — crash reporting (OPTIONAL, and off until you do it)

Crash reporting is built and **does nothing without a DSN** — no client is
created at all, so a build made today reports nothing to anyone. That is the
deliberate default.

To switch it on, add the DSN the same way as the other settings:

```bash
cd Elostate-Sales-coach
npx eas env:create --name EXPO_PUBLIC_SENTRY_DSN --type string --visibility plaintext
```

Two things worth knowing before you do:

- **Source maps.** `expo-doctor` notes that a Sentry organisation and project
  are not configured. Without them a crash report shows minified code rather
  than readable line numbers. Setting them is worth doing at the same time,
  through Sentry's own setup.
- **What it will and will not send.** This app records customer conversations,
  so events are scrubbed before they leave the phone: signed recording links,
  anything JWT-shaped, and any long free-text blob (which is far more likely to
  be a transcript than a useful message) are removed, and breadcrumb data is
  dropped entirely. Those rules are pinned by tests.

### Step 1 — sign in to EAS

```bash
cd Elostate-Sales-coach
npx eas login
```

### Step 2 — build a development client

Android first: it is quicker and needs no paid account.

```bash
npx eas build --profile development --platform android
```

For iOS you need an Apple Developer account enrolled; EAS will walk through
signing:

```bash
npx eas build --profile development --platform ios
```

### Step 3 — install it

EAS prints a QR code and a URL when the build finishes. Open the URL on the
phone and install. On Android you will have to allow installing from that
browser once.

### Step 4 — start the bundler and connect

```bash
cd Elostate-Sales-coach
npx expo start --dev-client
```

Scan the QR from the development build (not the camera app).

### If you only want a quick look

Expo Go will run everything except recording:

```bash
cd Elostate-Sales-coach
npx expo start
```

---

## Part 2 — The checks, in the order to do them

> **Read this first — it changes how to interpret everything below.**
>
> I spent two days telling the owner that twelve screens were blocked waiting for
> a backend branch to be merged. **It was already merged.**
>
> **And then I got the correction wrong too.** On 4 September I wrote here that of
> the twenty-six routes this app calls, "exactly one" still refused a phone. Both
> halves of that were untrue by 11 September:
>
> - **That one was fixed.** The "How to do this" guide route was merged and takes
>   a phone token now.
> - **Seven others were refusing phones, and my check could not see them.** It
>   looked for routes that never mention the mobile helper. These all mention it,
>   use it to work out *who you are*, and then read the data without it — so they
>   answered "nothing" to every phone while looking correct to any check. Two of
>   them broke things you use: the voice question, and the Strategy Library.
>   All seven are fixed and re-checked against the live site.
>
> **So read the old guidance with care.** "If a screen shows no data the cause is
> not a backend change" was exactly wrong for those seven. It is closer to true
> now than it has ever been — but the way that class was finally caught was
> driving the real path with a real sign-in, not trusting a claim in a document
> like this one. **If a screen is empty and you think it should not be, tell me
> rather than assuming it is your data.**
>
> **The wording changed on 4 September, and it matters for reading these checks.**
> Ten screens used to say *"Not switched on yet — nothing is wrong with your
> account"*. They now say one of two things, and the difference is the whole
> point: **"You have been signed out"** means sign in again and it comes straight
> back, and **"Not available right now"** means the server turned the request
> down and retrying will not help. If several unrelated screens show the SECOND
> one, that is the signature of an undeployed backend — tell me, rather than
> filing them as separate bugs. If you see the FIRST one, just sign in.

Work down the list. Items 1–6 are the fixes from 3 September that no test can
reach; 7–12 are the standing checks the design law requires; 13–24 cover what
shipped on 4 September.

**Thirty-nine checks is a lot for one sitting.** If you only have twenty minutes, do
**1, 5, 7, 16, 21 and 28** — those are the six where a failure means a rep loses
something (a recording they cannot re-take, unsent words, a shared photo that
never appears, a deal value that vanishes as they swipe back) rather than merely
seeing the wrong thing.

**Build 16 (11 September, ~02:45) is what to test.** It went to TestFlight while
you were asleep; Apple processes for five to ten minutes before it appears. It
is build 15 plus two fixes I would not have wanted you to hit:

- **The first page dot on the door tracker could not be tapped** — its touch
  area was completely covered by the second dot's, so the only non-swipe route
  back to page 0 was dead. Check **36** is that fix.
- **Crashes outside a screen, and every failed background task, were never
  recorded.** They are the two classes you would most want to send me from a
  device pass, and `Report a problem` could not see either. See the note on
  check **25**.

The things nobody has ever seen render are checks **27 to 39** at the end, and
check 28 is the one I would most like a human on: it is a *keyboard*
interaction, which is exactly the class no test here can reach.

**Check 30 is a SERVER change** — it has been live since before build 15, and the
chip that goes with it is in build 16. Read it either way: it explains why more
than half your coaching runs have been producing nothing, which is the largest
single thing I measured.

**Three fixes are NOT in build 16**, deliberately, so that what you find means
one thing: nineteen controls raised from 44dp to the 48dp Android floor, a call
recorded from one side no longer offering a rebuild that cannot work, and five
Expo patch updates. They go in build 17, after you have been through this list.

### 0. The name under the icon (new, 4 September)

Before you open anything: **look at the app's name on your home screen.**

Apple rejected build 3 with `ITMS-90129` — the display name "Sales Coach" is
already taken on the App Store. It is now **"Elostate Coach"**, which is
fourteen characters, and iOS truncates home-screen labels at roughly twelve.

**So the question this check exists to answer is one only a person can:** does it
read as *Elostate Coach*, or as *Elostate C…*? A truncated label is a defect by
this project's own design rules, and no build check can see it.

If it truncates and you would rather it did not, "Elostate" on its own is eight
characters and fits at any text size — say the word and it is a one-line change.

---

**If you have five minutes and nothing else, do check 1.** It now covers the two
things I changed on your say-so and cannot see for myself: the tab labels reading
in full, and the ⋮ menu on Home reaching Account — which is the only route to
signing out on a shared phone. Everything else can wait; those two cannot.

### 1. Macro Mode: can a rep record at all?

Until today the answer was **no** — with Macro Mode on there was no route to the
recorder from anywhere.

1. Home → the **Macro Mode** switch → turn it **on**. (Account also has it, now
   reached from Home's ⋮ menu rather than a tab.)
2. The tab bar should become exactly four tabs: **Home · Pitch Performance ·
   Today's Metrics · Role Play** — and all four labels should read in FULL, with
   no "Pitch Perfo…".
3. Home → **Door Log**.
4. Below the five outcome buttons there should be a filled **Record this pitch**
   button.
5. Tap it. The recorder opens.

**Wrong looks like:** no Record button on the Door Log, or a **fifth tab**, or a
label cut off mid-word.

> **This check has changed twice, and the second time is your photograph.** It
> said "exactly four tabs" until 4 September; then Account was added to both tab
> sets, because hiding it in Macro Mode meant a door rep could not reach Account
> at all and so **could not sign out** — the one thing stopping their calls and
> figures reaching the next person to hold a shared phone.
>
> Five tabs then truncated the labels, which your screenshot showed plainly:
> *Pitch Perfo…* and *Today's M…*. So Account has left the tab bar again and is
> now the first item of the **menu at the top of Home** (the ⋮ button, top
> right). Home is in both modes, so sign-out stays two taps away whichever
> product a rep is in — and that is now pinned by a test rather than by this
> paragraph.

**Then check the menu.** Top right of Home there is a **⋮** button.

1. Tap it. A sheet slides up with **Account** and a line under it mentioning
   signing out.
2. Tap **Account**. The Account screen opens, and **Sign out** is at the bottom.
3. Go back, turn Macro Mode **off**, and do the same from Home again. The menu
   must be there in both modes.

**Wrong looks like:** no ⋮ on Home in either mode, a sheet that will not close
on the dimmed area or the Android back gesture, or a ⋮ that is fiddly to hit —
it is a 44pt target and should not need aiming.

**If the four labels still truncate**, tell me and I will shorten them while
keeping the full names on the screens themselves. I cannot see this from here:
no layout check catches a label that truncates, because nothing overflows.

> **Fixed on 4 September.** That button briefly opened the *coaching-session*
> recorder, which would have filed a pitch where a door rep never looks. It now
> opens the door-pitch recorder. Check 22 exercises the whole path.

### 2. Macro Mode: the escape from a blocked recorder

> **NOT RUNNABLE FROM TESTFLIGHT — skip this one.** It tests what the app does
> when the recorder is missing from the build, which is true in Expo Go and
> false in a production build, where `expo-audio` is compiled in. There is no
> way to make the screen show that state on TestFlight, so there is nothing to
> look at. Mark it "not applicable", not "passed".

1. Still in Macro Mode, open **Record this pitch** in **Expo Go** (where
   recording is genuinely unavailable).
2. The screen explains recording is not in this build, and the button under it
   should read **Door Log** — not "Your sessions".

**Wrong looks like:** the button says "Your sessions", which is a screen that is
not in the macro tab bar at all.

### 3. The tab order, with Macro off

1. Turn Macro Mode **off**.
2. The bar should read **Home · Analytics · Sessions · Team Chat**, in that
   order — four tabs, and Account is not one of them in either mode. It is in
   Home's ⋮ menu.

**Wrong looks like:** Sessions before Analytics. The website puts Analytics
second and a bottom bar is muscle memory.

### 4. The Home grid

1. Home, with Macro off. Below the four existing cards there should be a row of
   two: **One Liners** and **Pitch Analytics**.
2. Tap **One Liners**. If you have eight or more saved lines there is a **Find a
   line** search box; type a word from an objection and the list narrows.

**Wrong looks like:** One Liners reachable only through Account, which is where
it used to be.

### 5. A reply that survives being unsent

This is the one I most want a human to try, because it crosses a crash boundary.

1. Team Chat → open a topic you are a participant in.
2. Tap **Reply** on any message. The compose bar shows "↩ Replying to …".
3. Turn on **aeroplane mode**.
4. Type a message and send it. It should say the message is safe and will send
   when there is signal.
5. **Force-quit the app.** Reopen it and return to the topic.
6. The words should be back in the box **and the "↩ Replying to …" banner should
   still be there**.
7. Turn aeroplane mode off. The message sends by itself, as a reply.

**Wrong looks like:** the words come back but the reply banner does not — the
message would post as a top-level statement under whatever it was answering.

### 6. A send queue that resumes

**Corrected on 4 September.** I previously wrote that this needed the bearer
branch merged. It is already merged — the whole app authenticates against `main`
today. So this is now testable directly:

1. Turn on **aeroplane mode**. Set an outcome on a session. It is held.
2. Turn aeroplane mode off and set an outcome on any session by hand.
3. The held item should send within a moment, **without restarting the app**.

**Wrong looks like:** the held items stay held until you kill and reopen the app.

### 21a. The Sessions list says which calls have come back (new, 4 September)

The question a rep asks every morning, which this list could not answer until
today: four calls recorded yesterday looked identical whether the coaching had
arrived or not, and the only way to find out was to open each one.

1. Record a call and send it. Go to **Sessions**.
2. While the coach is still working on it, the row should read
   **"Being analysed"** under the time and length.
3. Come back once it has finished. That line should be **gone** — not replaced
   with "Analysed". A finished call needs no badge; the transcript is the badge.

4. Find an **old** call that never got a transcript, if you have one. Its row
   should read **"No transcript yet"** — not "Being analysed", and not anything
   claiming it failed. Nobody has checked; all that is certainly true is that
   there is no transcript. The switch happens at five minutes, the same window
   the session screen already stops polling after.

**Wrong looks like:** every row saying "Being analysed", including old calls that
plainly have transcripts. That would mean the count is not being read and the app
is guessing — tell me, because guessing there is the exact thing it was built to
avoid.

5. **Open that old call.** It should say **"This call has no transcript"** the
   moment it opens — not after five minutes of waiting, and not "Still no
   transcript after five minutes", which would be describing a wait that never
   happened. Before today it polled the server twenty times over five minutes on
   a call that was never going to transcribe, and said nothing at all meanwhile.

**Also worth a look:** open Sessions with **no signal**. The list paints from the
cache, and a cached row must show **no** analysis line at all — a cached count is
from whenever it was written, and "Being analysed" on a call that finished
overnight would be a confident false statement.

---

### 22a. The offline door count says BOTH true things (fixed 4 September)

Do this in Macro Mode, still in aeroplane mode, because the defect only existed
while offline — which is this screen's whole reason for existing.

1. **Aeroplane mode on.** Force-close the app and reopen it, so the server total
   genuinely cannot be read.
2. **Log three or four doors.**
3. Look under the tiles on **Home**, then on the **Door Log**. You should see
   **two separate sentences**, not one:
   - that today's totals could not be read from the server, so the figures show
     only this phone;
   - that N doors are still on this phone and will send on their own.

**Why this is here.** Those two were an if / else-if, so a rep saw one or the
other and never both — and the case where both apply is precisely being offline.
On the Door Log the suppressed one was *"the server total could not be read"*, so
a rep in a dead zone read a number that quietly understated their day. On Home
the suppressed one was the reassurance that the waiting doors were safe. Same
defect, opposite order, and in each case the message that disappeared was the one
written for exactly that moment.

**Wrong looks like:** only one of the two sentences, with several doors waiting
and no signal.

If instead you see **"The server has been turning sends down"**, that means the
server is refusing the app's token — tell me, because it would mean `main` is not
deployed rather than that anything here is broken. If it says **"You have been
signed out"**, sign in again: that one is not a bug, and the recording is safe on
the phone either way.

### 7. Recording, end to end

Development build only.

1. Home → **Record a call** (or Door Log → **Record this pitch**).
2. Allow the microphone when asked.
3. Record for ~30 seconds, stop, name it, send it.
4. Check it appears under Sessions.

**Wrong looks like:** a recording that reports a size but never sends. If a
recording is ever flagged "about N MB over what the server accepts", that is the
new warning working — tell me the size and duration.

### 8. Safe areas, on a notched phone

Every screen: nothing under the notch, the status bar, or the home indicator.
Check the Door Log especially — it is the one used one-handed all day.

### 9. Touch targets, walking

Door Log, outdoors if you can. The five outcome buttons should be hittable
without looking. This is the screen the whole app exists for.

### 10. Reduce Motion

1. iOS: Settings → Accessibility → Motion → **Reduce Motion** on.
   Android: Settings → Accessibility → **Remove animations**.
2. Open **Your points**. The Arena gauge should arrive at its value with no
   count-up.

**Wrong looks like:** the number still counts up.

### 11. Large text

1. Set the system font size to the largest setting.
2. Check Scoreboard rows, the Home tiles, and Account. Rows should stack rather
   than crush.
3. **New on 4 September, and I could not check either:** the Today's Metrics
   toggle (`Progress` / `Metrics`) and the ⋮ menu on Home. The two toggle halves
   should still read in full — wrapping onto two lines is fine, the button grows
   to fit; being cut mid-word is not. In the menu, "Account" and the line under it
   should each have their own row rather than colliding.

4. **Pitch Performance** and **Team Chat**, still at the largest text size. A
   pitch name and its outcome (`SOLD`, `NOT HOME`), and a chat topic title and its
   `New` marker, should each sit on **separate lines**, with the name or title
   readable in full. Side by side, the name would be cut to something like
   "Door on 4 S…" — which was true until 4 September and is the reason this step
   exists.

**Wrong looks like:** a name squeezed to one or two characters, a toggle label
cut off, menu text overlapping, or a pitch name still truncated beside its
outcome.

### 12. Screen reader, on one flow

VoiceOver (iOS) or TalkBack (Android), on the Door Log and one chat topic.
Every control should announce what it does. A pinned message should say
"Pinned"; an attachment should announce as "Photo shared", not as silence.

---

### 13. Role Play: where is the conversation happening

New today. The prompt sent to the practice prospect changes with this, so it is
not cosmetic.

1. Role Play → the setup screen.
2. Under the four personas there should be a **Where is this happening** choice:
   **At the door** and **Video call**, with At the door already selected.
3. Pick **Video call** and run a short practice. The prospect should behave like
   someone on a call, and the review should talk about pacing and screen
   presence rather than doorstep timing.

**Wrong looks like:** no such choice, or a video practice that coaches you on
body language at a door.

### 14. A manager's KPI board opens on the company

New today, and only checkable with a manager account (CEO / CFO / COO / admin).

1. Sign in as a manager → the KPI board.
2. It should open on the **whole-company** figures, not "Mine".
3. Switch to **Mine**, then pull to refresh. It must **stay** on Mine — being
   yanked back to company by a refresh is the specific bug this guards.
4. Sign in as an ordinary rep: it should open on their own figures.

### 15. A locked chat says the coach reads it

1. Team Chat → open a topic that is locked (private to its members).
2. Above the messages there should be a **Locked chat** notice saying only its
   members can see it — *and* that the coach still reads it for coaching and
   diagnosis.

**Wrong looks like:** no notice. A rep who believes a chat is private and is not
told the system reads it has been misled, which is the whole point of the notice.

### 16. Chat: pins, attachments, replies and edits

All new today, all in one topic if you can find one with a mix.

0. **Pinning, new on 4 September.** Every message you can post to now has a
   **Pin** control. Tap it: the marker appears only **after** the server
   confirms, never instantly — that is deliberate, because a pin is a claim
   about what the team agreed matters. Tap **Unpin** and you should be **asked
   first**, with a warning naming that your whole team stops seeing it marked.
   System messages have no Pin control, and a rep who can only read a topic
   should see none at all.
1. A **pinned** message shows "Pinned" next to its author and time. Above the
   thread there should be a line counting pinned messages, and it should say
   separately if there are more further back than the page shows.
2. A message someone sent as a **photo or file** must not appear blank — it
   should read "Photo shared — open it on the website" (or Video / PDF / File),
   keeping any caption.
3. A **reply** shows "↩ name: what they said" above it. If the message it answers
   is older than the loaded page, it should still say it is a reply.
4. An **edited** message shows "· edited" beside its time.

**Wrong looks like:** an empty gap where a shared photo should be — that was the
defect, and it is the easiest of these to spot.

### 17. A closed topic says whether the decision held

1. Team Chat → a closed topic.
2. If someone has reviewed the outcome, the closed card says so — "What was
   decided held", or that it was reopened or only partly held.
3. If nobody has reviewed it, it says **nothing** about the outcome. That is
   correct: "unknown" is not a verdict and must not be shown as one.
4. Now find a topic with a decision that is still **open** — the card reads
   "Decision open · 2 of 5" or similar. Under it: **Take part on the website**.
   Tap it. Your browser should open this topic on elostate.com.
5. Come back to the app. Nothing should have been lost — you left, you did not
   navigate away inside the app.

**Wrong looks like:** the open card ends at "It appears here once it is decided"
with no way to get there — that is what this replaced; a browser opening a 404,
which would read as the decision having been deleted; or the link appearing on
a **decided** card, where there is nothing left to take part in.

**Two more of these, same pattern, both only visible when something fails:**

6. **Calibration, if it refuses your token.** Open **Calibration** as a manager.
   If it says it could not be opened, there is now **Open Calibration on the
   website** under the message. Before this it named the website and stopped.
   *(If Calibration opens normally, you cannot see this one — say so rather than
   marking it passed.)*
7. **A topic that is created without adding you.** Rare, and you probably cannot
   force it: start a topic, and IF you see "The topic was created, but you were
   not added to it", there should be **Join it on the website** beneath it,
   opening that topic and not the chat list. *(Almost certainly unreachable on a
   healthy server — mark it "not seen", not "passed".)*

> **Why the phone cannot just do it here.** The website's decision routes accept
> a browser cookie, and this app signs its requests with a token, so a Respond
> button on the phone would fail whoever pressed it. That is an auth shim, not a
> permissions problem — a rep IS allowed to take part, they simply have to do it
> where the app can reach. Worth knowing if you ever want it built properly.

### 18. One Liners and Team Chat search

1. **One Liners** (Home): with eight or more saved lines there is a **Find a
   line** box. Type a word from an objection — the list narrows. Type two words
   and it should narrow *further*, not widen.
2. **Team Chat**: with eight or more topics there is a **Find a topic** box that
   also matches **tags**.
3. In both, a search matching nothing says so and offers a way back — it must
   **not** say you have no lines or no topics.

### 19. Practise a weakness from Training

New today, and it is the one that closes a loop: Training names what to work on,
and now you can act on it.

1. **Training** (from Analytics, or Account). Under **Worth working on** each
   line should have a **Practise this** button. The **What is already working**
   list should have none — practising a strength is noise.
2. Tap one. Role Play opens showing **Practising one skill** and repeating the
   exact wording of the growth area.
3. Pick a prospect, run a few turns, ask for the review. The review should judge
   **that specific skill**, not the pitch generally.
4. Tap **Start over** and confirm. The "Practising one skill" banner must
   **disappear** — the next run is a plain practice.
5. Back on Training, each growth area also has **How to do this**. Tap it: a
   short guide expands — what to do, what usually goes wrong, and lines you can
   adapt, written from your own methodology. Tap **Hide** and reopen: it should
   come straight back **without** loading again.
6. If the coach has nothing for that skill, it says so in one sentence and still
   offers the practice. Four empty headings would be the bug.

**Wrong looks like:** the banner promising a score and the review not mentioning
the skill. That means the focus reached the screen but not the request — it is
exactly the mismatch the linter caught while I was building this.

> **Step 5 needs a deploy before it can pass.** "How to do this" was the last
> coach route that refused a phone. It is fixed on the branch
> `coach-material-bearer-mobile` in the TeamPilot repository, not on `main`. Until
> you review and deploy that branch, expect step 5 to say **"Not available right
> now"** — which is the honest answer, not a bug. Everything else in this check
> works today. Once it is deployed, every coach route this app calls accepts the
> app.

### 20. A missing setting shows a screen, not a vanishing app

Your `boot-crash` choice, built on 4 September. **This one is UNTESTED by me** —
it changes the code that starts the app, and it cannot be exercised from a
laptop, so it wants a deliberate check.

1. Build normally first and confirm the app opens and signs in. That is the
   important half: the change must not break the ordinary path.
2. **Optional, and the only way to prove the fix:** build once with a setting
   missing — remove `EXPO_PUBLIC_SUPABASE_URL` from your Expo environment, build,
   install, open.
3. You should get a **readable failure screen**, not a white screen or an app
   that closes itself. Before this change it died silently.
4. Put the setting back and rebuild.

**Wrong looks like:** the app closing or showing a blank screen in step 3 — that
would mean the throw is still happening before the failure screen can mount.

### 21. Recording a pitch at a door, end to end

The correction of my own mistake, and the longest chain in the app. Do this one
with Macro Mode ON.

1. Home → **Door Log** → **Record this pitch**.
2. Record for ~20 seconds and stop.
3. You should be asked **How did it go?** with **four** choices — Sold, Go back,
   Not the decision maker, Not interested. **There should be no "No answer"**:
   somebody opened the door, and the server would reject it.
4. Choose one. It should say the pitch is saved and offer **Back to the doors**.
5. With signal, wait a moment or open **Recordings** and send it by hand.
6. It should appear under **Pitch Performance** once analysed, and the door
   should be counted in **Today's Metrics**.

**Wrong looks like:** the pitch turning up under **Sessions** instead. That is
the exact bug this fixes — it means the recording went down the coaching-session
path rather than the door-log one.

**Also worth doing:** record a pitch in **aeroplane mode**, choose an outcome,
then force-quit and reopen. The pitch should still be waiting with its outcome
intact, and send itself when signal returns. The outcome is saved *with* the
audio precisely so it survives that.

### 22. Numbers read the same everywhere

Anywhere a total passes a thousand — the Arena odometer, the Scoreboard, Today's
Metrics on **All Time**, the Home tiles — it should read `12,500`, never `12500`.
Seeing both forms in one session is the bug.

### 23. Today's Metrics is now TWO pages

The headline of the dashboard replication spec, and the biggest thing built on
4 September.

> **This screen crashed twice on 4 September, on the first phone it ever ran on,
> and both were mine.** The gesture needed a `GestureHandlerRootView` at the root
> of the app and had none; then, with that fixed, the pager was mixing the legacy
> animation API with a gesture that runs on the UI thread, which cannot share a
> value with it. Both are fixed and both classes are now gated by tests I proved
> by putting each crash back.
>
> Nothing on a laptop could see either one — typecheck, lint and 977 unit tests
> were all green throughout, because none of them mounts a component. **If this
> screen throws a third time, that is worth knowing more than anything else in
> this document.** Send me the whole error.

Macro Mode on.

1. Open **Today's Metrics**. It should land on **Progress** — the Arena, with the
   gauge — not on the door figures. Every open lands there.
2. At the top: a two-part toggle, `[ Progress | Metrics ]`, the active half
   filled amber. Tap **Metrics**. The door figures slide in.
3. Now **swipe** between them with your thumb. The page should follow your finger
   as you drag, not jump when you let go, and snap to whichever page you are
   nearer.
4. Drag **left on Metrics** (past the last page). It should resist and spring
   back, not stop dead against an invisible wall.
5. Scroll each page **up and down**. The vertical scroll must feel completely
   normal — the swipe must never steal it, even with a slightly diagonal thumb.
   Both pages should also **fill the screen**: no band of dead space under a short
   page, and the Metrics page should scroll all the way to the bottom of its
   content rather than stopping early. (Splitting these two screens out of their
   own shells is exactly where that goes wrong, and no check here can see it.)
6. The Arena's **milestone badges** should now show the DAY each was earned
   ("12 Aug") rather than the word "Earned".
6a. **Points earned** should read as an ODOMETER — each digit in its own raised
   amber tile, with a narrow comma between the thousands, not one plain number.
   This matches the website; it was the only element on this screen that visibly
   did not. Put it side by side with elostate.com if you can.
6b. Each entry under **Your best calls** should read *"Elite · 12 Aug"* — the
   band beside the date, not the date alone. "87 points" on its own can only be
   read by somebody who already knows the scale runs to 100.
7. Turn **Reduce Motion** on in iOS/Android accessibility settings and tap the
   toggle again. The page must still CHANGE — it simply changes without sliding.

**Wrong looks like:** a red screen or an error box of any kind — send it whole;
landing on Metrics instead of Progress; a page that only moves after you release; a swipe that fights the vertical scroll; a hard stop at
the end instead of resistance; or a badge still reading "Earned" with no date.

> The gesture rules — when a drag counts as horizontal, how far past an end it
> resists, how far you must drag to commit — are unit-tested and were each proven
> by breaking them. What no test can tell me is how it FEELS in a thumb. Step 3
> and step 5 are the two I most want your opinion on.

### 24. Alerts arrive without a refresh (managers)

1. Open **Alerts** and leave it open.
2. Have a rep finish a session that scores 80+, or mark a session sold.
3. The new alert should appear **without you pulling to refresh** — within a
   second or two if the socket is up, and within a minute regardless.

**Wrong looks like:** nothing arrives until you pull down. Tell me if so; it
would mean migration 0245 has not been applied, not that the app is wrong.

### 25. Report a problem (the new crash reporting)

The point of this one is that **it is the screen you will use to tell me about
every other failure in this list**, so it is worth checking first.

> **Changed 11 September, and it changes what an empty list means.** Until this
> build the log only ever heard about a screen that threw, plus the send failures
> the outbox classifies. Two whole classes were silent: anything thrown outside a
> screen's render, and every failed background task — React Native only watches
> for those in a developer build, so in the app you are holding they vanished
> without trace. Both now reach this screen. You cannot make either happen on
> purpose, so there is no step for it below; what it means is that from now on
> **an empty log after something visibly went wrong is a real signal**, and worth
> telling me about rather than shrugging at.

1. On **Home**, tap the **⋮** menu in the top corner.
2. Two rows: **Account** and **Report a problem**. Tap the second.
3. On a phone where nothing has gone wrong yet it should say *"Nothing has been
   recorded on this phone"* — and it should NOT say the app is working fine.
4. Type a sentence in **What were you doing?**
5. Tap **Send this report**. Your phone's share sheet opens with the report
   already written. Send it to yourself and read it.
6. Switch **Macro Mode** on and repeat step 1. The menu must still have both
   rows. A door rep hits the same bugs a standard rep does.
7. **The noise check, which matters more than it sounds.** Put the phone in
   aeroplane mode, mark two or three calls, wait a minute, turn it back on.
   Then reopen Report a problem. **It should still say nothing was recorded.**
   A dead zone is the normal condition of this job — if losing signal fills
   this list, the list is useless by lunchtime. Tell me if you see entries
   about the network.
8. **The locked-out case, which is the one that matters most.** Sign out. On
   the sign-in screen, scroll to the bottom: **Cannot get in? Report a
   problem**. Tap it. The same screen must open *without signing in*, and a
   report sent from here must say **Account: not signed in** rather than
   leaving a blank. This is the only way somebody who cannot sign in can tell
   you they cannot sign in.
9. **Then press the back arrow.** You must land back on sign-in. If there is no
   back arrow, or the gesture does nothing, say so — a rep who was already
   stuck would then be stuck one screen deeper, which is worse than not having
   the screen at all.

**What the report must contain:** the app version, the phone, your account id,
and your sentence. **What it must NOT contain:** any client name, any transcript
text, or any long `https://...supabase.co/storage/...` link. If you ever see one
of those in a report, stop and tell me — that is a leak, not a cosmetic bug.

**Wrong looks like:** the menu has only Account; the screen is blank rather than
saying nothing was recorded; the share sheet opens empty; the sign-in screen has
no link at the bottom.

---

### 26. Large text, on the five screens that were fixed today

Settings → Accessibility → Display & Text Size → **Larger Text**, drag it
near the top. Then open, in order: **Your team**, **Skills** (the analytics
tab), **Today's Metrics** page two, any **pitch** from the Pitches list, and a
**session with a recording** (the player at the top).

Every one of those has a row that used to put a label beside a number. At this
text size they should now read **down** the screen — label, then number —
never side by side.

On the player, the one to watch is the **timer**: `0:12 / 3:45` beside "Listen
first". That is what a rep looks at while scrubbing, and it was the thing being
pushed off the edge.

**Wrong looks like:** a number cut off at the right edge, or missing entirely
while its label is still there. That second one is the real bug — nothing
overflows, so nothing looks broken; the figure has simply been pushed out of the
row and off the screen.

Put the text size back afterwards.

---

### 27. A dropped call asks whose voice it is (new, 10 September)

**Background, so you can tell a pass from a bug.** Nine of your calls had audio
saved and **no transcript at all** — the oldest from 25 July. The system now
recovers them: it re-reads the audio, and where it can tell which voice is the
rep it labels them automatically. Where it *cannot*, it saves the words anyway
and asks you.

**Two of your own calls are in that state right now**, both from 27 August, and I
have checked them tonight rather than assuming:

| Call | Words waiting |
|---|---|
| **“Initial meeting”** | **691** — it opens *“…the last thing that I messaged you about, Moses, was…”* |
| **“John's Initial Meeting.”** | **121** |

Both were recovered from audio that had been dropped. Both have had four of the
five coaching engines run on them already; only the deep read is missing, and it
is missing for one reason: nothing knows which voice is yours.

**This check matters more than it did this morning.** Until tonight, answering
that question *from a phone was impossible* — the route refused every request
from the app with a permissions error, and the app translated that into “this
call belongs to someone else.” On your own call. That is fixed and verified
against the live site, but no human has done it on a phone yet, and you are the
only person who can: they are your calls.

On the **Sessions** tab, look for a call with **“Needs your voice”** under it.

1. **Open it.** Above the transcript you should see **“Is this your voice?”**
   with a sample line, and two answers: **That is me** and **That is the
   customer**.
2. **The transcript below it** should already be full of words, each line
   labelled **Unattributed** — not empty, and not the word `UNKNOWN`.
3. **The debrief card** should say **“Waiting on one answer”**, not offer a
   read it cannot produce.
4. **Answer it.** Within a few seconds the labels should become **You** and
   **Customer**, the chip should disappear from the list, and the coaching
   should generate.

**Wrong looks like:** the word `UNKNOWN` above each line (that was a real bug on
the website, fixed today — if it appears on the phone, tell me); a debrief card
promising a read and then showing a blank one; or the question reappearing after
you answered it.

**One thing that is NOT a bug:** if you are looking at *someone else's* call as a
manager, you should see **“Not scored yet”** rather than “Needs your voice”, and
no question. Only the rep whose call it is can answer.

---

### 28. The deal value actually saves (new, 10 September)

**This is the one I most want a human on**, and it is in the twenty-minute list.

Measured today: of **9 sessions your company has marked *sold*, not one
carries a deal value**. So Revenue and Average deal on the KPI board can never
produce a number, for anybody. The field was not missing — it was *unreachable at
the end*: it uses a number keypad, which on iOS has **no return key**, and the
value only saved when the field lost focus. Type it, swipe back, gone, with
nothing said.

1. Open any call and set **How did it end** to **Sold**.
2. A **“What was it worth?”** field appears. Type a number — say `1500`.
3. **A Save button should appear** as soon as the number differs from what is
   stored. Tap it.
4. It should confirm: **“Saved — $1,500.”**
5. **Now the real test.** Change the number, and instead of tapping Save, **swipe
   back to the list, then reopen the call.** The new number should be there.

**Wrong looks like:** no Save button appearing; tapping it and getting no
confirmation; or — the original bug — the number being gone when you come back.

**Why it matters beyond this screen:** every deal value that never saved is a
number missing from your revenue metrics permanently. There is no way to recover
one after the fact.

---

### 29. A recording with no audio in it says so, at the door

**Background.** 14 of your 83 door pitches failed permanently, and one of them
was a **five-byte file** carrying a recorded length of **129.8 seconds** — a rep
recorded at a door for over two minutes and the phone handed back a container
with no audio in it. It uploaded fine, the server took it, and it failed five
retries later in a row nobody reads. The rep was never told.

This one is **hard to trigger deliberately**, and I would rather say that than
have you hunt for it. It happened when a recording was interrupted — the timer
kept running while the capture had already stopped.

**What to do:** record a normal pitch and confirm it sends as it always did. That
is the check — that the new guard does **not** refuse a good recording.

**If you can reproduce an interruption** (start recording, then force-quit or let
the phone kill the app mid-recording), the pitch should refuse to send with:
*“This recording came back empty — the phone saved the file but there is no audio
in it… Everything else about this door is saved. If you are still there, record it
again.”*

**Wrong looks like:** a normal recording being refused with that message. That
would mean the size floor is too high, and I would want the exact size from the
Recordings screen.

---

### 30. A call the coach failed on now says so (new, 11 September)

**Background.** This is the biggest number I measured all day: **more than half of
all coaching runs produce nothing**, and the rep was shown nothing about it — no
read, no chip, no reason. 92 of 100 stored declines carried the single word
"no signal", which covered four completely different events.

The ones that fail are the **longer** calls: median 691 transcript words against
357 for the ones that succeed. Thin content would be short, so for most of these
the rep did everything right.

The coach now records *which* empty it hit. A call where the coach **crashed or
came back blank** shows a chip in the sessions list reading **"Read didn't
finish"**, in the same accent as "One-sided" and "Needs your voice", because all
three ask you to do something. A call the coach genuinely read and found little
in stays silent, as it always did.

**What to do:** open Sessions and look down the list. Confirm the chips render on
one line, do not clip at the right edge, and are readable at your normal text
size and at the largest one.

**Important:** you may see **no "Read didn't finish" chips at all**, and that is a
correct result, not a failure. Only declines recorded from tonight onward carry
the new information — every older one stays deliberately silent, because we do
not know which kind it was and guessing would send you to retry a call with
nothing to give. If you record a fresh call and the coach fails on it, that is
when the chip appears.

**Wrong looks like:** the chip on a call that already *has* a read; the chip on
every session at once; or the chip and "One-sided" both showing on the same row —
one-sided is meant to win.

---

### 31. "Your read" — a whole screen the app has never had (new, 11 September)

**Background.** The web has shown the deep read of a call since the coach was
built: what worked, what to work on, and the play you ran without naming it.
**The app has never shown it at all.** You could see your transcript, your
debrief and your scores on the phone, and not the one thing that reads the
conversation end to end.

I built it tonight because I had already shipped a chip that pointed at it.
Check 30's *"Read didn't finish"* told a rep something was broken and gave them
nowhere to go. This is where it goes.

**What to do:** open any finished call with a real conversation in it. Under the
debrief you should see **Your read**.

You will hit one of four states, and all four are correct results:

| What you see | What it means |
|---|---|
| **Your read**, with sections | It worked. Check the quoted lines are *yours* and read naturally. |
| **No read yet** + **Read this call** | Nothing has been made. Tap it — it takes a moment, because it reads the whole conversation. |
| **The read did not finish** + **Try again** | The coach failed on this one. It should say your recording is fine. |
| **Nothing to read on this one**, *no button* | The recording caught no speech. **The absent button is the point** — see below. |
| **That did not work either**, *no button* | You tapped the button and it still produced nothing. |

**Wrong looks like:**

- A **button on the "nothing to read" card.** There must not be one. Offering a
  retry there spends a real charge to produce the same empty answer.
- The words **"not enough of a conversation"** anywhere. That sentence reads as a
  judgement of you and was taken back once already; if it has come back, tell me.
- A read appearing **without you asking**. It should never generate on open —
  that would spend a charge on someone who came to look at the transcript.
- Quoted lines that are the **customer's** words attributed to you.
- Any section heading with nothing under it.

**The one I would look hardest at:** tap **Try again** or **Read this call** and
watch the button. It should say **"Reading the call…"**, be visibly disabled, and
not be tappable twice. Two taps means two charges.

**And what happens if it fails.** I shipped this an hour before writing this and
it had the exact defect it exists to cure: a failed retry put the *same* card
back, with the *same* button, saying nothing about the attempt that had just run.
A rep would tap it forever, paying each time.

So if a retry comes back empty you should now see **"That did not work either"**
— saying your recording is fine, your words are safe, and that asking again now
will most likely do the same — and **no button at all**. If you get the original
message and a live button a second time, that is the bug, and I want to know.

**And the other one: find a LONG read.** I could not see this render, so I
measured the 121 reads already stored to find out how big they really get:

| Part | Longest actually stored |
|---|---|
| The bold line of an item | **248 characters** — a sentence, not a label |
| A quoted line | **357** (55 of them are over 200) |
| The explanation under it | **446** |
| The opening summary | **778** |
| Items in one read | up to **4** strengths and **4** to work on |

At the top of that range a read is roughly **six thousand characters**. I gave
every item its own bordered box so you can skim the bold lines and stop where you
care — otherwise it is a wall. **What to check:** that the boxes are actually
distinguishable from each other, that nothing overflows its border at your text
size, and that you can still find your way down it. If it reads as a wall, the
boxes are not doing their job and I want to know.

---

### 32. Team coaching — a manager screen the app has never had (new, 11 September)

**Background.** I listed all 21 coach pages on the website against all 26 screens
in the app. Every one had a counterpart except this: **the manager's read-out of
what each rep is doing well and where they can grow**, in the words of their own
calls and door pitches.

It could not have had one. The route was browser-only, so a manager holding a
phone could not read their team's coaching at all — the seventh time today I
found that same fault, and the only one where the result was not a broken
feature but a **missing** one.

**Where it is:** **Account → Team coaching**, with the other manager tools.

**What you should see** (checked against the live site tonight, so these are your
real numbers): **seven people**, including **you** (29 calls, 3 door pitches) and
**Moses** (44 calls, 42 door pitches), each with up to six things they are doing
well and six to coach on. Teammates with nothing recorded are **listed anyway**,
saying so.

**Wrong looks like — and this one matters more than a layout bug:**

- **Anything that reads as a ranking.** No positions, no "top", no totals
  comparing one rep to another. The order is your org chart, not a table. If it
  reads like a leaderboard, that is a real defect — the whole surface is built on
  it not being one.
- **A rep with nothing being dropped from the list.** A shorter list is a
  different answer to "how is my team doing".
- **A partial team shown as if complete.** If part of the read fails it should
  say "Not everyone came back" and show nothing, rather than most of it.
- Anything that reads as a judgement of a person rather than a note about their
  work.

**One thing that is NOT a bug:** hand your phone to a rep and open it — they
should see **"For managers"**, plainly, not an error. I checked that tonight:
Rebecca gets refused by the server, not by the screen.

---

### 33. What an empty debrief says now (changed, 11 September)

**Background.** An empty debrief used to say *"there was not enough of a
conversation here for the coach to say anything useful. That is a fact about the
call, not about you."* Build 15 removed that from one case and left it on
another. I found it still live tonight, on **any call with no scores at all** —
and measured **12 of your sessions in that state with more than 100 words from
the rep, the largest 757 words.** Every one of them was reading that sentence.

There is no way to tell "a thin call" from "the scoring failed": the smallest
call that *did* get scored has **one** word from the rep, the largest that did
**not** has 1,153. So it no longer claims either.

**What to do:** open a call whose debrief is empty. You should see one of:

| What you see | What it means |
|---|---|
| **No debrief yet** + **Write it** | Nobody has asked for one. |
| **Your read did not come through** + **Build it again** | It was scored, so there was plenty to say; the write-up failed. |
| **Nothing came back for this call** + **Build it again** | No scores and no write-up. **This button is new** — rebuilding runs the scoring too, so it is the only way out for those 12. |
| **That did not work either**, *no button* | You rebuilt it and it still produced nothing. |

**Wrong looks like:**

- The words **"not enough of a conversation"** anywhere. That sentence is gone
  from all three places it lived; if it is back, tell me.
- **"Nothing came back for this call"** with **no button** — those calls are
  exactly the ones that need one.
- Tapping **Build it again**, waiting, and getting the *same* card back. It
  should change to **"That did not work either"** and stop offering the button.
  Every tap is a real charge, so a button that invites a second identical attempt
  is the defect.

---

### 34. Search your team by name (new, 11 September)

**Background.** The search on **Sessions** looked at the call name, the outcome,
the territory, the approach and the offer — everything visible on a row **except
whose call it was**, which is printed right under the title on a manager's list.

So the most obvious thing a manager would do — read **"Moses: to coach on…"** on
the new Team coaching screen, then go and find his calls — returned an empty
list while his calls sat in it with his name on them.

**What to do:** on **Sessions**, type a rep's first name, then their surname,
then part of it in lower case. Each should narrow the list to that rep's calls.

**Wrong looks like:** an empty list for a name you can see on screen; or a rep
seeing *other people's* calls appear — the name search only has anything to match
against on a manager's list, and a rep's own list should behave exactly as it did
before.

---

### 35. After you run the migration: does Speed appear? (new, 11 September)

**Do this one AFTER `npm run db:apply`, not before.** It is how you confirm the
migration did what it is for.

**Background.** You have six skills. **Speed has never worked for anybody** — not
for you, not for any rep, not once. Open **Account → your skills** now and it
reads no score, from zero calls. That is correct behaviour, not a bug: it refuses
to invent a number, and it has never had an input.

I traced why, across the app, the server and the database:

1. The transcriber returns a **start time for every segment**. It always has.
2. The app **sends it** with every recording.
3. The server **works it out and passes it on** — on both the upload path and the
   recovery path.
4. **One database function drops it.** That function is what 0249 replaces.

**So `npm run db:apply` is not "unblock six calls".** Every call transcribed after
it carries timing, and Speed starts working — for every rep, on every call, from
then on.

**One thing I checked so you do not waste the trip.** The sweep only unblocks
itself if it can *recognise* that 0249 has been applied — it looks for a migration
whose name starts `0249`. Your ledger stores names like
`0248_door_home_screen_sale_value.sql`, so I ran that exact lookup against **0248,
which IS applied**, and it matched. The gate will open. Running the command will
not silently do nothing.

**What to do, in order:**

1. Run `npm run db:apply`.
2. **Wait for twenty past the hour.** That is exactly when the recovery sweep
   runs — so if you run the migration at 9:05, look at 9:20; at 9:25, look at
   10:20. It takes up to 200 calls in one pass and there are six, so one pass
   does all of them, including your 149-second one from 10 September.
3. **Record one new call** of a minute or two, with real speech.
4. Open its **debrief**. Where Speed was blank, there should now be a pace read.
5. Open **Account → your skills**. **Speed** should show a score and a call count
   of at least 1 — it needs three properly timed turns in a call before it will
   say anything, which is deliberate.

**Wrong looks like:** the six calls still empty after the next twenty-past (the
sweep is still declining — tell me, the ledger check is one query); or a **new** call still
showing no Speed after step 3, which would mean a link in that chain I traced is
broken somewhere I could not see from here.

**Not wrong:** your *older* calls still showing no Speed. Nothing back-fills them
— the timing was never captured for those, and inventing it is exactly what this
system does not do.

---

### 36. The door tracker's two pages (fixed 11 September)

This is the second dashboard — the founder's mockup: your door target, with the
original home screen one page across. Macro Mode on, **Home** tab.

> **The dots used to be the buttons and the first one could not be tapped.** Each
> was given a 44pt touch area to clear the accessibility floor, but the two dots
> sit 14pt apart, so the second one's area completely covered the first one and,
> being drawn on top, took every tap aimed at it. The only way back to page 0
> without a swipe was the one control a finger could not reach. The roles have
> swapped: the dots now just show where you are, and **the line underneath is the
> button**. Nothing about the look moved.

1. Open **Home** with Macro Mode on. You should land on **your door target** —
   the dials — with **two dots** underneath, the left one filled amber.
2. Under the dots: **"SWIPE OR TAP FOR THE ORIGINAL HOME SCREEN"**. **Tap that
   line.** The page should move across to the home screen. This is the step that
   was broken — if tapping does nothing, that is the whole point of this check.
3. Now read the line again. It should have **changed** to **"SWIPE OR TAP FOR
   YOUR DOOR TARGET"**. Tap it and you should come back.
4. **Swipe** between the two as well, both ways. Tapping the line and swiping
   must land in the same place.
5. Go to another tab and come back to **Home**. It should be showing **page 0**,
   the door target, again — the page you are on is deliberately not remembered.
6. With a screen reader on, the dots should announce as one phrase — *"Your door
   target, page 1 of 2"* — rather than as two anonymous buttons.

**Wrong looks like:** tapping the line does nothing; the line reads the same on
both pages; the line still says "swipe **left**" (it should name a page, never a
direction — on one of the two pages a direction is always wrong); the dots
respond to taps *instead of* the line; or the page you left on is still showing
when you come back to the tab.

---

### 37. A call recorded from one side (new, 11 September — build 17)

**Your company has 20 of these.** The transcript holds only your voice: the mic
caught you and not the person at the door.

> **What was wrong.** The coach had no conversation to read, so the debrief came
> back blank — but the call still carries scores, because two of them are worked
> out from your side alone. The app saw "scored, but empty write-up", concluded
> the write-up had failed, and offered **Build it again**. Rebuilding runs the
> same write-up over the same one-voice transcript and comes back blank every
> time. **Each tap is a real charge.** So it named the wrong cause and then sold
> you a retry that could not work.

1. Open a call whose debrief is empty. If you cannot find one, the sessions list
   is the fastest route — anything with no read on it.
2. Where it used to say *"Your read did not come through"* with **Build it
   again**, a one-sided call should now say **"Only your side of this call was
   recorded"**, explain that the customer's words were never captured, and say
   the recording is safe.
3. There must be **no "Build it again" button** on that card. That is the
   defect. If you see one, tell me.
4. Instead there should be **Read the recording again**. Tap it. It spends a real
   transcription, so do it once, on one call.
5. Watch what comes back. Any of these is correct, and each says something
   different: the read appears (it worked); *"The words are back — one question
   left"* (it recovered them but needs you to say which voice is yours);
   *"The recording really does hold one voice"* (nothing was lost in writing it
   down — the second voice was never on the recording); or *"It could not
   separate the voices"*.
6. **After any of those except a success, the button must not come back.** Only a
   genuine outage re-offers it. A button that returns after a settled answer is
   an invitation to keep paying for the same nothing.

**Wrong looks like:** "Build it again" still offered on a one-sided call; the
same button reappearing after step 5; or a blank space where the outcome sentence
should be.

### 38. A call whose words never arrived (new, 11 September — build 17)

**Your company has 4 of these right now** — two have waited **eight days**, one
six, one is from today.

> **What was wrong.** They told you *"The recording reached the server and is
> still being turned into a transcript… pull down to check again."* Nothing was
> coming. The website's sweep found the same class sitting in production with the
> oldest **forty-seven days** old. A rep pulling down to check again would have
> pulled for seven weeks.

1. Find a call with a recording but no transcript. Three of the four are yours.
2. It should now say **"The words never came back from this call"** — that your
   recording is safe, that it was never turned into words, that enough time has
   passed that it is not still coming, and **that nothing you did caused it**.
3. There should be a **Read the recording again** button, and it behaves exactly
   as in check 37.
4. **The opposite case matters just as much.** Record something new and open its
   debrief within a minute or two, before the transcript lands. It must still say
   **"Waiting for the transcript"** and offer **no** button. The cut-off is
   fifteen minutes. If a fresh recording is being called a failure, that is worse
   than the bug this fixed — tell me immediately.

**Wrong looks like:** an eight-day-old call still saying "still being turned into
a transcript"; a call from two minutes ago saying the words never came back; or
the re-read button appearing on a fresh recording.

---

### 39. The fifteen recordings on your phone (REV 1 — build 17)

**This is the one to do first, and it is the one with a real consequence
if I have got it wrong.** Your screenshot showed 15 recordings held on the
phone, 13.5 MB, with the button offering to send 3. Twelve of them had no
name typed, and a recording could not be sent until it had one.

> **What changed.** The name is no longer required. Consent is pressing
> record — a rep who recorded a call meant to record it. An unnamed
> recording is now filed under what is actually known: *"Door, Thu 10 Sep
> at 4:53 PM"*. It does **not** guess who the call was with; the app
> cannot know that and will not pretend to.

1. Open **Record a call → the waiting list** on the phone with the 15.
2. The header still says how many are on the phone. The **Send-all button
   should now offer all of the sendable ones, not 3.**
3. On any card with an empty name field, there should be a line reading
   **"Leave this blank and it is filed as Door, ⟨day⟩ at ⟨time⟩. It still
   sends either way."**
4. Type a name on one card. That line should **disappear** — once you have
   named it, the app has nothing to add.
5. **Now the part that matters.** With signal on, leave the screen a
   moment. The recordings should start sending on their own, oldest
   first, one at a time. Watch that they actually clear.
6. **Then check where they landed.** Open Sessions. The unnamed ones
   should be there under their automatic names, not missing and not
   blank-titled.
7. Try the per-card **Send** on an unnamed one. It must NOT say *"Name
   this call first"* any more — that alert claimed the server needed a
   name, and the server never did.

**Wrong looks like:** anything sending under an empty or "null" name; the
Send-all count still stuck at 3; recordings that clear from this screen
but never appear under Sessions; or the "Name this call first" alert.

> **Tell me what this costs you in data.** Twelve recordings going at once
> is 13.5 MB, and the app cannot currently tell wifi from cellular — it
> sends on whatever connection it has. That was already true for named
> recordings; what is new is how many go at once. If that is a problem for
> your reps, say so and I will hold sending to wifi.

---

## What to send back

For anything that fails: the screen, what you did, what you saw. A photo of the
screen is worth more than a description. If a screen shows an error message,
that exact wording tells me which branch of the code you hit.
