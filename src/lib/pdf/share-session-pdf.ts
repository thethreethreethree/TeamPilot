/**
 * Putting the generated PDF in front of the rep, through the OS share sheet.
 *
 * WHY THE SHARE SHEET AND NOT A DOWNLOAD. Doc 07's whole finding is an iOS one:
 * the web version opened blank because an async `print()` loses the user
 * activation and `window.open` with `noopener` nulls the handle. A native app
 * has no browser in the way — it writes real bytes and hands them to the system,
 * which is the reliable path and also the one a rep already knows. The rep
 * chooses where their own record goes: Files, Mail, a manager in Messages.
 *
 * THE FILE GOES IN THE CACHE, not the documents directory. It is a copy of data
 * the server already holds, regenerated in under a second, and the rep is about
 * to send it somewhere they chose. Writing it to permanent storage would quietly
 * accumulate transcripts on the phone that nothing ever deletes — which on a
 * shared device is a privacy problem, not a housekeeping one.
 *
 * SEPARATE FROM THE BUILDER for the usual reason: this file imports two native
 * modules, so nothing here can be loaded by the test runner. The layout, the
 * pagination and the escaping all live in `session-pdf.ts`, where they are
 * tested; what is left here is three calls in an order.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { buildSessionPdf, sessionPdfName, type SessionDoc } from './session-pdf';

export type ShareOutcome =
  | { ok: true }
  /** This device has no share sheet. Nothing was written. */
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'failed'; error: unknown };

export async function shareSessionPdf(doc: SessionDoc, isoDate: string): Promise<ShareOutcome> {
  try {
    // Asked BEFORE the file is written. Writing a PDF to a device that cannot
    // share it leaves a file nobody asked for and nobody can reach.
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };

    const bytes = buildSessionPdf(doc);
    const file = new File(Paths.cache, sessionPdfName(doc.title, isoDate));
    // A second export of the same call must overwrite rather than fail: a rep
    // who shares, changes their mind and shares again should not be told the
    // file already exists.
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: doc.title,
      // The uniform type identifier iOS needs to offer the right destinations.
      UTI: 'com.adobe.pdf',
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'failed', error };
  }
}
