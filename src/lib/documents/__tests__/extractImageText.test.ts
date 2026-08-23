import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * extractImageText image-bomb guard (audit D2/MED-2, 2026-08-23). The function is GRACEFUL by contract — every
 * failure resolves to "" so the caller stores the note alone — so these tests lock the ONE behavior that must not
 * silently regress: an over-large image is rejected by the sharp header read BEFORE Tesseract decodes it into
 * memory (a synchronous decode the MAX_OCR_MS timeout can't interrupt). We mock both dynamic imports so the test
 * asserts control flow (recognize called or not), never real OCR/WASM.
 */

const metadata = vi.fn();
const recognize = vi.fn(async () => ({ data: { text: "  hello ocr  " } }));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({ metadata })),
}));
vi.mock("tesseract.js", () => ({ recognize }));

import { extractImageText } from "../extractImageText";

beforeEach(() => {
  vi.clearAllMocks();
  metadata.mockResolvedValue({ width: 1200, height: 800 }); // small, legitimate scan
  recognize.mockResolvedValue({ data: { text: "  hello ocr  " } });
});

describe("extractImageText image-bomb guard", () => {
  it("OCRs a normally-sized image (trimmed)", async () => {
    const text = await extractImageText(Buffer.from("img"));
    expect(text).toBe("hello ocr");
    expect(recognize).toHaveBeenCalledTimes(1);
  });

  it("REFUSES an image-bomb before decoding — no Tesseract call, returns '' (note-only)", async () => {
    metadata.mockResolvedValueOnce({ width: 40_000, height: 40_000 }); // 1.6 GP ≫ 40 MP cap
    const text = await extractImageText(Buffer.from("bomb"));
    expect(text).toBe("");
    expect(recognize).not.toHaveBeenCalled();
  });

  it("unreadable header → '' (graceful, note-only) without decoding", async () => {
    metadata.mockRejectedValueOnce(new Error("not an image"));
    const text = await extractImageText(Buffer.from("garbage"));
    expect(text).toBe("");
    expect(recognize).not.toHaveBeenCalled();
  });

  it("OCR throwing still resolves to '' (graceful)", async () => {
    recognize.mockRejectedValueOnce(new Error("ocr boom"));
    const text = await extractImageText(Buffer.from("img"));
    expect(text).toBe("");
  });
});
