# CHECK — Start Knocking on the page a rep lands on, in the app and the website

## The request, and the two decisions

The founder's REV 1 note (`IOS-APP/REVISIONS/REV 1.pdf`, page 1): *"Put start knocking button at the
bottom."* The app's 09-11 build left it open: the button was already at the bottom of the SECOND Home page,
and the first page — the door target a rep lands on — had none. Picker, 2026-09-29: **"Bottom of the first
Home page."** A second picker, after the website was found to have the identical gap: **"Match it on the
website."**

## What changed

**App** (branch `elostate-sales-coach-app`, `5ddf248d`): one shared `StartKnockingButton`, rendered at the
foot of page 0 (`door-home-page.tsx`) in every state, and by page 1 instead of its hand-built copy. README:
the design-gate command corrected (run from `IOS-APP/`; from inside the app folder it cannot find the
contract and fails G1/G2 — a gate that cried wolf for anyone following the docs) and the stale "930 tests".

**Website**: the same — `doorlog/StartKnockingButton.tsx`, rendered last on `DoorScreen` in all FOUR of its
states (it early-returns for loading, not-rolled-out and error, so each carries it), and by the welcome
page instead of its inline copy.

## Evidence

- App: `tsc` 0 · lint clean · **1,555/1,555** (4 new, source-level — `node --test` cannot render RN) ·
  G1–G4 pass from `IOS-APP/` with the change (434 files) and without it (432). G5 not run.
- Website: `npm run check` CHECK_EXIT=0, 5,543 passed. New `DoorScreen.startKnocking.render.test.tsx` pins
  exactly one button that opens the Door Log in each state. Mutation: remove the early-state buttons → 3 of 4
  fail.
- An existing test (`macroCardVisibility`, "Macro ON") failed after the change: it used `getByText`, which
  demands exactly ONE "Start Knocking". The requirement changed, so the assertion now demands exactly
  **two** — with the decision cited — rather than being loosened to "at least one". The Macro OFF test's
  "none" is unchanged and still passes.
- **[OBSERVED] macro-home.light** — the door target card, three dials (3/80, 2/18, 1/2), TO GOAL, then a
  full-width yellow "Start Knocking" with the door icon, near-black on yellow, last on the page above the
  pager dots and "Swipe left for your home screen". **[OBSERVED] macro-home.dark** — same, on near-black,
  readable.

## Not verified

**Not seen on a phone** — neither the app build nor the website on a real device. The app change reaches
phones only through an EAS build or update, which has not been made.

## Found on the way, and decided

Since REV 1 removed "Undo last", a mis-tapped door cannot be taken back anywhere — the app's own comment in
`door-home-page.tsx` says so, contradicting the 09-11 commit's claim that Home could correct it. Picker,
2026-09-29: **"a quiet undo for a few seconds."** Not built here; it touches how knocks are stored
(append-only, §3.1) and gets its own build.

## Not opened

No image, icon, logo, favicon or graphic asset was created or edited; the door icon is the existing lucide
`DoorOpen`, already used for this button. Two captures generated and opened.
