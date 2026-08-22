import "server-only";

/**
 * Image OCR for Prep-up (Team-Sync, founder-directed 2026-08-22). TOKEN-FREE and independent of Anthropic —
 * DeepSeek's API rejects images (`400 "does not support image"`), so OCR uses Tesseract.js (a WASM engine: pure
 * local compute, no API call, no tokens). Runs SERVER-SIDE so a low-end phone does zero heavy work and the
 * behaviour is identical on the website + mobile webapp.
 *
 * Isolated + GRACEFUL by contract: any failure (OCR error, timeout, unsupported image) resolves to "" — the
 * caller then stores the facilitator's NOTE alone, and the upload never blocks. So there is never a user-facing
 * complication; OCR text is a bonus on top of the note. tesseract.js is dynamically imported so it never bloats
 * the cold start of routes that don't OCR.
 */

// A pre-meeting upload is not latency-critical, but bound it so a pathological image can't hold the function.
const MAX_OCR_MS = 25_000;
// Cap the stored text so a dense scan can't bloat the prep prompt the AI later reads.
const MAX_OCR_CHARS = 20_000;

export async function extractImageText(bytes: Buffer): Promise<string> {
  try {
    const { recognize } = await import("tesseract.js");
    const result = await Promise.race([
      recognize(bytes, "eng"),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("ocr timeout")), MAX_OCR_MS)),
    ]);
    const text = ((result as { data?: { text?: string } })?.data?.text ?? "").trim();
    return text.slice(0, MAX_OCR_CHARS);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[prep-up ocr] extractImageText failed (storing note only):", e instanceof Error ? e.message : e);
    return "";
  }
}
