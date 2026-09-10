# App Store listing — copy to paste

Written from what the app actually does, screen by screen. Nothing here claims a feature that is not built, and
there are no invented figures or testimonials — the design law bans them and Apple's review notices them.

Character limits are Apple's; each block is inside its limit and the count is given so you can edit without
guessing.

---

## App name (30 characters)

```
Elostate Sales Coach
```

*20 characters.* The bundle already sets the home-screen name to **Sales Coach**, which is what appears under the
icon. The store name carries the brand; the icon name stays short so it does not truncate on a phone.

---

## Subtitle (30 characters)

```
Coaching for door-to-door
```

*24 characters.* Says who it is for in three words. "Sales coaching" alone would put you against every CRM in the
store; "door-to-door" is the thing that makes this findable by the people it is for.

**An alternative, if you would rather lead with the mechanic than the audience:**

```
Record. Score. Knock again.
```

*26 characters.*

---

## Promotional text (170 characters — editable without a new build)

```
Log every door in one tap. Record a pitch and get it scored on what actually matters — the opener, the objection, the close. Practise before you knock.
```

*150 characters.* This is the field you can change any time without resubmitting, so use it for whatever you are
currently emphasising with your teams.

---

## Description (4000 characters)

```
Elostate Sales Coach is built for representatives who knock doors for a living.

Most sales tools are written for someone at a desk. This one is written for the ninety seconds between one door
and the next.

LOG EVERY DOOR, FAST
One tap per door: not home, not interested, go back, sold. Your counts for the day are on the screen before you
reach the next house. It works with no signal — everything is held on the phone and sends itself when you have a
bar again.

RECORD A PITCH AND SEE WHY IT WORKED
Press record and put the phone in your pocket. Afterwards you get a transcript and a score across the things that
decide a sale: your opener, how you handled the objection, your tone, your questions, and the close. Not a verdict
— the specific moments, with what to do differently.

PRACTISE BEFORE YOU KNOCK
Role Play puts you in front of a prospect who pushes back. Pick the situation, run the conversation, ask for a
review. Practise the one skill your coaching says to work on, and get scored on that skill rather than on the pitch
in general.

YOUR OWN LINES, KEPT
When something you said works, it is saved with why it worked and the call it came from. Your best lines stop
being the ones you happen to remember.

SEE WHERE YOU ACTUALLY ARE
Your points, your band, your best calls and your last seven sessions in one place. A team scoreboard shows where
you stand — totals and rank only. Nobody sees anybody else's individual calls or scores; that stays between a
representative and their manager.

FOR MANAGERS
Alerts when a rep has a strong session or closes a deal. A weekly summary of the team. And Score Calibration, which
shows you an anonymised transcript, asks you to score it blind, and then reveals what the system scored — so you
can see whether the coaching your team is getting agrees with your own judgement.

BUILT FOR THE FIELD, NOT THE OFFICE
Works offline and catches up later. High contrast, for reading outdoors. Nothing you record is lost because you
walked out of signal.

Elostate Sales Coach requires an Elostate account, provided by your company.
```

*Roughly 1,850 characters.* Every claim maps to something built:

| The listing says | Where it lives |
|---|---|
| One tap per door, works offline | Door Log, with the on-phone queue |
| Record with the phone in your pocket | the background audio mode |
| Transcript and a score across five dimensions | the after-pitch flow |
| Practise one specific skill and be scored on it | Training → Role Play with a focus |
| Your lines with why they worked | One Liners |
| Points, band, best calls, last seven | the Progress page |
| Totals and rank only; per-session detail stays private | the Scoreboard, and the RLS behind it |
| Alerts, weekly summary, blind calibration | the manager surfaces |
| Requires an account from your company | there is no sign-up in the app |

**"Not a verdict — the specific moments"** is the line I would keep if you cut for length. It is the product's
actual argument, and it is what the coaching genuinely does.

### Two claims I wrote and then cut, because I could not stand behind them

- **"Readable in sunlight."** A marketing claim about a physical condition I cannot test. Replaced with
  "high contrast, for reading outdoors" — which describes the design honestly and lets the reader draw the
  conclusion. The contrast itself is verified: 13 token pairs at WCAG AA.
- **"Large text supported throughout."** Not true as written, so the line is gone rather than softened.

  Then I went looking for what "throughout" would actually require. The shape that breaks at an accessibility text
  size is specific — a label beside a value, where the label is capped at one line and TRUNCATES rather than wraps.
  Searching for that exact shape found five candidates and **one real defect**: the Pitch Performance rows, where a
  rep would read "Door on 4 S…" beside "SOLD". **Fixed** — the row stacks at large text, the same treatment the
  Scoreboard already had.

  The other four were false positives worth naming: two pair text with a fixed-width switch, and two let the label
  wrap beside a two-character number. Both are the correct pattern already.

  Then I finished the job. Every remaining one-line cap in the app was read and judged individually: **four were
  real and are fixed** (Pitch Performance, Team Chat, Sessions, and the KPI call sources), **three were already
  correct** and were left alone (Analytics, Alerts and Training pair a wrapping label with a fixed control), and one
  caps a three-character day label, which cannot truncate.

  **A second sweep on 4 September found a worse version of the same class**, which the first pass had missed
  because it only looked at one-line caps. A row where **neither** side can shrink does not truncate at all — the
  label simply pushes the number off the edge of the screen, and nothing overflows, so no layout check can see it.
  That shape was in the recording player (the playback timer), Today's Metrics page two, and a pitch's score rows.
  All three are fixed, along with two more that merely wrapped badly.

  **Ten screens honoured large text before today. Eighteen do now.**

  The claim still stays out of the description, and the reason has not changed: "supported throughout" invites
  someone to test every screen, and eighteen of them have been tested by nobody on a device. **That is check 26.**
  Once you have run it and it holds, the line is yours to put back — and it will be a true one.

An App Store description is read by a reviewer looking for exactly this kind of overstatement, and by a customer
who will notice within a day. Neither line was worth the risk.

---

## Keywords (100 characters, comma-separated, no spaces after commas)

```
door,knocking,canvassing,field sales,pitch,objection,roleplay,coaching,rep,closing,d2d,solar
```

*91 characters.* Notes on the choices:

- **Do not repeat words from the app name or subtitle** — Apple indexes those already, so spending characters on
  "sales" or "coach" wastes them.
- **d2d** is what the trade actually types.
- **solar** is there because it is the biggest door-to-door vertical; drop it if your customers are elsewhere and
  put their word in instead. This is the one line worth tuning per market.

---

## Support URL and Marketing URL

```
Support:   https://elostate.com
Marketing: https://elostate.com
Privacy:   https://elostate.com/privacy
```

**The privacy URL is required, and the page it points at must cover audio recording** — see
`APP-STORE-SUBMISSION.md` §3. That branch is written and needs deploying before you submit.

---

## Age rating

**4+.** The app has no objectionable content, no user-generated content visible to strangers, no ads, and no
in-app purchases. Team chat is between colleagues at one company, which is not "unrestricted web access" and not
open social content.

---

## Category

**Primary: Business.** **Secondary: Productivity.**

Business is where sales tools are looked for. It is also a less crowded chart than Productivity, which helps a new
app more than the extra traffic would.

---

## "What's New" for version 1.0.0

```
First release.
```

Apple accepts it, and it is true. Save the space for 1.0.1, where a real list means something.
