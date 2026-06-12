/**
 * Coach negative-vocabulary library.
 *
 * Built 2026-06-12 to STOP the error loop the user invoked §1.3 on:
 *   "looks great, please let's focus on this build for now, really
 *    fine tuning this element" → v3.1
 *   "our coach system seem to have a similar answer and it doesn't
 *    evaluate the message" → v3.2
 *   "coach was not activated this time" → v3.2.1
 *   "add all negative vocabulary in the system, so we don't keep
 *    running to the same issue over and over again we are breaking
 *    the constitution's law" → v3.3 (this file)
 *
 * Each round we patched a word. The IDENTIFICATION was wrong:
 * authoring vocabulary ad-hoc per incident is the mistake. The
 * authoring happens ONCE, comprehensively, by semantic category.
 * Future misses now signal §4 readout work, not "add another word."
 *
 * Constitutional grounding for this file:
 *   - §1.3 (no error loops): repeated misses mean the identification
 *     was wrong; stop incrementing, design the space once.
 *   - §1.2 (retrospective): the record showed every "miss" was
 *     vocabulary, not pattern shape. The pattern shapes are right;
 *     the vocabulary was thin.
 *   - §1.5 (holistic): vocabulary changes ripple to all five
 *     vocabulary-driven heuristics (nvc-evaluation, blame-projection,
 *     hot-state, aggressive-language, emotional-escalation,
 *     stone-identity-collision). Building it as a shared library
 *     prevents drift between them.
 *   - §3.6 (learning visible): per-heuristic dismiss rates after this
 *     expansion become the calibration signal — if a category
 *     over-fires, we narrow that category, not the whole detector.
 *   - A11 (mirror frame): vocabulary expansion doesn't change the
 *     System's behavior — it still surfaces a count + asks a
 *     question. We're just better at noticing the count.
 *
 * Maintenance discipline going forward:
 *   - When a missed pattern is reported, the FIRST diagnosis is
 *     "which category should this go in?" — never "add this word."
 *   - If a category genuinely is missing (new semantic surface),
 *     add the category here AND author it comprehensively in one
 *     pass.
 *   - The §4 dismiss-rate readout (per heuristic, see Brain Learning
 *     Visible) is the over-fire signal. Use it.
 */

/**
 * First-person emotional states — what the writer says they ARE or
 * are BECOMING. Drives hot-state detection (the writer signaling
 * they're composing from a non-neutral state).
 *
 * Organized internally by emotional family but flattened to a single
 * list because the regex doesn't need the structure — the structure
 * is a documentation/maintenance aid.
 */
export const EMOTIONAL_STATES = [
  // Anger family
  "angry", "mad", "furious", "livid", "enraged", "seething", "irate",
  "incensed", "fuming", "boiling", "steamed", "ticked off", "pissed",
  "pissed off", "hot", "heated", "worked up",

  // Frustration family
  "frustrated", "annoyed", "irritated", "agitated", "exasperated",
  "fed up", "vexed", "peeved", "miffed", "aggravated", "bothered",
  "ticked", "salty", "sour", "snippy", "snappy",

  // Sadness / down family
  "sad", "depressed", "miserable", "down", "low", "dejected", "gloomy",
  "blue", "hurt", "wounded", "crushed", "heartbroken", "devastated",
  "demoralized", "deflated", "let down",

  // Anxiety family
  "anxious", "worried", "stressed", "stressed out", "nervous", "on edge",
  "jumpy", "restless", "tense", "rattled", "shaken", "freaked out",
  "freaking out", "panicking", "spiraling",

  // Disappointment family
  "disappointed", "disheartened", "discouraged",

  // Exhaustion family
  "tired", "exhausted", "drained", "spent", "wiped", "wiped out", "fried",
  "cooked", "done", "toast", "burnt out", "burned out", "depleted",
  "frazzled", "wrecked", "shot", "fried out", "running on fumes",
  "running on empty", "out of gas",

  // Disgust family
  "disgusted", "sickened", "appalled", "repulsed", "revolted", "nauseated",
  "grossed out",

  // Confusion family
  "confused", "lost", "perplexed", "baffled", "bewildered", "befuddled",
  "in the dark", "out of the loop",

  // Boredom / disengagement
  "bored", "checked out", "uninterested", "unengaged", "tuned out",

  // Resentment family
  "resentful", "bitter", "jaded", "cynical",

  // Defeat / overwhelm
  "defeated", "beaten", "hopeless", "helpless", "powerless", "stuck",
  "overwhelmed", "swamped", "drowning", "underwater", "buried",
  "in over my head", "out of my depth",

  // Hot-state physical signals
  "hungry", "starving", "hangry", "thirsty", "dehydrated", "freezing",
  "sweating",

  // "Done with this" / breaking-point phrasings
  "over it", "over this", "sick of it", "sick of this", "fed up with this",
  "losing it", "losing my mind", "losing patience", "out of patience",
  "at my limit", "at my breaking point", "at the end of my rope",
  "ready to quit", "ready to lose it", "about to lose it",
  "cranky", "grumpy", "moody", "irritable", "in a mood", "in a bad mood",
] as const;

