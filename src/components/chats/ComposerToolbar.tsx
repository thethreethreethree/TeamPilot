"use client";

import { useEffect } from "react";
import {
  Bold,
  Code2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * ComposerToolbar — markdown formatting controls + keyboard shortcuts
 * for the chat composer.
 *
 * Operates directly on a HTMLTextAreaElement ref provided by the parent
 * (no controlled value — we wrap the user's selection in markdown chars
 * and then echo the new value via onChange so the parent state stays in
 * sync).
 *
 * Inspired by the formatting toolbar in the user's Slack-style mockup,
 * but tighter: we only ship the formatting primitives that actually
 * produce useful semantic output in a chat thread. Media buttons
 * (paste / mic / sticker / video) are queued behind their respective
 * infrastructure builds.
 *
 * Shortcuts (when the textarea is focused):
 *   Ctrl/Cmd + B → bold
 *   Ctrl/Cmd + I → italic
 *   Ctrl/Cmd + E → inline code
 *   Ctrl/Cmd + K → link (prompts for URL)
 *   Ctrl/Cmd + Shift + 7 → ordered list
 *   Ctrl/Cmd + Shift + 8 → bulleted list
 *   Ctrl/Cmd + Shift + 9 → blockquote
 */

type Action =
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "ul"
  | "ol"
  | "quote";

/**
 * `trailing` slot: render at the END of the toolbar row (after the
 * markdown formatting buttons). Used by chat composer to surface the
 * Attach (file upload) button without taking a new row. Per the
 * 2026-06-19 founder report — Attach was eating vertical space below
 * the toolbar; moving it into the toolbar row closes the gap.
 */
export function ComposerToolbar({
  textareaRef,
  value,
  onChange,
  className,
  trailing,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** Optional slot rendered at the end of the toolbar row, after
   *  the markdown formatting buttons. Use for inline composer
   *  affordances that should NOT take a new row (e.g., Attach). */
  trailing?: React.ReactNode;
}) {
  const apply = (action: Action) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);

    let inserted: string;
    let nextSelStart = start;
    let nextSelEnd = end;

    switch (action) {
      case "bold": {
        inserted = `**${selected || "bold text"}**`;
        nextSelStart = start + 2;
        nextSelEnd = start + 2 + (selected || "bold text").length;
        break;
      }
      case "italic": {
        inserted = `*${selected || "italic text"}*`;
        nextSelStart = start + 1;
        nextSelEnd = start + 1 + (selected || "italic text").length;
        break;
      }
      case "code": {
        // Single-line vs block: if the selection contains a newline,
        // fence it as a code block; otherwise wrap in backticks.
        if (selected.includes("\n")) {
          inserted = `\n\`\`\`\n${selected}\n\`\`\`\n`;
        } else {
          inserted = `\`${selected || "code"}\``;
        }
        nextSelStart = start + 1;
        nextSelEnd = start + 1 + (selected || "code").length;
        break;
      }
      case "link": {
        // Prompting is the simplest path that doesn't require an
        // anchored mini-modal. Slack uses the same flow for Cmd+K.
        const url =
          typeof window !== "undefined"
            ? window.prompt("Link URL", "https://")
            : null;
        if (!url) return;
        const label = selected || "link";
        inserted = `[${label}](${url})`;
        nextSelStart = start + 1;
        nextSelEnd = start + 1 + label.length;
        break;
      }
      case "ul": {
        inserted = prefixLines(selected || "list item", "- ");
        nextSelStart = start + 2;
        nextSelEnd = start + inserted.length;
        break;
      }
      case "ol": {
        inserted = prefixLines(selected || "list item", "1. ", true);
        nextSelStart = start + 3;
        nextSelEnd = start + inserted.length;
        break;
      }
      case "quote": {
        inserted = prefixLines(selected || "quoted", "> ");
        nextSelStart = start + 2;
        nextSelEnd = start + inserted.length;
        break;
      }
    }

    const next = value.slice(0, start) + inserted + value.slice(end);
    onChange(next);
    // Restore focus + selection after React re-renders.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextSelStart, nextSelEnd);
    });
  };

  // Keyboard shortcuts — listen on the textarea itself (capture phase
  // via window listener while the textarea is the active element so we
  // catch Cmd+B etc before the browser's default).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== el) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      // Order matters: shifted variants first.
      if (e.shiftKey && e.key === "8") {
        e.preventDefault();
        apply("ul");
        return;
      }
      if (e.shiftKey && e.key === "7") {
        e.preventDefault();
        apply("ol");
        return;
      }
      if (e.shiftKey && e.key === "9") {
        e.preventDefault();
        apply("quote");
        return;
      }
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        apply("bold");
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        apply("italic");
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        apply("code");
        return;
      }
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        apply("link");
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <LearningHint
      as="block"
      category="Composer · Markdown"
      title="Formatting toolbar"
      whatItIs="Markdown formatting controls for the composer — bold, italic, inline code, link, bulleted list, ordered list, blockquote. Each button wraps the current selection in the matching markdown syntax. Keyboard shortcuts work too (Ctrl/Cmd + B for bold, etc.)."
      why="Plain text loses structure fast. A message with a real list, an inline code reference, or a quoted excerpt reads RADICALLY differently from the same content as a wall of prose. The toolbar exists so the team can produce structured messages without leaving the composer for a different surface."
      how="Select text first, then click the formatting button (or use the keyboard shortcut). To insert a link, select the link text and click the link icon — you'll be prompted for the URL. Lists work on the current line; press Enter to add a list item."
      principle="Structure compounds clarity. The 10 seconds you spend formatting a message saves the reader 30 seconds reading it."
    >
    <div
      className={cn(
        "flex items-center gap-0.5 flex-wrap py-1.5 px-2 border-b border-default",
        className
      )}
    >
      <ToolButton icon={Bold} label="Bold (Ctrl+B)" onClick={() => apply("bold")} />
      <ToolButton
        icon={Italic}
        label="Italic (Ctrl+I)"
        onClick={() => apply("italic")}
      />
      <ToolButton
        icon={Code2}
        label="Code (Ctrl+E)"
        onClick={() => apply("code")}
      />
      <ToolButton
        icon={Link2}
        label="Link (Ctrl+K)"
        onClick={() => apply("link")}
      />
      <Divider />
      <ToolButton
        icon={List}
        label="Bulleted list (Ctrl+Shift+8)"
        onClick={() => apply("ul")}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list (Ctrl+Shift+7)"
        onClick={() => apply("ol")}
      />
      <ToolButton
        icon={Quote}
        label="Blockquote (Ctrl+Shift+9)"
        onClick={() => apply("quote")}
      />
      {trailing && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5 ml-auto">{trailing}</div>
        </>
      )}
    </div>
    </LearningHint>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      // p-2 yields ~30px tap target with the 3.5x3.5 icon. The
      // previous p-1.5 was a 24px tap target — uncomfortably small
      // on mobile.
      className="p-2 rounded text-secondary hover:text-brand hover:bg-ember-400/[0.08] transition-colors"
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-default mx-1 self-center" />;
}

function prefixLines(text: string, prefix: string, numbered = false): string {
  return text
    .split("\n")
    .map((line, i) =>
      numbered ? `${i + 1}. ${line}` : `${prefix}${line}`
    )
    .join("\n");
}
