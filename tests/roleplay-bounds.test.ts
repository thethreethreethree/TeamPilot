/**
 * The practice setup a rep chooses before a roleplay.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { CONTEXTS, MAX_MESSAGES, MAX_MESSAGE_CHARS, PERSONAS } from '@/lib/roleplay-bounds';
import { MAX_CUSTOM_PROMPT, MAX_FOCUS, MAX_PERSONA } from '@/lib/roleplay-seed';

test('the personas match the website exactly, label and hint', () => {
  // These strings are fed to the model as the prospect's character. A reworded
  // hint here quietly gives phone reps a different prospect from web reps.
  assert.deepEqual(
    PERSONAS,
    [
      { label: 'Skeptical & guarded', hint: 'Slow to trust, needs convincing' },
      { label: 'Busy & rushed', hint: 'Little time, wants it fast' },
      { label: 'Price-focused', hint: 'Objects on cost and value' },
      { label: 'Friendly but non-committal', hint: "Pleasant, won't commit" },
    ],
  );
});

test('the practice context offers both channels, in-person first', () => {
  // The route feeds this into the prompt: in_person coaches on doorstep timing,
  // video on framing and pacing. Hard-coding in_person meant a rep practising a
  // video call was coached on the wrong thing entirely.
  assert.deepEqual(CONTEXTS.map((c) => c.value), ['in_person', 'video']);
});

test('the default context matches the website', () => {
  // The website opens on in_person too. A door rep never has to touch it.
  assert.equal(CONTEXTS[0].value, 'in_person');
});

test('every context has a hint a rep can act on', () => {
  for (const c of CONTEXTS) {
    assert.ok(c.label.trim().length > 0, `${c.value} has no label`);
    assert.ok(c.hint.trim().length > 0, `${c.value} has no hint`);
  }
});

test('every limit matches the number the server actually enforces', () => {
  // Read from main on 2026-09-04, from the roleplay route's own schema:
  //   messages   .max(80)      persona .max(200)
  //   text       .max(4000)    customPrompt / focus .max(600)
  //
  // These are not decoration. If the app's number drifts ABOVE the server's, a
  // rep writes a long message, taps send, and gets a rejection with nothing on
  // screen explaining why — the app believed it was within bounds. Drift BELOW
  // silently truncates something the server would have accepted.
  assert.equal(MAX_MESSAGES, 80, 'server: z.array(Message).max(80)');
  assert.equal(MAX_MESSAGE_CHARS, 4000, 'server: text z.string().max(4000)');
  assert.equal(MAX_PERSONA, 200, 'server: persona z.string().max(200)');
  assert.equal(MAX_CUSTOM_PROMPT, 600, 'server: customPrompt z.string().max(600)');
  assert.equal(MAX_FOCUS, 600, 'server: focus z.string().max(600)');
});
