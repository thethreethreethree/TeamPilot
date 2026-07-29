import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  extractText,
  formatFor,
  extensionOf,
  UnsupportedFormatError,
  EmptyExtractionError,
  SUPPORTED_EXTENSIONS,
  MAX_EXTRACTED_CHARS,
} from "../extractText";

const enc = (s: string) => new TextEncoder().encode(s);

async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const z = new JSZip();
  for (const [path, content] of Object.entries(files)) z.file(path, content);
  return z.generateAsync({ type: "uint8array" });
}

describe("extractText — format detection", () => {
  it("maps extensions case-insensitively", () => {
    expect(extensionOf("Notes.TXT")).toBe("txt");
    expect(formatFor("methodology.DOCX")).toBe("docx");
    expect(formatFor("x.pages")).toBeNull();
  });
  it("advertises the supported set", () => {
    expect(SUPPORTED_EXTENSIONS).toEqual(expect.arrayContaining(["txt", "md", "html", "rtf", "docx", "odt", "epub", "pdf"]));
  });
});

describe("extractText — native text formats", () => {
  it("txt/md returns the raw text, BOM stripped", async () => {
    expect((await extractText(enc("﻿Hello methodology"), "a.txt")).text).toBe("Hello methodology");
    expect((await extractText(enc("# Heading\n\nbody"), "a.md")).text).toContain("Heading");
  });
  it("html strips tags + decodes entities + keeps block breaks", async () => {
    const { text } = await extractText(enc("<h1>Title</h1><p>Ben &amp; Jerry</p><script>bad()</script>"), "a.html");
    expect(text).toContain("Title");
    expect(text).toContain("Ben & Jerry");
    expect(text).not.toContain("bad()");
  });
  it("rtf drops control words + hex escapes", async () => {
    const { text } = await extractText(enc("{\\rtf1\\ansi Hello \\b world\\b0 \\'21}"), "a.rtf");
    expect(text).toContain("Hello");
    expect(text).toContain("world");
    expect(text).not.toContain("\\rtf1");
  });
});

describe("extractText — ZIP formats via jszip (no new dep)", () => {
  it("docx reads word/document.xml", async () => {
    const buf = await zip({
      "[Content_Types].xml": "<Types/>",
      "word/document.xml": "<w:document><w:body><w:p><w:r><w:t>Hello Docx</w:t></w:r></w:p><w:p><w:r><w:t>Line two</w:t></w:r></w:p></w:body></w:document>",
    });
    const { text, format } = await extractText(buf, "m.docx");
    expect(format).toBe("docx");
    expect(text).toContain("Hello Docx");
    expect(text).toContain("Line two");
    expect(text).not.toContain("<w:");
  });
  it("odt reads content.xml", async () => {
    const buf = await zip({ "content.xml": "<office><text:p>Hello Odt objection rules</text:p></office>" });
    expect((await extractText(buf, "m.odt")).text).toContain("Hello Odt objection rules");
  });
  it("epub concatenates its xhtml", async () => {
    const buf = await zip({
      "OEBPS/ch1.xhtml": "<html><body><p>Chapter one</p></body></html>",
      "OEBPS/ch2.xhtml": "<html><body><p>Chapter two</p></body></html>",
      "mimetype": "application/epub+zip",
    });
    const { text } = await extractText(buf, "b.epub");
    expect(text).toContain("Chapter one");
    expect(text).toContain("Chapter two");
  });
});

describe("extractText — honest failure (A27 / §6)", () => {
  it("rejects a legacy .doc with export guidance", async () => {
    await expect(extractText(enc("anything"), "old.doc")).rejects.toBeInstanceOf(UnsupportedFormatError);
    await expect(extractText(enc("anything"), "old.doc")).rejects.toThrow(/export it as PDF, DOCX, or TXT/i);
  });
  it("rejects .pages and unknown types", async () => {
    await expect(extractText(enc("x"), "deck.pages")).rejects.toBeInstanceOf(UnsupportedFormatError);
    await expect(extractText(enc("x"), "weird.xyz")).rejects.toBeInstanceOf(UnsupportedFormatError);
  });
  it("throws EmptyExtractionError rather than silently returning '' (e.g. an empty/scanned doc)", async () => {
    await expect(extractText(enc("   \n  "), "blank.txt")).rejects.toBeInstanceOf(EmptyExtractionError);
    const emptyDocx = await zip({ "word/document.xml": "<w:document><w:body></w:body></w:document>" });
    await expect(extractText(emptyDocx, "blank.docx")).rejects.toBeInstanceOf(EmptyExtractionError);
  });
});

describe("extractText — remediation gates", () => {
  it("F2: does NOT double-decode escaped entities ('&amp;lt;' stays '&lt;', not '<')", async () => {
    const { text } = await extractText(enc("<p>Show A &amp;lt; B literally</p>"), "a.html");
    expect(text).toContain("A &lt; B");
    expect(text).not.toContain("A < B");
  });

  it("F5: the extraction cap matches the 100k editor/save field cap (never fills a doc the Save rejects)", async () => {
    // If someone raises MAX_EXTRACTED_CHARS above the corpus/product route's max(100000), a large upload
    // fills the editor with text the Save button disables — the dead-end this gate exists to prevent.
    expect(MAX_EXTRACTED_CHARS).toBeLessThanOrEqual(100_000);
    const huge = "word ".repeat(60_000); // ~300k chars > the cap
    const { text } = await extractText(enc(huge), "big.txt");
    expect(text.length).toBeLessThanOrEqual(100_000);
  });
});
