import { describe, it, expect } from "vitest";
import { extractAndResolveVa, VA_SUPPORTED_EXTENSIONS } from "../vaImport";
import { UnsupportedFormatError } from "@/lib/documents/extractText";

/**
 * vaImport format dispatch (allowlist, A33). The .docx/.pdf branches call the real extractors (IO, verified
 * against the founder's real files out-of-band); here we lock the pure branch the route tests mock past:
 * an unsupported extension is rejected with a typed UnsupportedFormatError before any parsing.
 */
describe("extractAndResolveVa — format allowlist", () => {
  it("rejects an unsupported extension with UnsupportedFormatError", async () => {
    await expect(
      extractAndResolveVa(new Uint8Array([1, 2, 3]), "roster.xls", { weekStart: "2026-08-17" }),
    ).rejects.toBeInstanceOf(UnsupportedFormatError);
  });
  it("rejects a file with no extension", async () => {
    await expect(
      extractAndResolveVa(new Uint8Array([1]), "noext", { weekStart: "2026-08-17" }),
    ).rejects.toBeInstanceOf(UnsupportedFormatError);
  });
  it("the supported set is exactly docx + pdf", () => {
    expect([...VA_SUPPORTED_EXTENSIONS]).toEqual(["docx", "pdf"]);
  });
});
