"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { promptGroups, type PromptScope } from "@/lib/coach/remote/promptLibrary";

/**
 * "Prompt library" for an Ask box (2026-11-23, promptLibrary.ts). Collapsed by default; picking a prompt hands its
 * text to the box (onPick) and closes — it is never sent on its own, so the person can edit it and press Ask.
 */
export function PromptLibrary({ scope, onPick }: { scope: PromptScope; onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const groups = promptGroups(scope);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 text-[11px] text-secondary hover:text-primary">
        <BookOpen className="h-3.5 w-3.5" aria-hidden /> Prompt library
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-default bg-base p-2">
          {groups.map((g) => (
            <div key={g.group}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{g.group}</p>
              <ul className="mt-1 space-y-0.5">
                {g.prompts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      title={p.text}
                      onClick={() => {
                        onPick(p.text);
                        setOpen(false);
                      }}
                      className="w-full rounded px-1.5 py-1 text-left text-xs text-primary hover:bg-surface"
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[10px] text-muted">Picking one puts it in the box — change it if you like, then press Ask.</p>
        </div>
      )}
    </div>
  );
}
