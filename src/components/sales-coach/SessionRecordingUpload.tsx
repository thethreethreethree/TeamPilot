"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, UserCheck } from "lucide-react";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import { LearningHint } from "@/components/learning/LearningHint";
import { createClient } from "@/lib/supabase/client";

// Voice-memo + recording formats a phone actually produces — Apple Voice Memos (.m4a/.caf),
// Android recorders (.m4a/.amr/.3gp/.ogg/.wav), plus the universal ones. Listed explicitly (on
// top of the audio/* + video/* wildcards) because some mobile file pickers filter by extension
// when a memo arrives with an empty or unusual MIME type.
const RECORDING_ACCEPT =
  "audio/*,video/*,.m4a,.m4b,.mp3,.wav,.aac,.amr,.3gp,.3gpp,.ogg,.oga,.caf,.mp4,.webm,.aiff,.flac";

/**
 * SessionRecordingUpload — Live Sales Coach S1a.
 *
 * Upload a call recording → batch diarization → the agent ONE-TAPS which
 * speaker is them → the labeled transcript is appended to the session.
 *
 * Two-step because transcript segments are append-only (§3.1) and can't
 * hold raw speaker_0/1 labels: the upload returns the diarized segments,
 * this component holds them through the tap, then /label-transcript
 * appends them as agent/customer.
 */

type DiarizedSegment = { speakerId: string; text: string; seq: number };
type SpeakerSample = { speakerId: string; sample: string };

