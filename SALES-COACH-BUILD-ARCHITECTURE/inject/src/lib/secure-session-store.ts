// secure-session-store.ts — the storage adapter Supabase Auth uses to persist the signed-in session.
//
// THE PROBLEM this solves (and why we don't just use AsyncStorage):
//   - A Supabase session is a JWT access token + a refresh token — together several KB.
//   - expo-secure-store is backed by the iOS Keychain / Android Keystore, whose items are practically limited
//     to ~2 KB, so the whole session does NOT fit in SecureStore directly.
//   - AsyncStorage fits it, but AsyncStorage is READABLE plaintext on a rooted/jailbroken device — the V3
//     blueprint §7 forbids leaving anything that authenticates in plaintext.
//
// THE PATTERN (the official Supabase React-Native recipe): encrypt the session blob with a random 256-bit key,
// keep only that tiny KEY in SecureStore (fits the 2 KB limit), and put the ENCRYPTED blob in AsyncStorage.
// A thief with the AsyncStorage file cannot decrypt without the Keychain-held key; the key never leaves secure
// hardware-backed storage. This is the "secrets in Keychain, never plaintext" rule (§7) honored exactly.
//
// Requires: expo-secure-store, @react-native-async-storage/async-storage, aes-js, react-native-get-random-values
// (imported once at app entry — see supabase.ts — so crypto.getRandomValues exists on native).

import "react-native-get-random-values"; // self-sufficient: guarantee crypto.getRandomValues here, not just via supabase.ts import order (idempotent)
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import aesjs from "aes-js";

// SecureStore keys must be alphanumeric + ".-_" — Supabase's storage keys contain characters it dislikes, so we
// namespace + sanitize the key we hand to SecureStore.
function secureKeyFor(supabaseKey: string): string {
  return `sb_enc_${supabaseKey}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function encrypt(supabaseKey: string, value: string): Promise<string> {
  const encryptionKey = crypto.getRandomValues(new Uint8Array(32)); // fresh 256-bit key per write
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  // Store the per-value key in the Keychain/Keystore (small → fits the 2 KB limit).
  await SecureStore.setItemAsync(secureKeyFor(supabaseKey), aesjs.utils.hex.fromBytes(encryptionKey));
  return aesjs.utils.hex.fromBytes(encryptedBytes);
}

async function decrypt(supabaseKey: string, hexBlob: string): Promise<string | null> {
  const keyHex = await SecureStore.getItemAsync(secureKeyFor(supabaseKey));
  if (!keyHex) return null; // key gone (reinstall / cleared Keychain) → treat as no session
  const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
  const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(hexBlob));
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

/** The object shape supabase-js expects for `auth.storage`. */
export const SecureSessionStore = {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await decrypt(key, encrypted);
    } catch {
      // Corrupt/undecryptable → drop it so the app treats the user as signed-out rather than crash-looping.
      await this.removeItem(key);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(secureKeyFor(key));
  },
};
