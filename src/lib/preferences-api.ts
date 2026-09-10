/**
 * Reading and writing the rep's own preferences, straight to Supabase.
 *
 * NO COACH ROUTE, AND SO NOTHING WAITING ON A DEPLOY. The web reaches these
 * through a settings endpoint because a browser page cannot query the database.
 * This app can: it asks for its own row, and the RLS policy rather than a
 * parameter decides what comes back. `profiles.learning_mode_enabled` and
 * `profiles.experience_mode` are both outside migration 0090's frozen set — that
 * migration's own comment names `learning_mode_enabled` as a field "a user may
 * still edit" — so an ordinary authenticated write is the correct mechanism, not
 * a workaround.
 *
 * THESE ARE THE SAME SETTINGS AS THE WEBSITE. Not a phone-local copy: the same
 * two columns the web's LearningModePanel and ExperienceModePanel write. Turning
 * Learning Mode on here turns it on in Elostate, which is what the web's own
 * comment promises ("flipping here applies everywhere"). Said on screen, because
 * a rep changing a setting on their phone would not otherwise expect it to
 * follow them to a desktop.
 */
import { supabase } from '@/lib/supabase';

import { readPreferences, type PendingPreferences, type Preferences, UNREAD } from './preferences';

/**
 * The rep's own preferences.
 *
 * Never throws. An unreadable answer is UNREAD, and the screen says so rather
 * than showing a switch in a state nobody verified.
 */
export async function fetchPreferences(userId: string): Promise<Preferences> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('learning_mode_enabled, experience_mode')
      .eq('id', userId)
      .maybeSingle();
    if (error) return UNREAD;
    return readPreferences(data ?? null);
  } catch {
    return UNREAD;
  }
}

/**
 * Write a change.
 *
 * Returns whether it landed, rather than throwing: the caller has already shown
 * the rep their own choice and needs to know only whether to keep holding it.
 */
export async function savePreferences(
  userId: string,
  change: PendingPreferences,
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  if (change.learningMode !== undefined && change.learningMode !== null) {
    patch.learning_mode_enabled = change.learningMode;
  }
  if (change.experienceMode !== undefined && change.experienceMode !== null) {
    patch.experience_mode = change.experienceMode;
  }
  // Nothing to send is a success: there is no failure to report and no reason to
  // make the caller special-case it.
  if (!Object.keys(patch).length) return true;

  try {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    return !error;
  } catch {
    return false;
  }
}
