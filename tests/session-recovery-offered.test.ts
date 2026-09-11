/**
 * A CALL WHOSE WORDS NEVER CAME MUST BE OFFERED THE FIX, NOT JUST TOLD ABOUT IT.
 *
 * WHAT WENT WRONG, AND WHY NO OTHER GATE COULD SEE IT. Two screens in this app show the same
 * failure - a call whose audio reached the server and whose transcript never did. The door-pitch
 * card offered the one action that repairs it, `/auto-recover`. The session detail screen named the
 * problem in a notice and offered nothing. Same failure, same table, two different amounts of help
 * depending on which screen the rep happened to open.
 *
 * Every gate stayed green throughout: both files compile, every pure rule in `transcript-recovery`
 * was tested and passing, and the button's absence is not a value any of them can observe. The only
 * symptom is a rep looking at a dead call with no way forward - and the sessions list now FLAGS
 * those calls, so the app points at them deliberately.
 *
 * THE SERVER'S HALF IS ALREADY DONE, which is what makes the absence a defect rather than a gap.
 * `/auto-recover` used to refuse a call with audio and no transcript at all: its precondition read a
 * talk ratio, and an empty transcript has none. The route's own note records nine such sessions
 * sitting in production, none ever attempted. That was replaced on 10 September 2026 with "a
 * transcript missing an entire SIDE is recoverable" - and a blank transcript is missing both.
 *
 * A SOURCE-LEVEL CHECK, deliberately (A33). What is protected is that an ACTION is reachable from a
 * screen. That is not a value a behavioural test can observe: this screen imports native modules and
 * cannot be rendered here at all. Narrow on purpose - the wiring, the two gates that must stay on
 * it, and nothing about layout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const detail = read('src/app/(app)/[id].tsx');

test('the session screen can actually start a re-read', () => {
  assert.match(
    detail,
    /import \{ reReadRecording \} from '@\/lib\/after-pitch'/,
    'the screen that reports "no transcript is coming" must be able to do something about it',
  );
  assert.match(detail, /reReadRecording\(id\)/, 'and must actually call it for THIS session');
});

test('the offer is the owner\u2019s alone', () => {
  /*
    A18, and the server's rule rather than a courtesy: /auto-recover writes the canonical transcript
    through the service role. A manager reading a rep's call must not be able to fire it on their
    record. The check reads the loaded session's own agent_id — not the mere fact that the screen
    opened, which a manager can also do.
  */
  assert.match(detail, /exportSource\?\.session\.agent_id === userId/);
  assert.match(detail, /ownsThisCall &&/, 'the button must be gated on it, not merely compute it');
});

test('it consumes the shared rule for when to ask again, rather than restating it', () => {
  /*
    Every terminal except `failed` is settled: asking again runs the same work over the same audio,
    reaches the same place, and costs another speech-to-text charge. `canAskAgain` owns that. A
    screen that re-derived it would be this project's duplicated-rule failure - a tested rule in
    lib/ re-implemented inline, which then drifts.
  */
  assert.match(detail, /canAskAgain\(recoveryStatus\)/);
  assert.doesNotMatch(
    detail,
    /recoveryStatus === 'failed'/,
    'that comparison IS canAskAgain — call it instead of copying it',
  );
});

test('the timing-loss note is not nested in the notice that success destroys', () => {
  /*
    THE BUG THIS PINS. A re-read that works reloads the screen, the transcript arrives, and the
    "no words are coming" notice is torn down on the spot. Anything nested inside it goes too.
    TIMING_LOST_NOTE is the one sentence that must outlive that moment - it is what a rep reads when
    the words came back and the call's pacing did not. Rendered inside, it would flash and vanish in
    exactly the case it exists for, and nobody would ever read it.

    Checked by position: the note must appear BEFORE the notice block, as its own sibling.
  */
  const note = detail.indexOf('{TIMING_LOST_NOTE}');
  const notice = detail.indexOf('{pollingGaveUp ? (');
  assert.ok(note !== -1, 'the note must be on the screen at all');
  assert.ok(notice !== -1, 'the wait notice must still be there');
  assert.ok(
    note < notice,
    'TIMING_LOST_NOTE must render outside the notice — a successful re-read unmounts that notice',
  );
});

test('EVERY re-read button states its price before the tap, not after', () => {
  /*
    THE DEFECT THIS EXISTS FOR, and it was mine.

    Recovering a call can permanently cost it its pacing - the words come back, the timing behind
    them does not, and nothing retries. The app explained that only AFTERWARDS, in
    TIMING_LOST_NOTE. An action whose price is disclosed after payment is not a choice the person
    made, and there is no undo: six real calls in production carry this button right now, the
    oldest recorded on 10 August.

    SWEPT RATHER THAN LISTED. The rule is "wherever this button renders, the cost renders above
    it" - so the test finds the buttons itself. Naming the two files I happened to know about
    would pass forever while a third screen shipped the button bare, which is exactly how the
    session screen came to offer a fix the pitch card had offered for weeks.
  */
  const BUTTON = "'Reading the recording…' : 'Read the recording again'";
  const files = [
    'src/app/(app)/[id].tsx',
    'src/components/after-pitch-card.tsx',
  ];

  // First: the list above is still the whole set. A new file carrying the button must join it.
  const swept = execSync(
    'git grep -l "Read the recording again" -- "src/**/*.tsx"',
    { cwd: process.cwd(), encoding: 'utf8' },
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  assert.deepEqual(
    swept.slice().sort(),
    files.slice().sort(),
    'a new screen offers the re-read — give it the cost note and add it here',
  );

  for (const rel of files) {
    const src = read(rel);
    let from = 0;
    let seen = 0;
    for (;;) {
      const btn = src.indexOf(BUTTON, from);
      if (btn === -1) break;
      seen += 1;
      const note = src.lastIndexOf('{RECOVERY_COST_NOTE}', btn);
      assert.notEqual(note, -1, `${rel}: a re-read button with no price stated`);
      // Within the same block, not left over from an earlier one further up the file.
      assert.ok(
        btn - note < 2000,
        `${rel}: the cost note is too far above this button to belong to it`,
      );
      from = btn + 1;
    }
    assert.ok(seen > 0, `${rel}: expected at least one re-read button`);
  }
});
