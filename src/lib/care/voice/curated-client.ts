/**
 * Client-importable mirror of the curated voice list. Lives in
 * a separate file from elevenlabs.ts (which is "server-only")
 * so the settings page can import the picker options without
 * dragging the API key resolution code into the bundle.
 *
 * IF YOU EDIT the curated list here, edit the canonical list
 * in src/lib/care/voice/elevenlabs.ts to match. The two lists
 * are kept in sync by convention; per §A4 (vocabulary-once)
 * the right structural fix is to lift the list into a shared
 * non-server-only module — deferred until a third surface
 * needs the same list.
 */

export type CuratedVoice = {
  id: string;
  name: string;
  description: string;
};

export const CURATED_VOICES: CuratedVoice[] = [
  {
    id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    description: "Well-rounded conversational male · default",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    description: "Deep authoritative male",
  },
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    description: "Calm professional female",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    description: "Soft friendly female",
  },
  {
    id: "yoZ06aMxZJJ28mfd3POQ",
    name: "Sam",
    description: "Warm narrative male",
  },
];

export const DEFAULT_VOICE_ID = CURATED_VOICES[0]!.id;
