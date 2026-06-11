"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";

/**
 * MentionInput — textarea with @-autocomplete for tagging company
 * members. Drops into any feedback / smoke-test / notes surface as a
 * replacement for a plain <textarea>.
 *
 * What it does:
 *   - Detects an unbroken `@…` token at the caret (whitespace or
 *     start-of-text immediately before the @).
 *   - Filters the `members` prop by the query and shows a dropdown.
 *   - Arrow keys navigate, Enter / Tab select, Esc closes. Click also
 *     works.
 *   - On select, the partial `@query` in the textarea is replaced
 *     with `@[Display Name](uuid)` markdown-link syntax. The user
 *     sees `@Display Name` highlighted via MentionText on display;
 *     server-side parsing reads the UUID for chain-event emission.
 *
 * Why this format: keeps the source-of-truth user_id stable across
 * renames, doesn't require a side-car JSON column, and round-trips
 * cleanly through plain-text storage (jsonb body, chat messages,
 * smoke_test_results.notes). See `src/lib/mentions/extract.ts`.
 *
 * What it does NOT do (yet):
 *   - In-place rendering of the styled mention inside the textarea.
 *     Native <textarea> can't render styled spans. The chip-style
 *     render only shows post-submit via MentionText. Acceptable for
 *     v1 — testers see the raw `@[name](uuid)` text while editing
 *     but it's still legible. A WYSIWYG contenteditable upgrade is a
 *     follow-up if the raw markup proves annoying.
 */

export type MentionMember = { id: string; fullName: string };

type Props = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> & {
  value: string;
  onChange: (next: string) => void;
  members: ReadonlyArray<MentionMember>;
  /** Max suggestions shown in the dropdown. */
  maxSuggestions?: number;
};

type MentionContext = {
  triggerStart: number;
  query: string;
};

function detectMentionContext(
  value: string,
  caret: number
): MentionContext | null {
  // Walk backward from caret. Whitespace, ] ( ) [ all break the token.
  // If we land on `@` whose preceding char is start-of-text or
  // whitespace, we're inside a mention query.
  let i = caret;
  while (i > 0) {
    const ch = value[i - 1];
    if (ch === undefined) return null;
    if (ch === "@") {
      const beforeAt = i - 2 >= 0 ? value[i - 2] : "";
      if (i - 1 === 0 || /\s/.test(beforeAt ?? "")) {
        return { triggerStart: i - 1, query: value.slice(i, caret) };
      }
      return null;
    }
    if (/\s/.test(ch) || ch === "[" || ch === "]" || ch === "(" || ch === ")") {
      return null;
    }
    i--;
  }
  return null;
}

function scoreMatch(member: MentionMember, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const name = (member.fullName || "").toLowerCase();
  if (name.startsWith(q)) return 3;
  // Any word starts with q
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 1;
  return 0;
}

export function MentionInput({
  value,
  onChange,
  members,
  maxSuggestions = 6,
  onKeyDown: externalOnKeyDown,
  className,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);

  const context = useMemo(() => detectMentionContext(value, caret), [
    value,
    caret,
  ]);

  const suggestions = useMemo(() => {
    if (!context) return [];
    return members
      .map((m) => ({ m, score: scoreMatch(m, context.query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.m.fullName.localeCompare(b.m.fullName))
      .slice(0, maxSuggestions)
      .map((x) => x.m);
  }, [context, members, maxSuggestions]);

  // Open the dropdown only when we have a mention context AND at
  // least one match. Closes automatically as soon as the caret
  // leaves the @-token or no member matches the query.
  useEffect(() => {
    if (context && suggestions.length > 0) {
      setOpen(true);
      setSelected(0);
    } else {
      setOpen(false);
    }
  }, [context, suggestions.length]);

  const insertMention = (member: MentionMember) => {
    if (!context) return;
    const before = value.slice(0, context.triggerStart);
    const after = value.slice(caret);
    const insertion = `@[${member.fullName}](${member.id}) `;
    const next = before + insertion + after;
    onChange(next);
    const newCaret = (before + insertion).length;
    // Move caret to end of insertion on next paint.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(newCaret, newCaret);
      setCaret(newCaret);
    });
    setOpen(false);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCaret(e.target.selectionStart ?? 0);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(e.currentTarget.selectionStart ?? 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Intercept dropdown navigation keys only while open.
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(
          (s) => (s - 1 + suggestions.length) % suggestions.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const choice = suggestions[selected];
        if (choice) insertMention(choice);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    externalOnKeyDown?.(e);
  };

  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onClick={handleSelect}
        onKeyUp={handleSelect}
        onKeyDown={handleKeyDown}
        className={className}
      />
      {open && context && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-20 bg-surface border border-default rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          role="listbox"
          aria-label="Mention suggestions"
        >
          {suggestions.map((m, i) => {
            const initials = (m.fullName ?? "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const active = i === selected;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  // mousedown to fire BEFORE textarea blur so caret
                  // stays where we want it after the insertion.
                  e.preventDefault();
                  insertMention(m);
                }}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  active ? "bg-[#FACC15]/10" : "hover:bg-surface-raised"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FACC15] to-[#FDE047] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                  {initials}
                </div>
                <span className="text-sm text-primary truncate">
                  {m.fullName}
                </span>
                <span className="ml-auto text-[10px] text-muted font-mono">
                  @{m.fullName.split(/\s+/)[0]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
