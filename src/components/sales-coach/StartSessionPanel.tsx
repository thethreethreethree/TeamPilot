"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, DoorOpen, Mic } from "lucide-react";
import {
  DeckCard,
  DeckGhostButton,
  DeckButton,
} from "@/components/sales-coach/ui/deck";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * StartSessionPanel — the "Start a coaching session" card, self-contained so it
 * can live on more than one surface (founder 2026-07-04: the "Live AI Coach &
 * Sessions" card routes to Sessions and must be able to START a session, not
 * just list them). Own state + start logic. §A21 — one reusable panel.
 */
export function StartSessionPanel() {
  const router = useRouter();
  const [context, setContext] = useState<"in_person" | "video">("video");
  const [clientLabel, setClientLabel] = useState("");
  const [territory, setTerritory] = useState("");
  const [approach, setApproach] = useState("");
  const [offer, setOffer] = useState("");
  const [showCapture, setShowCapture] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const label = clientLabel.trim();
    if (!label) {
      setError("Give the session a client / campaign title before starting.");
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/sales-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          clientLabel: label,
          territory: territory.trim() || undefined,
          approach: approach.trim() || undefined,
          offer: offer.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Couldn't start (HTTP ${res.status})`);
      }
      const { session } = await res.json();
      router.push(`/dashboard/sales-coach/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  return (
    <DeckCard className="p-4">
      <h2 className="text-sm font-semibold text-primary mb-3">
        Start a coaching session
      </h2>
      <LearningHint
        as="block"
        category="Sales Coach · Session"
        title="In-person vs. video"
        whatItIs="Whether this session is an in-person conversation (a door, a field visit) or a remote video call."
        why="The coach adapts to the channel — doorstep timing and body language in person; framing and pacing on video. Set right, the cues and the review fit how the conversation actually happens."
        how="Pick the one that matches this call before you start. It's also what lets you later compare your in-person close rate against your video close rate."
        principle="Coach the channel you're actually in."
      >
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <DeckGhostButton
            active={context === "video"}
            onClick={() => setContext("video")}
          >
            <Video className="w-3.5 h-3.5" aria-hidden />
            Online video
          </DeckGhostButton>
          <DeckGhostButton
            active={context === "in_person"}
            onClick={() => setContext("in_person")}
          >
            <DoorOpen className="w-3.5 h-3.5" aria-hidden />
            In-person
          </DeckGhostButton>
        </div>
      </LearningHint>
      <LearningHint
        as="block"
        category="Sales Coach · Session"
        title="Client / campaign label"
        whatItIs="A short label for who or what this session is about — a client name, a campaign, or a door number."
        why="It's how you find this exact conversation later to learn from it. A pile of untitled sessions is a history you can't navigate."
        how="Give it something you'll recognize ('Door 17', 'Acme renewal'). It's required — the session won't start without it."
        principle="A conversation you can't find later is a lesson you can't revisit."
      >
        <input
          type="text"
          value={clientLabel}
          onChange={(e) => setClientLabel(e.target.value)}
          placeholder="Client / campaign (required)"
          className="w-full text-xs bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 mb-2.5"
        />
      </LearningHint>
      <LearningHint
        as="block"
        category="Sales Coach · Session"
        title="Start session"
        whatItIs="Begins a coaching session and opens its page, where you run live coaching or upload a recording, then review it."
        why="This is the front door of the whole loop — capture → coach → review → next door. No session, no coaching."
        how="Add a client label, then start. You'll land on the session page to begin live coaching or attach a recording."
        principle="The coaching only compounds if you actually start the door."
      >
        <DeckButton
          pending={starting}
          onClick={() => void start()}
          disabled={!clientLabel.trim()}
          icon={<Mic className="w-4 h-4" aria-hidden />}
          className="w-full"
        >
          Start session
        </DeckButton>
      </LearningHint>
      {error && <p className="text-[11px] text-amber-300 mt-2">{error}</p>}
      <button
        type="button"
        onClick={() => setShowCapture((v) => !v)}
        className="mt-3 text-[11px] text-muted hover:text-secondary transition-colors"
      >
        {showCapture
          ? "− Hide details"
          : "+ Add details (where / how / what) — optional"}
      </button>
      {showCapture && (
        <div className="mt-2 grid grid-cols-1 gap-2">
          <PanelInput
            value={territory}
            onChange={setTerritory}
            placeholder="Where (territory / area)"
          />
          <PanelInput
            value={approach}
            onChange={setApproach}
            placeholder="How (referral / cold / follow-up)"
          />
          <PanelInput
            value={offer}
            onChange={setOffer}
            placeholder="What (the offer)"
          />
        </div>
      )}
    </DeckCard>
  );
}

function PanelInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
    />
  );
}
