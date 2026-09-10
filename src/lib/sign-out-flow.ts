/**
 * Signing out, in one place, because it now happens from two screens.
 *
 * WHY IT MOVED HERE. The sessions list owned this, and the Account screen needs
 * exactly the same behaviour. Two copies of a sweep is how one of them quietly
 * stops clearing a store somebody added later — and on a shared phone that is a
 * previous rep's coach answers, transcripts and customer names left for whoever
 * signs in next. The sweep is the security boundary, so it gets one definition.
 *
 * WHAT IS SWEPT, AND WHAT IS DELIBERATELY NOT. Everything cleared here is a COPY
 * of something the server still holds; losing it costs a slower screen. What
 * survives sign-out is everything that exists ONLY on the phone — unsent
 * recordings, queued outcomes and names, and knocked doors. Deleting those would
 * destroy the one copy of a conversation, of an instruction the rep gave, or of
 * a day's work at the doors. They are keyed per user, so the next person to sign
 * in cannot see or send them.
 *
 * KNOCKS WERE BRIEFLY IN THE SWEEP, and that was wrong: it would have thrown
 * away an entire day of doors at the tap a rep makes when they finish work. The
 * test below the fold in knock-store is what makes the rule visible; this note
 * is what stops it being 'tidied' back in.
 *
 * THE WARNING IS THE POINT. A rep is told what stays behind BEFORE they confirm,
 * with counts, because "sign out" reads as "finish for the day" and the thing
 * they need to know is that nobody else can send their calls for them.
 */
import { countOutboxOrUnknown } from '@/lib/sync/outbox';
import { countKnocksOrUnknown } from '@/lib/doors/knock-store';
import { countPendingOrUnknown } from '@/lib/audio/recording-store';
import { countDraftsOrUnknown } from '@/lib/chat/draft-store';
import type { StrandedCount } from '@/lib/stranded-count';

export type Stranded = {
  recordings: StrandedCount;
  writes: StrandedCount;
  knocks: StrandedCount;
  drafts: StrandedCount;
};

/**
 * What will still be on this phone afterwards.
 *
 * Returns the counts rather than a sentence so the caller can word it for its
 * own screen, and so this can be tested without a dialog.
 *
 * NULL IS NOT ZERO HERE, AND THAT IS THE WHOLE POINT OF THIS FUNCTION. These
 * four reads used to fall back to 0 on failure, and `signOutMessage` only speaks
 * about a count when it is above zero - so a single failed read did not degrade
 * the warning, it DELETED it. A rep with eight unsent recordings was shown the
 * generic line and nothing else, and signed out believing nothing was waiting.
 *
 * Nothing is lost when that happens: these stores survive sign-out by design.
 * What is lost is the one thing this module exists to say - that the work is
 * still here and nobody else can send it for them. An unknown is never a zero,
 * least of all in the sentence a rep reads before walking away from their day's
 * work.
 */
export async function strandedAtSignOut(userId: string | null): Promise<Stranded> {
  // Signed out already: genuinely nothing of this rep's is waiting, so these are
  // real zeros rather than unknowns.
  if (!userId) return { recordings: 0, writes: 0, knocks: 0, drafts: 0 };
  // The `...OrUnknown` readers, NOT the list readers. `listKnocks` and friends
  // turn a storage failure into an empty list inside themselves, so counting
  // their length can only ever produce a confident zero - which is precisely the
  // silence this function exists to break. A first attempt wrapped the list
  // readers in `.catch(() => null)` and changed nothing at all, because they
  // never reject.
  const [recordings, writes, knocks, drafts] = await Promise.all([
    countPendingOrUnknown(userId),
    countOutboxOrUnknown(userId),
    countKnocksOrUnknown(userId),
    countDraftsOrUnknown(userId),
  ]);
  return { recordings, writes, knocks, drafts };
}

/**
 * The body of the confirmation, built from those counts.
 *
 * Pure, so the exact words a rep reads before losing access to their own calls
 * are covered by a test rather than by whoever last edited the screen.
 */
