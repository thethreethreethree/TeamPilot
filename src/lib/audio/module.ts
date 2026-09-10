/**
 * Reaching expo-audio without betting the app on it being there.
 *
 * WHY THIS EXISTS. `expo-audio` is a NATIVE module. Expo Go ships a fixed set of
 * them, and a development build ships whatever the project declares — so the same
 * JavaScript bundle can run in a client that has the recorder and one that does
 * not. A plain top-level `import` of a missing native module does not degrade;
 * it throws while the module is being evaluated, which takes down the screen and
 * often the navigator with it. A rep would see a crash, not an explanation.
 *
 * So the import is done once, guarded, and the rest of the app asks this module
 * whether recording is possible instead of finding out by crashing.
 *
 * WHY `require` AND NOT A DYNAMIC `import()`. This has to answer synchronously,
 * before the recorder screen decides which component to mount — a React hook
 * cannot be called conditionally, so the branch must happen above the hooks, at
 * render time, with no await in between.
 *
 * This is not a permission check. Permission is a separate question the recorder
 * screen asks the OS; this only answers "does the recorder exist in this build at
 * all", which no amount of tapping Allow can change.
 */

/** The shape this app actually uses. Narrow on purpose — a wider type here would
 *  let a caller reach for something that was never checked. */
type AudioModule = {
  useAudioRecorder: typeof import('expo-audio').useAudioRecorder;
  useAudioRecorderState: typeof import('expo-audio').useAudioRecorderState;
  requestRecordingPermissionsAsync: typeof import('expo-audio').requestRecordingPermissionsAsync;
  getRecordingPermissionsAsync: typeof import('expo-audio').getRecordingPermissionsAsync;
  setAudioModeAsync: typeof import('expo-audio').setAudioModeAsync;
  useAudioPlayer: typeof import('expo-audio').useAudioPlayer;
  useAudioPlayerStatus: typeof import('expo-audio').useAudioPlayerStatus;
};

function load(): AudioModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-audio') as Partial<AudioModule>;

    // Present is not the same as usable: a stub or a partially linked module
    // would satisfy the require and then fail at the first call, which is the
    // crash this whole file exists to prevent.
    if (
      typeof mod?.useAudioRecorder !== 'function' ||
      typeof mod?.useAudioRecorderState !== 'function' ||
      typeof mod?.requestRecordingPermissionsAsync !== 'function' ||
      typeof mod?.useAudioPlayer !== 'function'
    ) {
      return null;
    }
    return mod as AudioModule;
  } catch {
    return null;
  }
}

export const audio: AudioModule | null = load();

/** True when this build can record at all. Fixed for the life of the process. */
export const RECORDING_AVAILABLE = audio !== null;
