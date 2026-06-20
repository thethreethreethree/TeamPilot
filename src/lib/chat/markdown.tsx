/**
 * Lightweight markdown renderer for chat messages.
 *
 * Why hand-rolled, not `marked` or `react-markdown`:
 *   - No new runtime dep — bundle stays small.
 *   - We render INTO React nodes, not HTML strings, so XSS surface is
 *     just whatever React already escapes (the text content goes
 *     through React's text rendering path, which auto-escapes).
 *   - We only need a narrow subset of markdown: the things a chat
 *     toolbar produces. No tables, no images, no headings, no html.
 *
 * Supported syntax (all combinations work in a single message):
 *
 *   **bold**          → <strong>bold</strong>
 *   *italic*          → <em>italic</em>
 *   `inline code`     → <code>inline code</code>
 *   ```code block```  → <pre><code>code block</code></pre>
 *   [text](url)       → <a href="url">text</a>  (target=_blank, rel=noopener)
 *   bare https://…    → auto-link with the same attrs
 *   > quote line      → blockquote (one line at a time)
 *   - bullet line     → <ul><li>…
 *   1. ordered line   → <ol><li>…
 *
 * Multi-line bodies preserve their line breaks. Lists collapse adjacent
 * lines into a single list. Blockquotes do the same.
 */

import React from "react";
import { FILE_MENTION_INLINE } from "@/lib/files/fileMention";
import { FileMentionChip } from "@/components/files/FileMentionChip";

/**
 * Render a single line's INLINE content into React nodes. Handles
 * bold, italic, inline code, explicit links, and auto-linked bare URLs.
 *
 * The implementation tokenizes greedily — the first matching pattern
 * wins at each position. Order matters: code first (it can contain
 * markdown chars that should be inert), then explicit links, then
 * bold, then italic, then bare URLs.
 */
