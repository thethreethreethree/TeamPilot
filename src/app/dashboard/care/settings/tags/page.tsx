"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Tag as TagIcon } from "lucide-react";
import { SettingsTabs } from "@/components/care/SettingsTabs";
import { ALL_TAG_COLORS, tagTone } from "@/lib/care/tagColors";
import { useToast } from "@/components/ui/toast";
import { LearningHint } from "@/components/learning/LearningHint";

type Tag = {
  id: string;
  name: string;
  color: string;
};

export default function CareTagsPage() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gray");
  const [creating, setCreating] = useState(false);
  // Distinguish a load FAILURE from "still loading" — otherwise a 500/network
  // error leaves tags null forever and the `tags == null` gate spins eternally.
  const [loadError, setLoadError] = useState(false);
  const toast = useToast();

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/care/agent/tags");
      if (!res.ok) throw new Error(`tags ${res.status}`);
      const data = await res.json();
      setTags(data.tags ?? []);
    } catch {
      setLoadError(true);
    }
  };

  const create = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/care/agent/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (res.ok) {
        toast.success(`Tag "${newName.trim()}" created.`);
        setNewName("");
        await refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data.error
            ? `Could not create tag — ${data.error}`
            : `Could not create tag (status ${res.status}).`
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Could not create tag — ${e.message}`
          : "Could not create tag (network error)."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">Tags</p>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl w-full mx-auto space-y-5">
        {/* Create */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">
            New tag
          </h2>
          <div className="flex items-end gap-2 flex-wrap">
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Tag name"
              whatItIs="The label itself — the word agents apply to a conversation, like 'billing' or 'bug'."
              why="This is the unit your reporting counts later. Consistent, low-cardinality names ('billing', not 'billing issue' / 'billing q' / 'payments') are what make 'what are people contacting us about?' answerable."
              how="Use one short, lowercase noun per concept. Agree on the vocabulary before creating many, so the same thing gets one name."
              principle="One concept, one tag — inconsistent names are uncountable."
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Name
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. billing"
                  className="w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
                />
              </div>
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Tag color"
              whatItIs="The color this tag wears everywhere it appears — in the inbox, on conversations, in lists."
              why="Color is how agents recognize a tag at a glance without reading it. Giving related tags distinct colors speeds triage; reusing one color for unrelated tags slows it down."
              how="Pick a color that reads distinctly from your other tags. Group by hue if you have families of tags (e.g. all billing shades)."
              principle="Color is a recognition shortcut — spend it on distinction, not decoration."
            >
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Color
                </label>
                <div className="flex items-center gap-1.5">
                  {ALL_TAG_COLORS.map((c) => {
                    const tone = tagTone(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        title={c}
                        aria-label={c}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          newColor === c
                            ? "border-primary scale-110"
                            : "border-transparent hover:scale-105"
                        }`}
                      >
                        <span
                          className={`block w-full h-full rounded-full ${tone.dot}`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </LearningHint>
            <LearningHint
              as="inline-block"
              category="C.A.R.E · Settings"
              title="Create tag"
              whatItIs="Adds the named, colored tag to your taxonomy so agents can start applying it to conversations."
              why="Every tag you add here becomes a choice agents see when categorizing — so a lean, deliberate set keeps tagging fast and the data clean. Disabled until the tag has a name."
              how="Enter a name, pick a color, then click Create. It joins the list below and is immediately available on conversations."
              principle="Grow the taxonomy on purpose — every tag added is a choice every agent then carries."
            >
              <button
                type="button"
                onClick={create}
                disabled={creating || !newName.trim()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] px-3 py-1.5 rounded-md"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" aria-hidden />
                )}
                Create
              </button>
            </LearningHint>
          </div>
        </div>

        {/* List */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">All tags</h2>
          {loadError ? (
            <div className="flex flex-col items-center gap-2 text-xs text-muted py-4">
              <span>Couldn&apos;t load tags.</span>
              <button
                onClick={() => void refresh()}
                className="rounded-md border border-default px-3 py-1 text-primary hover:bg-base/60"
              >
                Retry
              </button>
            </div>
          ) : tags == null ? (
            <div className="flex items-center gap-2 text-xs text-muted py-4 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-6">
              <TagIcon
                className="w-6 h-6 text-muted mx-auto mb-2"
                aria-hidden
              />
              <p className="text-xs text-muted">
                No tags yet. Create your first one above.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const tone = tagTone(t.color);
                return (
                  <span
                    key={t.id}
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded border ${tone.chip}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${tone.dot}`}
                    />
                    {t.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