/**
 * Pejoratives applied to THINGS or SITUATIONS — drives nvc-evaluation
 * via "this is X" / "that is X" / "it's X" framings.
 *
 * Includes profanity-laden ones because they're so common in the
 * exact contexts we care about.
 */
export const PEJORATIVES_FOR_THINGS = [
  // Calm pejoratives
  "broken", "wrong", "stupid", "dumb", "idiotic", "moronic", "terrible",
  "awful", "horrible", "horrendous", "atrocious", "abysmal",
  "garbage", "trash", "rubbish", "junk",
  "crap", "crappy", "shit", "shitty", "bullshit", "bs",
  "ridiculous", "absurd", "asinine", "preposterous", "insane", "nuts",
  "crazy", "bonkers", "lunacy", "madness",
  "lame", "weak", "weak sauce", "useless", "pointless", "worthless",
  "hopeless", "miserable", "sad",
  "embarrassing", "shameful", "disgraceful", "pathetic", "tragic",
  "wack", "janky", "borked", "jacked", "screwed up", "messed up",
  "fucked", "fucked up", "screwed",

  // Loaded judgment phrases (often paired with "this is")
  "a disaster", "a catastrophe", "a nightmare", "a train wreck",
  "a dumpster fire", "a shitshow", "a shit show", "a clusterfuck",
  "a joke", "a farce", "a sham",

  // Direct judgments
  "unacceptable", "inexcusable", "indefensible", "outrageous",
  "appalling", "disgraceful", "offensive",

  // Colloquial "sucks" forms
  "sucks", "blows", "sucks ass", "blows chunks", "stinks",
] as const;

/**
 * v3.8 (2026-06-12) — feeling-as-judgment adjectives.
 *
 * Distinct from PEJORATIVES_FOR_THINGS even though both fire the
 * nvc-evaluation heuristic via the same shapes. The difference:
 *   - PEJORATIVES_FOR_THINGS encode a quality judgment about the
 *     thing ("this is broken" — the thing IS bad).
 *   - FEELING_AS_JUDGMENT_ADJECTIVES encode the SPEAKER's emotional
 *     impact projected as a property of the thing ("this is annoying"
 *     — the speaker IS annoyed, the thing got labeled).
 *
 * Both shapes are NVC evaluation in the technical sense (judgment
 * substituted for observation), but they map to slightly different
 * revisions — the feeling-shape's natural revision is "I feel X
 * when…" rather than "what specifically did you notice?". Keeping
 * them as separate categories per A13 (vocabulary-once, by category)
 * makes future refinement to the suggestion text shape-aware without
 * having to re-author the regex.
 *
 * Surfaced this category from the "thats annoying" miss — the
 * structural shape "that's [feeling_adj]" was identical to the
 * existing "that's [pejorative]" pattern but the adjective was
 * categorically absent from any vocabulary group.
 */
export const FEELING_AS_JUDGMENT_ADJECTIVES = [
  "annoying", "irritating", "infuriating", "maddening", "aggravating",
  "exasperating", "vexing", "grating", "galling", "tiresome", "wearing",
  "exhausting", "draining", "tiring", "fatiguing",
  "frustrating", "discouraging", "disheartening", "demoralizing",
  "stressful", "overwhelming", "smothering", "suffocating",
  "tedious", "boring", "dull",
  "uncomfortable", "unpleasant", "disagreeable",
  "depressing", "saddening", "upsetting", "disturbing",
  "concerning", "worrying", "alarming",
  "confusing", "baffling", "bewildering", "perplexing",
  "off-putting", "off putting",
  "disappointing", "underwhelming",
  "petty", "childish", "immature",
  "passive-aggressive", "passive aggressive",
] as const;

/**
 * Identity attacks — labels a PERSON as a type/trait rather than
 * describing what they did. Drives stone-identity-collision.
 *
 * Includes slurs / harsh epithets because the heuristic specifically
 * targets person-attacking language; not flagging them would defeat
 * the purpose.
 */
