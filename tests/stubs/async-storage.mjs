/**
 * An in-memory stand-in for AsyncStorage, so the on-device stores can be tested
 * under plain Node.
 *
 * It implements only the five calls the app actually makes, and it implements
 * them honestly — same async signatures, same "missing key returns null"
 * behaviour. A stub that is more forgiving than the real thing is worse than no
 * stub, because it lets a bug pass here and fail on the phone.
 *
 * `__reset` and `__raw` exist only for tests; the app never sees them.
 */
const store = new Map();

const AsyncStorage = {
  async getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async setItem(key, value) {
    // The real one stores strings. Anything else is a bug worth catching here.
    if (typeof value !== 'string') throw new TypeError('AsyncStorage stores strings');
    store.set(key, value);
  },
  async removeItem(key) {
    store.delete(key);
  },
  async getAllKeys() {
    return [...store.keys()];
  },
  async multiRemove(keys) {
    for (const k of keys) store.delete(k);
  },
  async multiGet(keys) {
    // The real one returns [key, value] pairs with null for a missing key —
    // matched exactly, because a stub that is kinder than the real thing lets a
    // bug pass here and fail on the phone.
    return keys.map((k) => [k, store.has(k) ? store.get(k) : null]);
  },

  /** test-only */
  __reset() {
    store.clear();
  },
  /** test-only: inspect what is actually on "disk" */
  __raw() {
    return new Map(store);
  },
};

export default AsyncStorage;
