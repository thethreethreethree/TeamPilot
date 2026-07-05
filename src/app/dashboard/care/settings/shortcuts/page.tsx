"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Zap } from "lucide-react";
import { SettingsTabs } from "@/components/care/SettingsTabs";
import { useToast } from "@/components/ui/toast";
import { LearningHint } from "@/components/learning/LearningHint";

type Shortcut = {
  id: string;
  shortcut: string;
  title: string;
  body: string;
};

export default function CareShortcutsPage() {
  const [items, setItems] = useState<Shortcut[] | null>(null);
  const [draft, setDraft] = useState({ shortcut: "", title: "", body: "" });
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const refresh = async () => {
    const res = await fetch("/api/care/agent/shortcuts");
    if (res.ok) {
      const data = await res.json();
      setItems(data.shortcuts ?? []);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const create = async () => {
    if (!draft.shortcut.trim() || !draft.title.trim() || !draft.body.trim() || creating) {
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/care/agent/shortcuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        toast.success(`Shortcut ${draft.shortcut} created.`);
        setDraft({ shortcut: "", title: "", body: "" });
        await refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data.error
            ? `Could not create shortcut — ${data.error}`
            : `Could not create shortcut (status ${res.status}).`
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Could not create shortcut — ${e.message}`
          : "Could not create shortcut (network error)."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">
          Shortcuts · canned responses with Coach-aware tone discipline
        </p>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {/* Create */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">
            New shortcut
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Shortcut trigger"
              whatItIs="The keyword an agent types in the composer — like /refund — to pull in this template's body."
              why="This is the muscle-memory handle for the response. Short, predictable triggers are what let an agent insert a full answer without leaving the keyboard or hunting through a menu."
              how="Start it with / and keep it short and memorable (e.g. /refund, /hours). Agents type it mid-message to insert the body."
              principle="A shortcut only saves time if it's faster to recall than to retype."
            >
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Shortcut
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={draft.shortcut}
                  onChange={(e) =>
                    setDraft({ ...draft, shortcut: e.target.value })
                  }
                  placeholder="/refund"
                  className="w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong font-mono"
                />
                <p className="text-[10px] text-muted mt-1">
                  Agent types this in the composer to insert the body.
                </p>
              </div>
            </LearningHint>
            <LearningHint
              as="block"
              category="C.A.R.E · Settings"
              title="Shortcut title"
              whatItIs="A short human label for the template — what it's for — shown to agents as they browse and pick shortcuts."
              why="The trigger is for typing fast; the title is for finding the right one. A clear title stops an agent from inserting the wrong canned reply into a live conversation."
              how="Name it by its purpose, not its trigger (e.g. 'Refund policy intro'). Keep it scannable in a list."
              principle="Name things for the person choosing them, not for the machine matching them."
            >
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Refund policy intro"
                  className="w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
                />
              </div>
            </LearningHint>
          </div>
          <LearningHint
            as="block"
            category="C.A.R.E · Settings"
            title="Shortcut body"
            whatItIs="The actual text inserted into the composer when the agent types the trigger — the message customers will read."
            why="This is what your customer actually sees, so it carries your team's voice at scale. The Coach still grades tone on send, but a template written warm and specific starts every use ahead."
            how="Write it as a ready-to-send message — warm, specific, no corporate filler. Leave room for the agent to personalize before sending."
            principle="A canned reply is still a real message — write it like one."
          >
            <div className="mb-3">
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                Body
              </label>
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={4}
                placeholder="The text the agent will send. Be warm, be specific, avoid corporate filler."
                className="w-full bg-base border border-default rounded-md px-2.5 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y leading-relaxed"
              />
            </div>
          </LearningHint>
          <LearningHint
            as="inline-block"
            category="C.A.R.E · Settings"
            title="Create shortcut"
            whatItIs="Saves the trigger, title, and body as a new shortcut your whole team can use."
            why="Once created, this shortcut is available to every agent in the composer — so building good ones here compounds across everyone. Stays disabled until all three fields are filled."
            how="Fill trigger, title, and body, then click Create. It appears in the list below and is usable immediately."
            principle="Build the templates once; the whole team spends the saved time."
          >
            <button
              type="button"
              onClick={create}
              disabled={
                creating ||
                !draft.shortcut.trim() ||
                !draft.title.trim() ||
                !draft.body.trim()
              }
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

        {/* List */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">
            All shortcuts
          </h2>
          {items == null ? (
            <div className="flex items-center gap-2 text-xs text-muted py-4 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-6">
              <Zap className="w-6 h-6 text-muted mx-auto mb-2" aria-hidden />
              <p className="text-xs text-muted">
                No shortcuts yet. Build a few your team uses often.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((s) => (
                <li
                  key={s.id}
                  className="border border-default rounded-md p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs text-brand font-mono">
                      {s.shortcut}
                    </code>
                    <span className="text-xs text-primary font-semibold">
                      {s.title}
                    </span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
                    {s.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