export const IDENTITY_ATTACKS = [
  // Competence/capability attacks. Multi-form pronoun phrases are
  // expanded to literal alternatives — vocabAlt() escapes regex
  // special characters, so parenthetical-alternation entries would
  // be inert at runtime.
  "incompetent", "inept", "useless", "hopeless", "clueless", "lost",
  "out of their depth", "out of his depth", "out of her depth",
  "in over their head", "in over his head", "in over her head",
  "amateur", "amateurish", "bush league", "minor league",

  // Character attacks
  "lazy", "entitled", "spoiled", "selfish", "self-centered",
  "two-faced", "fake", "phony", "snake", "weasel", "rat",
  "manipulative", "manipulator", "passive aggressive", "passive-aggressive",
  "narcissist", "narcissistic", "sociopath", "psychopath",
  "abuser", "abusive", "toxic", "gaslighter",

  // Mental / cognitive attacks
  "stupid", "dumb", "idiotic", "moronic", "thick", "dense", "slow",
  "an idiot", "a moron", "a fool", "a dimwit", "a halfwit", "a numbskull",

  // Identity-as-failure
  "loser", "failure", "disgrace", "embarrassment", "joke", "fraud",
  "phony", "fake", "liar", "cheat", "thief",

  // Profane epithets directed AT people
  "asshole", "jackass", "jerk", "prick", "dick", "bastard",
  "asshat", "douche", "douchebag", "dipshit", "dumbass", "jackoff",
  "twat", "tit", "bitch", "wanker",

  // "Won't / can't" identity framings
  "can't be trusted", "doesn't belong here", "shouldn't be here",
  "won't ever change", "won't ever learn", "won't ever get it",
] as const;

/**
 * General profanity — used in combination with personal targets
 * (you / them / him / her) for aggression detection. Listed
 * separately so the pattern can combine profanity with a target
 * pronoun.
 */
export const PROFANITY = [
  "fuck", "fucking", "fucked", "fucker", "motherfucker", "mf",
  "shit", "shitty", "bullshit", "bs",
  "damn", "damned", "goddamn", "goddamned",
  "hell", "wtf", "what the fuck", "what the hell",
  "piss", "pissed",
  "ass", "asshole", "asshat", "jackass", "dumbass",
  "dick", "dickhead", "prick", "twat",
  "bastard", "bitch", "bitches",
] as const;

/**
 * Aggressive imperatives — direct commands aimed at silencing or
 * dismissing another person. Drives aggressive-language detection.
 */
export const AGGRESSIVE_IMPERATIVES = [
  "shut up", "shut it", "shut the fuck up", "shut the hell up",
  "fuck off", "piss off", "get lost", "back off", "get out", "get bent",
  "go to hell", "go away", "leave me alone", "kiss my ass", "eat shit",
  "drop dead", "go fuck yourself", "fuck yourself", "blow it out your ass",
  "stuff it", "stick it", "stop talking",
  "shove it",
] as const;

/**
 * Catastrophizing nouns — overstating a situation's scope/severity
 * via loaded labels. Drives emotional-escalation detection.
 */
export const CATASTROPHIZING = [
  "disaster", "catastrophe", "nightmare", "trainwreck", "train wreck",
  "dumpster fire", "shitshow", "shit show", "clusterfuck", "cluster",
  "hosed", "screwed", "doomed", "fucked", "the end",
  "the worst", "worst ever", "worst case", "rock bottom",
  "going down in flames", "burning down", "going up in smoke",
  "circling the drain", "off the rails", "off a cliff",
] as const;

/**
 * High-intensity emotional adjectives — used in "I'm X" or "this is
 * X" framings to signal heightened state. Drives emotional-escalation.
 */
export const HIGH_INTENSITY_ADJECTIVES = [
  // Self-state
  "furious", "livid", "enraged", "seething", "incensed", "irate", "fuming",
  "outraged", "appalled", "disgusted", "horrified", "sickened",

  // External judgment
  "unacceptable", "inexcusable", "indefensible", "outrageous",
  "disgraceful", "appalling", "shocking", "egregious", "scandalous",
] as const;

/**
 * Onset verbs — used between "I'm" and an emotional state to capture
 * "I'm getting / feeling / becoming / starting to feel X" phrasings
 * that the rigid "I'm X" pattern missed.
 */
export const ONSET_VERBS = [
  "getting", "feeling", "becoming", "starting to feel", "growing",
  "turning", "ending up",
] as const;

/**
 * Negation verbs — when the writer reports themselves as "still
 * angry" / "increasingly tired" — captured as alternative onset
 * forms. Less common than ONSET_VERBS but worth covering.
 */
export const INTENSIFIER_ADVERBS = [
  "so", "really", "really really", "very", "incredibly", "extremely",
  "totally", "completely", "absolutely", "utterly", "fucking",
  "still", "increasingly", "more and more", "just",
] as const;

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Build a regex-safe alternation group from a vocabulary list.
 *
 *   - Escapes regex special characters in each entry.
 *   - Converts spaces to `\s+` so "burnt out" matches "burnt  out".
 *   - Sorts by descending length so multi-word phrases match BEFORE
 *     their single-word prefixes (e.g. "burnt out" wins over "burnt").
 *
 * Used by heuristics.ts to compose the seven detector patterns from
 * these vocabulary lists.
 */
export function vocabAlt(words: ReadonlyArray<string>): string {
  const sorted = [...words].sort((a, b) => b.length - a.length);
  return sorted
    .map((w) =>
      w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")
    )
    .join("|");
}