export function signOutMessage(stranded: {
  recordings: StrandedCount;
  writes: StrandedCount;
  knocks: StrandedCount;
  drafts?: StrandedCount;
}): string {
  const lines = [
    'You will need a connection to sign back in, and this phone will not show your sessions until you do.',
  ];

  // SAID ONCE, AND SAID FIRST, when any of the four could not be counted. A rep
  // deciding whether to sign out needs to know the difference between "nothing
  // is waiting" and "we could not find out" - the second one is the one where
  // signing out might strand a day of work they were never told about.
  const unknown = [stranded.recordings, stranded.writes, stranded.knocks, stranded.drafts].some(
    (n) => n === null,
  );
  if (unknown) {
    lines.push(
      'This phone could not be checked for work that has not been sent yet. Anything unsent stays here and will be waiting when you sign back in, but only you can send it.',
    );
  }

  if ((stranded.recordings ?? 0) > 0) {
    const n = stranded.recordings ?? 0;
    const one = n === 1;
    lines.push(
      `${n} ${one ? 'recording has' : 'recordings have'} not been sent yet. ${
        one ? 'It stays' : 'They stay'
      } on this phone and will be here when you sign back in — but nobody else can send ${
        one ? 'it' : 'them'
      } for you.`,
    );
  }

  if ((stranded.writes ?? 0) > 0) {
    const n = stranded.writes ?? 0;
    const one = n === 1;
    lines.push(
      `${n} ${one ? 'change has' : 'changes have'} not reached the server yet. ${
        one ? 'It stays' : 'They stay'
      } on this phone until you sign back in here.`,
    );
  }

  if ((stranded.knocks ?? 0) > 0) {
    const n = stranded.knocks ?? 0;
    const one = n === 1;
    lines.push(
      `${n} ${one ? 'door has' : 'doors have'} not reached the server yet. ${
        one ? 'It stays' : 'They stay'
      } on this phone until you sign back in here.`,
    );
  }

  if ((stranded.drafts ?? 0) > 0) {
    const n = stranded.drafts ?? 0;
    const one = n === 1;
    // Said because these are WORDS THE REP WROTE that the server has never seen.
    // They survive sign-out like everything above, and a rep who is not told
    // assumes a message they typed was posted.
    lines.push(
      `${n} ${one ? 'message you typed has' : 'messages you typed have'} not been posted yet. ${
        one ? 'It is' : 'They are'
      } still here and will be waiting in the topic when you sign back in.`,
    );
  }

  return lines.join('\n\n');
}

/**
 * Clear every on-device COPY belonging to this rep.
 *
 * Imported lazily and run together. A failure in one store must not stop the
 * others: a half-swept phone that threw is worse than a fully swept one that
 * logged nothing, because the leak is silent either way and this at least
 * minimises it.
 */
export async function sweepDeviceCopies(userId: string | null): Promise<void> {
  if (!userId) return;
  const [
    { clearCachedSessions },
    { clearAllAnswers },
    { clearAllPendingAttributions },
    { clearAllCachedDetails },
    { clearCachedKpi },
    { clearCachedTrend },
    { clearCachedTeam },
    { clearSignedRecordingUrls },
    { clearCachedProfile },
    { clearCachedMacroMode },
    { clearReadMarks },
    { clearCachedPreferences },
  ] = await Promise.all([
    import('@/lib/sync/cache'),
    import('@/lib/sync/coach-answers'),
    import('@/lib/audio/attribution-store'),
    import('@/lib/sync/session-detail-cache'),
    import('@/lib/sync/kpi-cache'),
    import('@/lib/sync/trend-cache'),
    import('@/lib/sync/team-cache'),
    import('@/lib/sync/recording-url-cache'),
    import('@/lib/profile-cache'),
    import('@/lib/doors/macro-mode-store'),
    import('@/lib/chat/read-marks'),
    import('@/lib/preferences-store'),
  ]);

  await Promise.allSettled([
    clearCachedSessions(userId),
    clearAllAnswers(userId),
    clearAllPendingAttributions(userId),
    clearAllCachedDetails(userId),
    clearCachedKpi(userId),
    clearCachedTrend(userId),
    clearCachedTeam(userId),
    // The next person on this phone is not this person, and may not work the
    // same way — the name and the mode both go.
    clearCachedMacroMode(userId),
    clearReadMarks(userId),
    // The CACHE of their preferences. Their unsent CHANGE to one is left alone
    // — it is the only copy and it belongs to them, like an unsent knock.
    clearCachedPreferences(userId),
  ]);

  // In memory rather than on disk, so it is not swept with the caches above and
  // has to be dropped explicitly. A signed link grants whoever holds it access
  // to the audio of a real conversation for as long as it lives.
  clearSignedRecordingUrls();
  clearCachedProfile();
}
