/**
 * The Arena must be reachable in BOTH modes.
 *
 * WHY THIS IS A TEST AND NOT A COMMENT. The replication spec makes the Arena "page A of Today's Metrics", and the
 * obvious tidy-up after building that pager is to delete the standalone `/progress` route as a duplicate. It is
 * not a duplicate:
 *
 *   The Today's Metrics TAB is macro-only (`href: macro ? undefined : null`). A rep with Macro Mode OFF has no such
 *   tab at all — so for them the pager does not exist, and `/progress` is the ONLY way to their own points, band,
 *   milestones and best calls.
 *
 * Deleting it to match a diagram would silently remove a whole screen for every standard-mode rep, and every gate
 * in this project would stay green while it happened: the file compiles, the tests pass, the bundle exports. The
 * only symptom is a rep who can no longer find their progress.
 *
 * A SOURCE-LEVEL CHECK, deliberately (A33). What is being protected is the existence of a route and of a link to
 * it — neither is a value any behavioural test can observe. It is narrow on purpose: three exact paths, not a
 * crawl of the router, because a check that fires on unrelated navigation edits is one people learn to skip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

test('the standalone Arena route still exists', () => {
  assert.ok(
    existsSync(join(root, 'src/app/(app)/progress.tsx')),
    'progress.tsx is the ONLY route to the Arena when Macro Mode is off — the tab is macro-only',
  );
});

test('the Arena route renders the same page the pager does, not a copy', () => {
  // Two Arenas would drift, and the one a standard-mode rep sees would be the one nobody was looking at.
  assert.match(read('src/app/(app)/progress.tsx'), /from '@\/components\/arena-page'/);
  assert.match(read('src/app/(app)/(tabs)/metrics.tsx'), /from '@\/components\/arena-page'/);
});

test('something still links to it — a route with no link is not reachable', () => {
  // A31: schema-complete is not built. A route that exists and compiles but that nothing navigates to is a screen
  // no person can open, which is indistinguishable from a screen that was deleted.
  const linkers = ['src/app/(app)/(tabs)/account.tsx', 'src/app/(app)/scoreboard.tsx'];
  const linked = linkers.filter((rel) => read(rel).includes("'/(app)/progress'"));
  assert.ok(
    linked.length > 0,
    `nothing links to /(app)/progress any more — checked ${linkers.join(', ')}`,
  );
});

test('the Today\'s Metrics tab is still macro-only, which is WHY the route above matters', () => {
  // If this ever stops being true — if the tab becomes visible in both modes — the reasoning above changes and
  // these tests should be revisited rather than blindly kept. Pinning the premise makes that visible instead of
  // leaving three tests defending a condition that no longer holds.
  const layout = read('src/app/(app)/(tabs)/_layout.tsx');
  const metricsBlock = layout.slice(layout.indexOf('name="metrics"'));
  assert.match(
    metricsBlock.slice(0, 260),
    /href: macro \? undefined : null/,
    "the metrics tab is no longer macro-only — re-check whether /progress is still the only standard-mode route",
  );
});
