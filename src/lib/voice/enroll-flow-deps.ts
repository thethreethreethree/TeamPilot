/**
 * The real file and network for the enrollment flow.
 *
 * Kept apart from `enroll-flow.ts` for the reason the whole repo splits these:
 * `expo-file-system` is a native module, and anything importing it cannot be
 * loaded by this app's test runner. The ORDER those three calls happen in is the
 * privacy promise, and it is exactly what has to stay testable — so the order
 * lives there and the modules live here.
 */
import { File } from 'expo-file-system';

import { deleteRecordingFile } from '@/lib/audio/capture';
import { saveEnrollment } from './enrollment-api';
import type { EnrollDeps } from './enroll-flow';

export const REAL_ENROLL_DEPS: EnrollDeps = {
  readBytes: async (uri) => new Uint8Array(await new File(uri).arrayBuffer()),
  deleteFile: deleteRecordingFile,
  save: saveEnrollment,
};
