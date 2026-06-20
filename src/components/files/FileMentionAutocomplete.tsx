"use client";

import {
  KeyboardEvent,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Paperclip, Loader2 } from "lucide-react";
import {
  buildFileMention,
  detectFileMentionContext,
} from "@/lib/files/fileMention";

type FileResult = {
  id: string;
  title: string;
  mime_type: string;
  classification_lane: "classified" | "casual";
};

/**
 * Autocomplete dropdown for `@file<query>` mentions in a textarea.
 *
 * Usage: render alongside the textarea, pass the textareaRef +
 * value + setValue. The component watches the textarea's caret
 * position via selection events on the textarea (forwarded via
 * the keydown handler we expose) and pops a dropdown when the
 * cursor is inside a `@file<query>` token.
 *
 * Per §A11: surfaces matching files (a count drawn from the
 * library); the user decides which to insert. The dropdown
 * never selects automatically.
 */
export function FileMentionAutocomplete({
  textareaRef,
  value,
  onChange,
  onKeyDown,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  /** External keydown handler — we wrap it so navigation keys
   *  (ArrowUp/Down/Enter/Escape) are intercepted only when the
   *  dropdown is open. */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const context = useMemo(
    () => detectFileMentionContext(value, caret),
    [value, caret]
  );

  // Debounced fetch of matching files
  useEffect(() => {
    if (!context) {
      setOpen(false);
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: context.query,
          limit: "8",
        });
        const res = await fetch(`/api/files/search?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setResults(data.files ?? []);
        setOpen((data.files?.length ?? 0) > 0);
        setSelected(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [context]);

  // Update caret on selection change in the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const update = () => setCaret(el.selectionStart ?? 0);
    el.addEventListener("keyup", update);
    el.addEventListener("click", update);
    el.addEventListener("input", update);
    return () => {
      el.removeEventListener("keyup", update);
      el.removeEventListener("click", update);
      el.removeEventListener("input", update);
    };
  }, [textareaRef]);

  const insert = useCallback(
    (file: FileResult) => {
      if (!context) return;
      const before = value.slice(0, context.triggerStart);
      const after = value.slice(caret);
      const marker = buildFileMention({ title: file.title, fileId: file.id });
      const insertion = `${marker} `;
      const next = before + insertion + after;
      onChange(next);
      const newCaret = (before + insertion).length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
        setCaret(newCaret);
      });
      setOpen(false);
      setResults([]);
    },
    [context, value, caret, onChange, textareaRef]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (open && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelected((s) => (s + 1) % results.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelected((s) => (s - 1 + results.length) % results.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const pick = results[selected];
          if (pick) insert(pick);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          return;
        }
      }
      onKeyDown?.(e);
    },
    [open, results, selected, insert, onKeyDown]
  );

  // Forward the keydown to the parent so chat composer can hook
  // it onto the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      // Only intercept navigation keys when dropdown is open
      if (!open) return;
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === "Tab" ||
        e.key === "Escape"
      ) {
        e.preventDefault();
        const synth = {
          key: e.key,
          preventDefault: () => {},
        } as unknown as KeyboardEvent<HTMLTextAreaElement>;
        handleKeyDown(synth);
      }
    };
    el.addEventListener("keydown", handler, true);
    return () => {
      el.removeEventListener("keydown", handler, true);
    };
  }, [textareaRef, open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="absolute bottom-full mb-1 left-0 right-0 z-30">
      <div className="rounded-lg border border-default bg-surface shadow-lg max-h-64 overflow-y-auto">
        <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted font-bold border-b border-default flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" aria-hidden />
          @file
          {loading && (
            <Loader2 className="w-3 h-3 animate-spin ml-auto" aria-hidden />
          )}
        </div>
        <ul>
          {results.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(f);
                }}
                onMouseEnter={() => setSelected(i)}
                className={`w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2 ${
                  i === selected
                    ? "bg-ember-400/15 text-brand"
                    : "text-primary hover:bg-white/[0.03]"
                }`}
              >
                <Paperclip className="w-3 h-3 flex-shrink-0" aria-hidden />
                <span className="truncate flex-1">{f.title}</span>
                <span className="text-[10px] uppercase tracking-widest text-muted flex-shrink-0">
                  {f.classification_lane}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-2.5 py-1 text-[10px] text-muted border-t border-default flex items-center gap-2">
          <span>↑↓ navigate</span>
          <span>· Enter to insert</span>
          <span>· Esc to dismiss</span>
        </div>
      </div>
    </div>
  );
}