export function SessionRecordingUpload({
  sessionId,
  onLabeled,
  initialBlob = null,
  hasSavedRecording = false,
}: {
  sessionId: string;
  onLabeled: () => void;
  /** F2: a recording handed in from the live coaching loop. When set,
   *  it's uploaded automatically (no file picker). */
  initialBlob?: Blob | null;
  /** Recovery: the session already has a saved recording (audio_asset_url) but
   *  no transcript — the orphaned state left by an STT outage. When true, offer
   *  "Re-transcribe from the saved recording" so the rep doesn't have to re-find
   *  and re-upload a file the server already holds. */
  hasSavedRecording?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const labelingRef = useRef(false);
  // Synchronous latch for uploadBlob (audit F7): the `pending` button-disable lands a render late, so a
  // second entry (reselect a file, or the auto-upload racing a pick) would mint a SECOND signed upload +
  // finalize = double metered STT spend. Checked/set before the first await, released in finally.
  const uploadingRef = useRef(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "labeling" | "done">(
    "idle"
  );
  // Sub-stage of the "uploading" phase so the button tells the truth: a large phone recording spends real
  // time in the SENDING stage (bytes → storage) before transcription even starts. Showing "Transcribing…"
  // the whole time reads as frozen on a slow mobile upload (§3.4 honest state). "sending" → "transcribing".
  const [stage, setStage] = useState<"sending" | "transcribing">("sending");
  const [segments, setSegments] = useState<DiarizedSegment[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerSample[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Shared response handling for both transcription entry points (fresh upload
  // and re-transcribe-from-storage) — they return the identical {segments,speakers}
  // shape and feed the same speaker-tap step.
  const applyTranscribeResponse = async (res: Response) => {
    const d = await res.json();
    if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
    if (!d.segments?.length) {
      throw new Error("No speech was transcribed from that recording.");
    }
    setSegments(d.segments);
    setSpeakers(d.speakers ?? []);
  };

  const uploadBlob = async (blob: Blob, name: string) => {
    if (uploadingRef.current) return; // F7 latch — before the first await, so a double-entry can't double-spend
    uploadingRef.current = true;
    setPhase("uploading");
    setStage("sending");
    setError(null);
    try {
      // 1. Mint a signed upload target — the server validates access (owner/manager),
      //    size, and type up front. The bytes never pass through this request.
      const signRes = await fetch(
        `/api/coach/sales-session/${sessionId}/upload-recording/sign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: name,
            sizeBytes: blob.size,
            mimeType: blob.type || "audio/webm",
          }),
        }
      );
      if (!signRes.ok) {
        const d = await signRes.json().catch(() => null);
        throw new Error(
          d?.error ?? `Couldn't start the upload (HTTP ${signRes.status}).`
        );
      }
      const { bucket, storagePath, token } = await signRes.json();
      // 2. Upload the bytes DIRECT to Storage. This is the whole point: it bypasses the
      //    ~4.5 MB Vercel serverless request-body limit, so a real phone recording / voice
      //    memo (5-25 MB) uploads where the old through-function path silently failed.
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(storagePath, token, blob);
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      // Bytes are in storage — the slow part for a large mobile file is done. Now transcription.
      setStage("transcribing");
      // 3. Finalize: the server reads the real stored object, stamps the pointer, and
      //    transcribes from storage — returning the same { segments, speakers } shape.
      const res = await fetch(
        `/api/coach/sales-session/${sessionId}/upload-recording`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        }
      );
      await applyTranscribeResponse(res);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    } finally {
      uploadingRef.current = false;
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Recovery: re-transcribe the recording the server already holds (no re-upload).
  const retranscribe = async () => {
    setPhase("uploading");
    setStage("transcribing"); // no upload here — the audio is already in storage.
    setError(null);
    try {
      const res = await fetch(
        `/api/coach/sales-session/${sessionId}/retranscribe`,
        { method: "POST" }
      );
      await applyTranscribeResponse(res);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  };

  // F2: auto-upload a live recording handed in from S1b (once).
  const uploadedBlobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (initialBlob && uploadedBlobRef.current !== initialBlob) {
      uploadedBlobRef.current = initialBlob;
      void uploadBlob(initialBlob, "live-recording.webm");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBlob]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadBlob(file, file.name || "recording.webm");
  };

  const label = async (agentSpeakerId: string) => {
    // Synchronous latch: label-transcript APPENDS every segment
    // (appendTranscriptSegment, plain insert — no unique seq, and the table
    // is append-only/no-delete), so a double-click on a speaker button would
    // duplicate the entire transcript PERMANENTLY, poisoning the record the
    // after-pitch review + coaching scores run on. The phase-based button
    // disable is applied a render too late to stop the second click.
    if (labelingRef.current) return;
    labelingRef.current = true;
    setPhase("labeling");
    setError(null);
    try {
      const res = await fetch(
        `/api/coach/sales-session/${sessionId}/label-transcript`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentSpeakerId, segments }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? `HTTP ${res.status}`);
      }
      setPhase("done");
      setSegments([]);
      setSpeakers([]);
      onLabeled();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Reset the latch so the rep can retry after a transient failure.
      labelingRef.current = false;
      setPhase("idle");
    }
  };

  // Speaker-selection step (after a successful upload).
  if (speakers.length > 0) {
    return (
      <section className="rounded-xl border border-ember-400/30 bg-ember-400/[0.04] p-4">
        <p className="text-sm font-semibold text-primary mb-1">
          Which voice is you?
        </p>
        <p className="text-[11px] text-muted mb-3">
          Tap your own line so the transcript knows who&apos;s the agent and
          who&apos;s the prospect.
        </p>
        <LearningHint
          as="block"
          category="Sales Coach · Recording"
          title="Which voice is you?"
          whatItIs="After transcription, you tap the sample line that's your own voice so the transcript knows which side is you and which is the prospect."
          why="The machine can tell two voices apart, but not which is which. One tap from you fixes the labels — and every piece of coaching downstream depends on them being right."
          how="Read the short sample under each voice and tap 'That's me' on yours. It only takes one."
          principle="The one thing the machine can't know, you supply in a single tap."
        >
        <div className="space-y-2">
          {speakers.map((sp) => (
            <button
              key={sp.speakerId}
              type="button"
              disabled={phase === "labeling"}
              onClick={() => void label(sp.speakerId)}
              className="w-full text-left rounded-lg border border-default hover:border-strong bg-white/[0.02] p-3 transition-colors disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand">
                <UserCheck className="w-3.5 h-3.5" aria-hidden />
                That&apos;s me
              </span>
              <p className="text-xs text-secondary mt-1 italic">
                “{sp.sample}…”
              </p>
            </button>
          ))}
        </div>
        </LearningHint>
        {phase === "labeling" && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted mt-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Saving transcript…
          </p>
        )}
        {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-primary">
            Upload a recording or voice memo
          </h2>
          <p className="text-[11px] text-muted mt-0.5">
            From your phone — iPhone Voice Memos or Android. We separate the two
            voices, then you tap which one is you.
          </p>
        </div>
        <LearningHint
          as="inline-block"
          category="Sales Coach · Recording"
          title="Upload recording"
          whatItIs="Uploads a saved call recording or phone voice memo (iPhone or Android) so the coach can transcribe it and separate the two voices."
          why="If you didn't run live coaching — or the live transcript didn't save — this is how the conversation still becomes something you can review and learn from. No recording, no review."
          how="Tap it, pick a voice memo or call recording from your phone, and wait while it transcribes. Then you'll tap which voice is you."
          principle="A call you don't capture is a lesson that evaporates."
        >
        <LoadingButton
          pending={phase === "uploading"}
          onClick={() => fileRef.current?.click()}
          icon={<Upload className="w-3.5 h-3.5" aria-hidden />}
          pendingLabel={stage === "sending" ? "Uploading…" : "Transcribing…"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
        >
          Upload recording
        </LoadingButton>
        </LearningHint>
        <input
          ref={fileRef}
          type="file"
          accept={RECORDING_ACCEPT}
          onChange={onPick}
          className="hidden"
        />
      </div>
      {hasSavedRecording && (
        <div className="mt-3 pt-3 border-t border-default/60">
          <p className="text-[11px] text-muted mb-2">
            This call was recorded, but the transcript didn&apos;t save. You can
            rebuild it straight from the saved recording — no need to find the file.
          </p>
          <LoadingButton
            pending={phase === "uploading"}
            onClick={() => void retranscribe()}
            icon={<Loader2 className="w-3.5 h-3.5" aria-hidden />}
            pendingLabel="Re-transcribing…"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-strong hover:bg-white/[0.04] disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
          >
            Re-transcribe from saved recording
          </LoadingButton>
        </div>
      )}
      {phase === "uploading" && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted mt-2">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
          {stage === "sending"
            ? "Uploading your recording — a longer call can take a moment on mobile. Keep this screen open."
            : "Separating the two voices…"}
        </p>
      )}
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
    </section>
  );
}
