/**
 * What the home screen says, worked out from what the app already has.
 *
 * WHY IT IS A PURE FUNCTION. The home screen is the first thing a rep sees, and
 * the numbers on it are the ones they will quote at themselves all day. Deriving
 * them inside a component would make them untestable and would tempt a later
 * change into computing "today" one way here and another way on the sessions
 * list — the two screens would then disagree about the same calls, and a rep
 * would have no way to tell which was lying.
 *
 * IT INVENTS NOTHING. Every figure comes from sessions the app has actually
 * fetched, and the view says so where that matters: a count over a page of
 * results is not a count over a career, and `partial` carries that fact to the
 * screen instead of leaving it to be assumed.
 *
 * WHAT IT MIRRORS. The web app's mobile home puts a row of three counts under
 * the greeting — doors knocked, presentations, sold. This app records calls
 * rather than doors, so the three honest equivalents are: calls today, calls
 * with no outcome, and recordings still on the phone. Same shape, same glance,
 * numbers this app can actually stand behind.
 */
import type { CoachingSession } from '@/types/backend';
import { count } from '@/lib/format';

export type HomeStat = {
  key: string;
  /** The number, already a string so "—" is a legal value rather than a lie. */
  value: string;
  /** Short, uppercase on screen. Kept in sentence case here. */
  label: string;
  /**
   * True for the one tile that most deserves the eye. The web home outlines
   * SOLD; here it is whatever the rep can act on right now, because a home
   * screen that highlights a number nobody can change is decoration.
   */
  emphasis?: boolean;
  /** What a screen reader says. The tiles are numbers without their own sentence. */
  spoken: string;
};

export type HomeView = {
  /**
   * The name the web greets people with — "Johns Ramos", straight from
   * `profiles.full_name`. Null when the profile carries none.
   *
   * PREFERRED OVER `firstName` because the web shows the whole name and the two
   * products are meant to read as one. `firstName` remains as the fallback for
   * an account with no profile name at all.
   */
  fullName: string | null;
  /** "Johns" — a first name, or null when the app genuinely does not know one. */
  firstName: string | null;
  stats: HomeStat[];
  /** True when the counts cover only the sessions loaded so far. */
  partial: boolean;
};

/**
 * A first name from whatever the account actually carries.
 *
 * Returns null rather than guessing. An email local part like `j.ramos+work` is
 * not a name, and greeting someone as "J.ramos+work" is worse than greeting
 * them without one — the screen simply says "Welcome" and nobody is
 * misaddressed by a string that was never meant to be read aloud.
 */
export function firstNameFrom(fullName?: string | null, email?: string | null): string | null {
  const full = (fullName ?? '').trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    if (first) return first;
  }
  /**
   * THE EMAIL IS NOT A NAME, and this used to try anyway.
   *
   * It accepted any all-letters local part, so `john@company.com` became "John"
   * — which reads well — and `johnsyramos@gmail.com` became **"Johnsyramos"**,
   * which does not. There is no rule that separates the two: both are letters,
   * and the difference is only that one happens to be a name.
   *
   * The docstring above already argued this case and the code did not follow it.
   * The example in the Home screen's own header comment is the owner's address,
   * named there as the bug that was fixed — it was fixed for a profile that HAS
   * a name, and this path is what a profile without one still hit.
   *
   * THE WEB SETTLES IT. `dashboard/sales-coach/page.tsx` reads `fullName ?? null`
   * and renders `{name ?? "back"}`. It never looks at the email. This app is
   * meant to read as the same product, so it does the same: no name means
   * "Welcome back", which is warm, correct, and impossible to get wrong.
   */
  void email;
  return null;
}

/** Sessions that started on the same calendar day as `now`, in local time. */
export function startedToday(rows: CoachingSession[], now: Date = new Date()): CoachingSession[] {
  return rows.filter((s) => {
    const at = new Date(s.started_at);
    if (Number.isNaN(at.getTime())) return false;
    // Compared component-wise in LOCAL time. Comparing ISO date prefixes would
    // put a 9 p.m. call into tomorrow for every rep west of Greenwich — the
    // same class of bug this app already fixed once on the trend screen.
    return (
      at.getFullYear() === now.getFullYear() &&
      at.getMonth() === now.getMonth() &&
      at.getDate() === now.getDate()
    );
  });
}

/**
 * An em dash, never a zero, when a figure could not be worked out.
 *
 * Copied deliberately from the web home, which does the same thing for the same
 * reason: a failed load rendering "0" is indistinguishable from a real zero, and
 * a rep who reads "0 calls today" after a genuine day's work loses faith in
 * every other number on the screen. Their code calls this §3.4 honesty; it is
 * the same rule this app applies to a cached figure.
 */
function figure(n: number | null): string {
  // Grouped, so a rep's totals read the same on every screen.
  return n === null ? '—' : count(n);
}

export function buildHomeView(input: {
  /** Null when the sessions could not be loaded at all. */
  sessions: CoachingSession[] | null;
  /** True when older sessions exist that have not been fetched. */
  hasMore: boolean;
  /** Recordings still on this phone. Null when that could not be read. */
  pendingRecordings: number | null;
  fullName?: string | null;
  email?: string | null;
  now?: Date;
}): HomeView {
  const now = input.now ?? new Date();
  const rows = input.sessions;
  const today = rows ? startedToday(rows, now).length : null;
  const unscored = rows ? rows.filter((s) => !s.outcome).length : null;
  const waiting = input.pendingRecordings;

  const stats: HomeStat[] = [
    {
      key: 'today',
      value: figure(today),
      label: 'Calls today',
      spoken:
        today === null
          ? "Today's calls could not be counted"
          : `${today} ${today === 1 ? 'call' : 'calls'} today`,
    },
    {
      key: 'unscored',
      value: figure(unscored),
      label: 'No outcome',
      // The one a rep can clear in a minute, and the one that decides whether
      // any of their numbers move at all. Never emphasised when unknown — an
      // outlined em dash would draw the eye to nothing.
      emphasis: unscored !== null && unscored > 0,
      spoken:
        unscored === null
          ? 'Calls without an outcome could not be counted'
          : `${unscored} ${unscored === 1 ? 'call has' : 'calls have'} no outcome recorded`,
    },
    {
      key: 'waiting',
      value: figure(waiting),
      label: 'To send',
      spoken:
        waiting === null
          ? 'Recordings waiting could not be counted'
          : `${waiting} ${waiting === 1 ? 'recording' : 'recordings'} still on this phone`,
    },
  ];

  const full = (input.fullName ?? '').trim();
  return {
    fullName: full || null,
    firstName: firstNameFrom(input.fullName, input.email),
    stats,
    // "No outcome" is the count that goes wrong when older calls are unloaded:
    // today's calls are always in the first page, and what is on the phone is
    // known exactly.
    partial: input.hasMore && rows !== null,
  };
}
