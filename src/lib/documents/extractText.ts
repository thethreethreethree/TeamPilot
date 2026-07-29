import JSZip from "jszip";

/**
 * Multi-format document text extraction (founder 2026-07-30 — Sales Coach doc upload).
 *
 * Clients upload a document; its text fills the Coaching Methodology / Product editors. Formats split
 * by what is reliably parseable in a Node/serverless runtime:
 *   - native (no dep):   .txt .md (raw), .html (strip), .rtf (strip)
 *   - jszip (installed): .docx .odt .epub  (all ZIP containers of XML/XHTML)
 *   - unpdf (installed): .pdf  (text-layer only; a scanned PDF has no text → EmptyExtractionError)
 *   - UNSUPPORTED:       .doc (legacy binary), .pages (Apple bundle), and cloud docs (Google Docs) —
 *                        not reliably parseable serverlessly, so the caller tells the user to export as
 *                        PDF/DOCX/TXT. A33: the support boundary is an explicit extension allowlist, not
 *                        a fuzzy content sniff.
 *
 * A27: the extractor must deliver REAL text or fail honestly — it never returns empty as if it succeeded,
 * so the UI can refuse to overwrite the editor with nothing.
 */

export type SupportedFormat = "txt" | "md" | "html" | "rtf" | "docx" | "odt" | "epub" | "pdf";

/** Extension → format. The single source of truth for what is accepted (A33). */
const SUPPORTED: Record<string, SupportedFormat> = {
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  rtf: "rtf",
  docx: "docx",
  odt: "odt",
  epub: "epub",
  pdf: "pdf",
};

/** Formats a user is likely to try that we deliberately cannot parse — named so the message is specific. */
const KNOWN_UNSUPPORTED: Record<string, string> = {
  doc: "legacy Word (.doc)",
  pages: "Apple Pages (.pages)",
  gdoc: "Google Docs",
};

/**
 * Cap on extracted text. Set to the SAME 100k the Coaching Methodology / Product editors + their save
 * endpoints enforce (corpus/product route zod max(100000)) — F5: extracting to 500k filled the editor
 * with text the Save button then rejected (text.length > 100000 disables Save), a dead-end for large
 * docs. Capping here to the field cap means the extracted text always fits and `truncated` fires when a
 * doc is trimmed, so the manager sees an honest "trimmed to fit" notice instead of a disabled Save.
 */
export const MAX_EXTRACTED_CHARS = 100_000;

export class UnsupportedFormatError extends Error {
  constructor(public readonly ext: string, message: string) {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}
export class EmptyExtractionError extends Error {
  constructor(message = "No readable text was found in the document.") {
    super(message);
    this.name = "EmptyExtractionError";
  }
}

export function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]+)\s*$/i.exec(filename.trim());
  return m?.[1]?.toLowerCase() ?? "";
}

export function formatFor(filename: string): SupportedFormat | null {
  return SUPPORTED[extensionOf(filename)] ?? null;
}

export const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED);

/**
 * Extract plain text from a document buffer. Throws UnsupportedFormatError for a format we decline, and
 * EmptyExtractionError when a supported format yields nothing (e.g. a scanned PDF) — never a silent "".
 */
export async function extractText(
  buffer: Uint8Array,
  filename: string
): Promise<{ text: string; format: SupportedFormat }> {
  const ext = extensionOf(filename);
  const format = SUPPORTED[ext];
  if (!format) {
    const known = KNOWN_UNSUPPORTED[ext];
    throw new UnsupportedFormatError(
      ext,
      known
        ? `${known} can't be read directly. Please export it as PDF, DOCX, or TXT and upload that.`
        : `.${ext || "?"} isn't a supported document type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.`
    );
  }

  let raw: string;
  switch (format) {
    case "txt":
    case "md":
      raw = decodeUtf8(buffer);
      break;
    case "html":
      raw = stripHtml(decodeUtf8(buffer));
      break;
    case "rtf":
      raw = stripRtf(decodeUtf8(buffer));
      break;
    case "docx":
      raw = stripXml(await unzipEntry(buffer, "word/document.xml"), "w:p");
      break;
    case "odt":
      raw = stripXml(await unzipEntry(buffer, "content.xml"), "text:p");
      break;
    case "epub":
      raw = await extractEpub(buffer);
      break;
    case "pdf":
      raw = await extractPdf(buffer);
      break;
  }

  const text = normalizeWhitespace(raw).slice(0, MAX_EXTRACTED_CHARS);
  if (!text.trim()) throw new EmptyExtractionError();
  return { text, format };
}

// ---------------------------------------------------------------- format helpers

function decodeUtf8(buffer: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer).replace(/^﻿/, "");
}

function decodeEntities(s: string): string {
  // F2: &amp; is decoded LAST. Decoding it first double-decodes escaped entities —
  // "&amp;lt;" (the escaped literal "&lt;") would become "&lt;" then "<". By replacing the
  // named/numeric entities first and &amp; last, "&amp;lt;" correctly stays "&lt;".
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function safeCodePoint(n: number): string {
  try {
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

/** XML → text: paragraph tag becomes a newline, all other tags drop, entities decode. */
function stripXml(xml: string, paragraphTag: string): string {
  return decodeEntities(
    xml
      .replace(new RegExp(`</${paragraphTag}>`, "gi"), "\n")
      .replace(/<[^>]+>/g, "")
  );
}

/** Minimal RTF → text: drop control words, hex escapes, and group braces. */
function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\par[d]?\b/gi, "\n")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\\\n/g, "\n");
}

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------- zip / pdf

async function loadZip(buffer: Uint8Array): Promise<JSZip> {
  return JSZip.loadAsync(buffer);
}

async function unzipEntry(buffer: Uint8Array, path: string): Promise<string> {
  const zip = await loadZip(buffer);
  const file = zip.file(path);
  if (!file) throw new EmptyExtractionError("The document is missing its text content.");
  return file.async("string");
}

/** EPUB = a ZIP of XHTML. Concatenate the (x)html documents in spine-ish name order, bounded. */
async function extractEpub(buffer: Uint8Array): Promise<string> {
  const zip = await loadZip(buffer);
  const htmlFiles = Object.values(zip.files)
    .filter((f) => !f.dir && /\.(xhtml|html|htm)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parts: string[] = [];
  let total = 0;
  for (const f of htmlFiles) {
    if (total >= MAX_EXTRACTED_CHARS) break; // bound zip-bomb / huge books
    const text = stripHtml(await f.async("string"));
    parts.push(text);
    total += text.length;
  }
  return parts.join("\n\n");
}

async function extractPdf(buffer: Uint8Array): Promise<string> {
  // unpdf is pure-JS and serverless-safe. mergePages joins page text with newlines.
  const { extractText: unpdfExtract } = await import("unpdf");
  const { text } = await unpdfExtract(buffer, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
