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

/**
 * Decompression-bomb guard for the ZIP formats (docx/odt/epub). A small ZIP can declare a huge uncompressed
 * entry — `file.async(...)` would inflate the WHOLE entry into memory BEFORE the char cap applies, OOM/timeout
 * the function. jszip exposes the DECLARED uncompressed size (`_data.uncompressedSize`) from the central
 * directory, so we reject an oversized entry BEFORE inflating it. 25 MB is ~10× the largest real doc's XML (a
 * 200k-char doc's document.xml is a few MB), so legit files are never affected; a bomb fails fast + clean. The
 * timeout/isolation remain the backstop for a malformed ZIP that lies about its declared size.
 */
export const MAX_DECOMPRESSED_BYTES = 25 * 1024 * 1024;

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
export class DecompressionLimitError extends Error {
  constructor(message = "The document expands to too much content to process safely.") {
    super(message);
    this.name = "DecompressionLimitError";
  }
}

/** Declared uncompressed size of a jszip entry (central-directory metadata), 0 if unavailable. */
function declaredSize(file: unknown): number {
  const d = (file as { _data?: { uncompressedSize?: number } })?._data;
  return typeof d?.uncompressedSize === "number" ? d.uncompressedSize : 0;
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
  filename: string,
  opts: { maxChars?: number } = {}
): Promise<{ text: string; format: SupportedFormat }> {
  // The cap defaults to the 100k Sales Coach field (F5), but each caller passes its OWN consumer's cap
  // (C.A.R.E's knowledge field is 200k) so extraction always matches what that field will save.
  const maxChars = Math.max(1, opts.maxChars ?? MAX_EXTRACTED_CHARS);
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
      raw = await extractEpub(buffer, maxChars);
      break;
    case "pdf":
      raw = await extractPdf(buffer);
      break;
  }

  const text = normalizeWhitespace(raw).slice(0, maxChars);
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
  // Decompression-bomb guard: reject an oversized entry from its DECLARED size before inflating it.
  if (declaredSize(file) > MAX_DECOMPRESSED_BYTES) throw new DecompressionLimitError();
  return file.async("string");
}

/** EPUB = a ZIP of XHTML. Concatenate the (x)html documents in spine-ish name order, bounded. */
async function extractEpub(buffer: Uint8Array, maxChars: number = MAX_EXTRACTED_CHARS): Promise<string> {
  const zip = await loadZip(buffer);
  const htmlFiles = Object.values(zip.files)
    .filter((f) => !f.dir && /\.(xhtml|html|htm)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parts: string[] = [];
  let total = 0;
  let declaredTotal = 0;
  for (const f of htmlFiles) {
    if (total >= maxChars) break; // bound huge books by extracted-char budget
    // Decompression-bomb guard: reject before inflating an entry whose declared size — or the running total —
    // exceeds the cap (a single huge entry, or many entries summing to a bomb).
    declaredTotal += declaredSize(f);
    if (declaredSize(f) > MAX_DECOMPRESSED_BYTES || declaredTotal > MAX_DECOMPRESSED_BYTES) {
      throw new DecompressionLimitError();
    }
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