function renderInline(line: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let counter = 0;

  // We scan from left to right. At each position, try in order:
  //   `code`
  //   [text](url)
  //   **bold**
  //   *italic*
  //   auto-URL
  // First that matches at `cursor` wins; otherwise advance by 1 char.
  while (cursor < line.length) {
    const remaining = line.slice(cursor);

    // 1) inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${counter++}`}
          className="px-1 py-0.5 rounded bg-ember-400/[0.10] text-brand font-mono text-[0.85em]"
        >
          {codeMatch[1]}
        </code>
      );
      cursor += codeMatch[0].length;
      continue;
    }

    // 2a) @file mention — must be checked BEFORE the plain
    //     markdown-link pattern because they share `[Title](X)`
    //     shape. The `@file` prefix is what distinguishes them.
    const fileMatch = remaining.match(FILE_MENTION_INLINE);
    if (fileMatch) {
      nodes.push(
        <FileMentionChip
          key={`${keyPrefix}-fm-${counter++}`}
          fileId={fileMatch[2] ?? ""}
          title={fileMatch[1] ?? ""}
        />
      );
      cursor += fileMatch[0].length;
      continue;
    }

    // 2) explicit markdown link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (linkMatch) {
      nodes.push(
        <a
          key={`${keyPrefix}-l-${counter++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline underline-offset-2 hover:text-primary"
        >
          {linkMatch[1]}
        </a>
      );
      cursor += linkMatch[0].length;
      continue;
    }

    // 3) bold (** … **) — has to be checked BEFORE italic so the
    //    leading ** isn't eaten by the * pattern.
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${counter++}`} className="font-semibold">
          {renderInline(boldMatch[1] ?? "", `${keyPrefix}-bi${counter}`)}
        </strong>
      );
      cursor += boldMatch[0].length;
      continue;
    }

    // 4) italic (* … *)
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      nodes.push(
        <em key={`${keyPrefix}-i-${counter++}`}>
          {renderInline(italicMatch[1] ?? "", `${keyPrefix}-ii${counter}`)}
        </em>
      );
      cursor += italicMatch[0].length;
      continue;
    }

    // 5) bare URL auto-link — matches `https://…` not already inside an
    //    explicit link (those branches already consumed).
    const urlMatch = remaining.match(/^(https?:\/\/[^\s<>()]+[^\s<>().,!?;:])/);
    if (urlMatch) {
      nodes.push(
        <a
          key={`${keyPrefix}-u-${counter++}`}
          href={urlMatch[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline underline-offset-2 hover:text-primary break-all"
        >
          {urlMatch[1]}
        </a>
      );
      cursor += urlMatch[0].length;
      continue;
    }

    // No markdown match — accumulate one plain char and continue.
    // To avoid spawning one React text node per char, we look ahead
    // until the next special character or end of line.
    const nextSpecial = remaining.search(/[`*\[]|https?:\/\//);
    const take = nextSpecial === -1 ? remaining.length : Math.max(nextSpecial, 1);
    nodes.push(remaining.slice(0, take));
    cursor += take;
  }

  return nodes;
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "pre"; lines: string[] };

/**
 * Group the raw body into block-level chunks (paragraph, list, blockquote,
 * fenced code). Each chunk is then rendered via the inline pass above.
 */
function groupBlocks(body: string): Block[] {
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let fenced = false;
  let fenceBuf: string[] = [];

  const flush = () => {
    if (fenceBuf.length > 0) {
      blocks.push({ type: "pre", lines: fenceBuf });
      fenceBuf = [];
    }
  };

  for (const raw of lines) {
    if (raw.startsWith("```")) {
      if (fenced) {
        flush();
        fenced = false;
      } else {
        fenced = true;
      }
      continue;
    }
    if (fenced) {
      fenceBuf.push(raw);
      continue;
    }

    const ul = raw.match(/^[-*+]\s+(.+)$/);
    const ol = raw.match(/^\d+\.\s+(.+)$/);
    const quote = raw.match(/^>\s?(.*)$/);

    const last = blocks[blocks.length - 1];
    if (ul) {
      if (last && last.type === "ul") last.items.push(ul[1]!);
      else blocks.push({ type: "ul", items: [ul[1]!] });
    } else if (ol) {
      if (last && last.type === "ol") last.items.push(ol[1]!);
      else blocks.push({ type: "ol", items: [ol[1]!] });
    } else if (quote) {
      if (last && last.type === "quote") last.lines.push(quote[1]!);
      else blocks.push({ type: "quote", lines: [quote[1]!] });
    } else {
      if (last && last.type === "p") last.lines.push(raw);
      else blocks.push({ type: "p", lines: [raw] });
    }
  }
  flush();
  return blocks;
}

/**
 * Render a message body as React nodes with markdown formatting
 * applied. Use this in MessageRow and any other surface that displays
 * user-authored chat content.
 */
export function renderMessageBody(body: string | null): React.ReactNode {
  if (!body) return null;
  const blocks = groupBlocks(body);
  return blocks.map((block, i) => {
    const k = `b${i}`;
    if (block.type === "ul") {
      return (
        <ul key={k} className="list-disc list-outside pl-5 my-1 space-y-0.5">
          {block.items.map((item, j) => (
            <li key={`${k}-${j}`}>{renderInline(item, `${k}-${j}`)}</li>
          ))}
        </ul>
      );
    }
    if (block.type === "ol") {
      return (
        <ol key={k} className="list-decimal list-outside pl-5 my-1 space-y-0.5">
          {block.items.map((item, j) => (
            <li key={`${k}-${j}`}>{renderInline(item, `${k}-${j}`)}</li>
          ))}
        </ol>
      );
    }
    if (block.type === "quote") {
      return (
        <blockquote
          key={k}
          className="border-l-2 border-ember-400/60 pl-3 my-1 text-secondary italic"
        >
          {block.lines.map((line, j) => (
            <p key={`${k}-${j}`}>{renderInline(line, `${k}-${j}`)}</p>
          ))}
        </blockquote>
      );
    }
    if (block.type === "pre") {
      return (
        <pre
          key={k}
          className="my-1 p-2 rounded bg-ember-400/[0.06] border border-ember-400/20 text-xs font-mono text-primary overflow-x-auto"
        >
          <code>{block.lines.join("\n")}</code>
        </pre>
      );
    }
    // paragraph — preserve in-paragraph newlines as <br/> so the user's
    // hard wraps are honored.
    return (
      <p key={k} className="whitespace-pre-wrap leading-relaxed">
        {block.lines.map((line, j) => (
          <React.Fragment key={`${k}-${j}`}>
            {renderInline(line, `${k}-${j}`)}
            {j < block.lines.length - 1 && "\n"}
          </React.Fragment>
        ))}
      </p>
    );
  });
}
