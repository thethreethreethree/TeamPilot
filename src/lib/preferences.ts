/**
 * The two per-user preferences the web's Sales Coach settings exposes to a rep:
 * Learning Mode and Experience Mode.
 *
 * NO SERVER CHANGE NEEDED FOR EITHER. Both live on `profiles`, and migration
 * 0090 — the one that froze the authz-bearing columns against direct writes —
 * names `learning_mode_enabled` in its own comment as a field "a user may still
 * edit". `experience_mode` is not in its frozen list either. So the phone writes
 * them directly under RLS, exactly as it reads the rep's name.
 *
 * UNKNOWN IS A REAL STATE, AND IT IS NOT A DEFAULT. It would be easy to read a
 * missing `experience_mode` as 'expert', because that is what migration 0110
 * backfilled existing rows to. It would also be wrong: absent here means the
 * phone could not READ the value, and a rep who is actually on Standard would be
 * shown Expert. Then one tap — meant to change nothing — writes Expert over
 * their real setting. A control that cannot be read is shown as unread.
 *
 * A PENDING LOCAL CHANGE BEATS THE SERVER. This is the rule this app already
 * learned the hard way on Macro Mode: a rep toggles something in a basement, the
 * write cannot go out, and a background refresh then snaps the switch back to
 * the server's stale answer. To the rep that is the app silently undoing them.
 * What they last chose is what they see, until the write actually lands.
 */

/** The column's CHECK constraint, mirrored. */
export type ExperienceMode = 'standard' | 'expert';

export type Preferences = {
  /** null = could not be read. Never a guess. */
  learningMode: boolean | null;
  experienceMode: ExperienceMode | null;
};

export const UNREAD: Preferences = { learningMode: null, experienceMode: null };

export function readLearningMode(raw: unknown): boolean | null {
  return typeof raw === 'boolean' ? raw : null;
}

export function readExperienceMode(raw: unknown): ExperienceMode | null {
  // Anything outside the CHECK constraint is treated as unreadable rather than
  // coerced. A value the phone does not recognise is not a value it may write back.
  return raw === 'standard' || raw === 'expert' ? raw : null;
}

/** What a row from `profiles` means. */
export function readPreferences(row: {
  learning_mode_enabled?: unknown;
  experience_mode?: unknown;
} | null): Preferences {
  if (!row) return UNREAD;
  return {
    learningMode: readLearningMode(row.learning_mode_enabled),
    experienceMode: readExperienceMode(row.experience_mode),
  };
}

/** A change the rep made that has not been confirmed by the server yet. */
export type PendingPreferences = Partial<Preferences>;

/**
 * What the screen shows: the server's answer, with anything the rep has changed
 * since laid over the top.
 */
export function effectivePreferences(
  server: Preferences,
  pending: PendingPreferences | null,
): Preferences {
  if (!pending) return server;
  return {
    learningMode:
      pending.learningMode === undefined || pending.learningMode === null
        ? server.learningMode
        : pending.learningMode,
    experienceMode:
      pending.experienceMode === undefined || pending.experienceMode === null
        ? server.experienceMode
        : pending.experienceMode,
  };
}

/**
 * Is a preference still waiting to reach the server?
 *
 * Used to say so on screen. A rep who changed something offline is told it is
 * held on the phone rather than being left to wonder — the same sentence the
 * door log gives them.
 */
export function isPending(
  server: Preferences,
  pending: PendingPreferences | null,
  key: keyof Preferences,
): boolean {
  const held = pending?.[key];
  if (held === undefined || held === null) return false;
  return held !== server[key];
}

/** Plain English for the current experience level. Never invented when unread. */
export function experienceLabel(mode: ExperienceMode | null): string {
  if (mode === 'standard') return 'Standard';
  if (mode === 'expert') return 'Expert';
  return 'Not loaded';
}
