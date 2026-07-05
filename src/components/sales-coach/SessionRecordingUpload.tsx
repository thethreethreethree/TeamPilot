"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, UserCheck } from "lucide-react";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import { LearningHint } from "@/components/learning/LearningHint";

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
}: {
  sessionId: string;
  onLabeled: () => void;
  /** F2: a recording handed in from the live coaching loop. When set,
   *  it's uploaded automatically (no file picker). */
  initialBlob?: Blob | null;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "labeling" | "done">(
    "idle"
  );
  const [segments, setSegments] = useState<DiarizedSegment[]>([]);
  const [speakers, setSpeakers] = useState<SpeakerSample[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploadBlob = async (blob: Blob, name: string) => {
    setPhase("uploading");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", blob, name);
      const res = await fetch(
        `/api/coach/sales-session/${sessionId}/upload-recording`,
        { method: "POST", body: fd }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      if (!d.segments?.length) {
        throw new Error("No speech was transcribed from that recording.");
      }
      setSegments(d.segments);
      setSpeakers(d.speakers ?? []);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
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
            Upload the call recording
          </h2>
          <p className="text-[11px] text-muted mt-0.5">
            We separate the two voices, then you tap which one is you.
          </p>
        </div>
        <LearningHint
          as="inline-block"
          category="Sales Coach · Recording"
          title="Upload recording"
          whatItIs="Uploads a saved call recording so the coach can transcribe it and separate the two voices."
          why="If you didn't run live coaching — or the live transcript didn't save — this is how the conversation still becomes something you can review and learn from. No recording, no review."
          how="Tap it, pick the audio or video file, and wait while it transcribes. Then you'll tap which voice is you."
          principle="A call you don't capture is a lesson that evaporates."
        >
        <LoadingButton
          pending={phase === "uploading"}
          onClick={() => fileRef.current?.click()}
          icon={<Upload className="w-3.5 h-3.5" aria-hidden />}
          pendingLabel="Transcribing…"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
        >
          Upload recording
        </LoadingButton>
        </LearningHint>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/*"
          onChange={onPick}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
    </section>
  );
}
