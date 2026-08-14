import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  RECOVER_PATH,
  RECOVERY_REQUESTED_MESSAGE,
  looksLikeEmail,
  recoverRedirectUrl,
} from "../passwordRecovery";

describe("recoverRedirectUrl", () => {
  it("appends the recover path to the origin", () => {
    expect(recoverRedirectUrl("https://elostate.com")).toBe("https://elostate.com/auth/recover");
  });

  it("strips trailing slashes so the URL never doubles up", () => {
    expect(recoverRedirectUrl("https://elostate.com/")).toBe("https://elostate.com/auth/recover");
    expect(recoverRedirectUrl("http://localhost:3000//")).toBe("http://localhost:3000/auth/recover");
  });
});

describe("RECOVER_PATH resolves to a real page (structural drift-guard)", () => {
  // The entire recovery flow is dead if the request page redirects to a completion page that no longer exists.
  // This binds the two together: rename or delete src/app/auth/recover/page.tsx and this test goes red.
  it("has a page.tsx on disk at RECOVER_PATH", () => {
    const page = join(process.cwd(), "src/app", RECOVER_PATH, "page.tsx");
    expect(existsSync(page)).toBe(true);
  });
});

describe("looksLikeEmail", () => {
  it("accepts a normal address", () => {
    expect(looksLikeEmail("a@b.co")).toBe(true);
    expect(looksLikeEmail("  someone@example.com  ")).toBe(true);
  });

  it("rejects blanks and malformed input", () => {
    for (const bad of ["", "   ", "nope", "a@b", "a b@c.co", "@b.co", "a@b."]) {
      expect(looksLikeEmail(bad)).toBe(false);
    }
  });
});

describe("RECOVERY_REQUESTED_MESSAGE is anti-enumeration", () => {
  it("does not affirm the account exists", () => {
    // The neutral phrasing is the guard: never confirm/deny existence in the reset confirmation.
    expect(RECOVERY_REQUESTED_MESSAGE.toLowerCase()).toContain("if an account exists");
  });
});
