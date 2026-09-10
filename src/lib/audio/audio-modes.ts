/**
 * The audio session settings, kept where a test can read them.
 *
 * WHY THIS FILE EXISTS AT ALL — it is the fix for a bug that had already shipped.
 * A rep switching to another app mid-call came back to a recording that had
 * stopped. The cause was one missing boolean: expo-audio's
 * `allowsBackgroundRecording` defaults to FALSE, and its `OnAppEntersBackground`
 * handler calls `pauseAllRecorders()` unless it is true. The screen set
 * `shouldPlayInBackground` instead, which guards PLAYERS, and a comment beside
 * it confidently said that was the one that mattered.
 *
 * Nothing failed. No error, no crash, no lost file — the recording simply
 * stopped, and the app looked like it was working. That is the shape of bug a
 * type-checker and a green build cannot see, and it is why these objects are not
 * written inline at the call site any more: a flag that must be true, guarded by
 * nothing, will eventually be false again.
 *
 * FREE OF NATIVE IMPORTS, deliberately. `expo-audio` is a native module and this
 * app's test runner cannot load one, so an inline options object was
 * unreachable from a test by construction. The TYPE is imported type-only, which
 * is erased before this runs.
 */
import type { AudioMode } from 'expo-audio';

/**
 * Recording a call.
 *
 * `allowsRecording`          iOS category `.playAndRecord`, or the mic is refused.
 * `playsInSilentMode`        a phone on silent still records, which every rep's is.
 * `shouldPlayInBackground`   playback survives backgrounding. Not the recorder.
 * `allowsBackgroundRecording` THE RECORDER survives backgrounding. This is the one.
 *
 * The last two are a pair only by accident of name: they guard different halves
 * of the module, and the app needs both because it both records and (on the
 * session screen) plays back.
 *
 * IT PAIRS WITH `UIBackgroundModes: ["audio"]` in app.json, and neither half
 * works alone: without the declaration iOS suspends the app, and without the
 * flag expo-audio pauses the recorder itself.
 *
 * ANDROID NEEDS MORE THAN THIS. The flag is accepted there, but Android requires
 * a foreground service to hold a microphone open in the background. The app has
 * never been compiled for Android; that is the piece to build when it is.
 */
export const CALL_AUDIO_MODE: Partial<AudioMode> = {
  allowsRecording: true,
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  allowsBackgroundRecording: true,
};

/**
 * Recording a voice-enrollment take.
 *
 * DELIBERATELY NOT A BACKGROUND RECORDING, and that is the opposite decision to
 * the one above rather than an omission. A take is a seven-second read of a
 * single line; a rep who switches away mid-read has not produced an enrollment,
 * and continuing to record their next app would be recording them for nothing.
 * It stops, the take comes up short, and the screen asks for another one.
 */
export const ENROLL_AUDIO_MODE: Partial<AudioMode> = {
  allowsRecording: true,
  playsInSilentMode: true,
};

/**
 * Handing the session back.
 *
 * EVERY FLAG RESETS, not just `allowsRecording`. expo-audio's mode fields default
 * to false on each call, so this releases the microphone AND the background slot
 * together — which is what should happen once a recording is over: holding them
 * affects other apps and the next recording, and nothing on screen would explain
 * why.
 */
export const RELEASED_AUDIO_MODE: Partial<AudioMode> = {
  allowsRecording: false,
};
