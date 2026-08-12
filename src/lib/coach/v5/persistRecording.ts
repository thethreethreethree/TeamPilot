import { createClient } from "@/lib/supabase/client";

/**
 * persistRecording — save a live-recorded audio blob to Storage and stamp the session's `audio_asset_url`,
 * WITHOUT transcribing.
 *
 * This is the "never lose the audio" guarantee for live coaching (founder priority 2026-08-12, first-client
 * incident: "sessions constantly failing to record"). ElevenLabs realtime STT sometimes captures zero turns, and
 * when it does the recorded audio previously lived only in browser memory — lost the moment the app navigated to
 * After-Pitch. Calling this on Stop puts the audio in Storage first, so a failed live capture is ALWAYS
 * recoverable via the existing re-transcribe path.
 *
 * Mirrors SessionRecordingUpload's proven direct-to-storage flow (sign → uploadToSignedUrl → finalize) so it
 * shares the same ~4.5 MB-body-cap bypass, but passes `persistOnly` so the finalize step skips the STT/LLM work
 * (the transcription happens on demand in recovery, not here). THROWS on any failure — the caller decides
 * whether to block, retry, or fall back to the manual upload UI.
 */
export async function persistRecording(sessionId: string, blob: Blob): Promise<void> {
  // 1. Mint a signed upload target (server validates owner/manager access, size, type).
  const signRes = await fetch(
    `/api/coach/sales-session/${sessionId}/upload-recording/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "live-recording.webm",
        sizeBytes: blob.size,
        mimeType: blob.type || "audio/webm",
      }),
    }
  );
  if (!signRes.ok) {
    const d = (await signRes.json().catch(() => null)) as { error?: string } | null;
    throw new Error(d?.error ?? `Couldn't start the recording save (HTTP ${signRes.status}).`);
  }
  const { bucket, storagePath, token } = (await signRes.json()) as {
    bucket: string;
    storagePath: string;
    token: string;
  };

  // 2. Upload the bytes DIRECT to Storage (bypasses the ~4.5 MB Vercel body cap that killed real recordings).
  const supabase = createClient();
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(storagePath, token, blob);
  if (upErr) throw new Error(`Recording save failed: ${upErr.message}`);

  // 3. Finalize with persistOnly: the server stamps audio_asset_url from the stored object and returns —
  //    no transcription. The audio is now safe and re-transcribable on demand.
  const finRes = await fetch(
    `/api/coach/sales-session/${sessionId}/upload-recording`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath, persistOnly: true }),
    }
  );
  if (!finRes.ok) {
    const d = (await finRes.json().catch(() => null)) as { error?: string } | null;
    throw new Error(d?.error ?? `Couldn't save the recording (HTTP ${finRes.status}).`);
  }
}
