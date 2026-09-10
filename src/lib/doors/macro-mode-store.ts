/**
 * The remembered answer to "is this rep in Macro Mode?".
 *
 * SPLIT FROM THE API CALL, following the rule this project has now arrived at
 * the hard way — five times: anything that reaches the network drags a native
 * module behind it and cannot load under the test runner, so if the SIGN-OUT
 * SWEEP must clear it, the clear lives in a module with no network imports.
 *
 * The sweep is the security boundary that stops one rep's data reaching the next
 * person to hold the phone. It has to be testable, so nothing it touches may sit
 * behind Supabase or expo/fetch.
 *
 * THIS IS A CACHE, NOT THE TRUTH. The server owns the setting
 * (`profiles.macro_mode_enabled`). This exists so the app opens into the right
 * product on the first frame instead of flickering through the wrong one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (userId: string) => `macro-mode.v1.${userId}`;

/** The last answer the server gave, or null if it has never answered. */
export async function readCachedMacroMode(userId: string): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (raw === 'on') return true;
    if (raw === 'off') return false;
    return null;
  } catch {
    return null;
  }
}

export async function cacheMacroMode(userId: string, enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), enabled ? 'on' : 'off');
  } catch {
    // A cache that will not write costs a flicker on the next launch, nothing more.
  }
}

/** Called on sign-out: the next rep on this phone may work a different way. */
export async function clearCachedMacroMode(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* nothing to recover */
  }
}
