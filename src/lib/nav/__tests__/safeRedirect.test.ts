import { describe, it, expect } from "vitest";
import { safeRelativePath } from "@/lib/nav/safeRedirect";

describe("safeRelativePath — open-redirect guard for post-auth ?next=", () => {
  it("allows same-origin relative paths (incl. query)", () => {
    expect(safeRelativePath("/extension/connect")).toBe("/extension/connect");
    expect(safeRelativePath("/dashboard")).toBe("/dashboard");
    expect(safeRelativePath("/dashboard/care?tab=x")).toBe("/dashboard/care?tab=x");
    expect(safeRelativePath("/")).toBe("/");
  });

  it("REJECTS protocol-relative and scheme'd targets (the open-redirect vectors)", () => {
    expect(safeRelativePath("//evil.com")).toBeNull(); // protocol-relative
    expect(safeRelativePath("/\\evil.com")).toBeNull(); // backslash → protocol-relative in browsers
    expect(safeRelativePath("https://evil.com")).toBeNull();
    expect(safeRelativePath("http://evil.com")).toBeNull();
    expect(safeRelativePath("javascript:alert(1)")).toBeNull();
  });

  it("REJECTS non-rooted and empty/garbage", () => {
    expect(safeRelativePath("dashboard")).toBeNull(); // no leading slash
    expect(safeRelativePath("")).toBeNull();
    expect(safeRelativePath(null)).toBeNull();
    expect(safeRelativePath(undefined)).toBeNull();
  });
});
