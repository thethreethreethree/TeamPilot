/**
 * Where the rep's own name is held between screens.
 *
 * SPLIT FROM THE READER, and this is the FIFTH module in this project split for
 * the same reason — so it is worth naming the pattern rather than the instance.
 * Anything that touches Supabase drags React Native polyfills behind it and
 * cannot load under the test runner. The thing that keeps getting stranded
 * behind that wall is the SIGN-OUT SWEEP, which is the security boundary that
 * stops one rep's data reaching the next person to hold the phone.
 *
 * The rule this project now follows: if a sweep must clear it, the CLEAR lives
 * in a module with no imports.
 */
export type Profile = {
  fullName: string | null;
  /**
   * Needed to POST a chat message: `chat_messages.company_id` is NOT NULL and
   * the insert policy checks it equals the caller's company. PostgREST has no
   * default for it, so the app must send it.
   */
  companyId: string | null;
  /** The platform-wide role. Read-only here; an admin changes it in Elostate. */
  companyRole: string | null;
  /**
   * The seat inside Sales Coach specifically. null means the rep has not been
   * added to Sales Coach yet — a real state the web names out loud, and NOT the
   * same thing as a failed read.
   */
  salesCoachRole: string | null;
};

let cached: { userId: string; profile: Profile } | null = null;

export function getCachedProfile(userId: string): Profile | null {
  return cached && cached.userId === userId ? cached.profile : null;
}

export function putCachedProfile(userId: string, profile: Profile): void {
  cached = { userId, profile };
}

/** Called on sign-out. A name is not much, but it is still this person's. */
export function clearCachedProfile(): void {
  cached = null;
}
