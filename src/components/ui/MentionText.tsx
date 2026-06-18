"use client";

import { tokenizeMentions } from "@/lib/mentions/extract";

/**
 * MentionText — render a string that may contain `@[name](uuid)`
 * markup as a mix of plain text and styled mention chips.
 *
 * Use anywhere user-authored content shows back to a reader: the
 * admin feedback inbox body, the My-feedback expanded view, and any
 * comment thread. Pairs with MentionInput on the authoring side.
 *
 * Preserves whitespace (the `whitespace-pre-wrap` default on the
 * wrapping element keeps line breaks). The wrapper element is a
 * <span> so it composes inside <p>, table cells, etc. without
 * forcing a block context — callers control block layout.
 */

export function MentionText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = tokenizeMentions(text);
  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          // Empty text segments (consecutive mentions) are skipped to
          // avoid littering the DOM with empty nodes.
          if (!seg.text) return null;
          return <span key={i}>{seg.text}</span>;
        }
        return (
          <span
            key={i}
            data-mention-user-id={seg.userId}
            className="inline-flex items-center font-semibold text-brand bg-ember-400/10 border border-ember-400/30 rounded px-1.5 py-0.5 mx-0.5 text-[0.9em]"
            title={`Mentioned: ${seg.displayName}`}
          >
            @{seg.displayName}
          </span>
        );
      })}
    </span>
  );
}
