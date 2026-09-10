/**
 * The rep's own profile row.
 *
 * WHY THIS EXISTS. The home screen greeted people by a name derived from their
 * EMAIL — so `johnsyramos@gmail.com` rendered as "Johnsyramos". The web app does
 * not guess: it reads `profiles.full_name` and shows "Johns Ramos". Guessing a
 * person's name from an address is the kind of small wrongness that makes the
 * whole screen feel like it does not know who you are.
 *
 * NO ENDPOINT NEEDED. The web reaches this through a settings route because a
 * browser page cannot query the database. This app reads Supabase directly under
 * the same RLS, so it asks for its own row — one query, no server change, and
 * the policy rather than a parameter decides what comes back.
 *
 * CACHED IN MEMORY FOR THE SESSION. A name does not change while someone is
 * walking a street, and re-reading it on every screen focus would spend a
 * request on an answer that cannot have moved.
 */
import { supabase } from '@/lib/supabase';
import { getCachedProfile, putCachedProfile, clearCachedProfile, type Profile } from './profile-cache';

export { clearCachedProfile };
export type { Profile };

/**
 * The caller's own profile, or a null name.
 *
 * Never throws. A failed read means the screen greets them without a name,
 * which is a small loss; an exception here would take the home screen down.
 */
export async function readMyProfile(userId: string): Promise<Profile> {
  const held = getCachedProfile(userId);
  if (held) return held;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, company_id, role, sales_coach_role')
      .eq('id', userId)
      .maybeSingle();
    if (error) return { fullName: null, companyId: null, companyRole: null, salesCoachRole: null };
    const profile: Profile = {
      fullName: typeof data?.full_name === 'string' && data.full_name.trim()
        ? data.full_name.trim()
        : null,
      companyId: typeof data?.company_id === 'string' ? data.company_id : null,
      companyRole: typeof data?.role === 'string' && data.role.trim() ? data.role.trim() : null,
      salesCoachRole:
        typeof data?.sales_coach_role === 'string' && data.sales_coach_role.trim()
          ? data.sales_coach_role.trim()
          : null,
    };
    putCachedProfile(userId, profile);
    return profile;
  } catch {
    return { fullName: null, companyId: null, companyRole: null, salesCoachRole: null };
  }
}
