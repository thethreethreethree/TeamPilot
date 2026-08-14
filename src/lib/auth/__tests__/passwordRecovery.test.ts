import { describe, expect, it, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  RECOVER_PATH,
  RECOVERY_REQUESTED_MESSAGE,
  looksLikeEmail,
  recoverRedirectUrl,
  canonicalRecoverUrl,
  signupConfirmRedirectUrl,
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

describe("canonical auth-redirect URLs pin to siteUrl(), never the browser origin (2026-08-14 drift guard)", () => {
  // The marketing-page incident: reset links used window.location.origin, so a request from a preview/marketing
  // domain produced a redirectTo Supabase couldn't allow-list → it fell back to the Site URL. These helpers take
  // NO origin argument, so the target is always the ONE configured app origin — a drifting origin cannot leak in.
  const OLD = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    if (OLD === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = OLD;
  });

  it("canonicalRecoverUrl = configured site origin + /auth/recover", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://elostate.com";
    expect(canonicalRecoverUrl()).toBe("https://elostate.com/auth/recover");
  });

  it("signupConfirmRedirectUrl = configured site origin + /login", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://elostate.com";
    expect(signupConfirmRedirectUrl()).toBe("https://elostate.com/login");
  });

  it("a trailing slash on the configured origin never doubles the path", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://elostate.com/";
    expect(canonicalRecoverUrl()).toBe("https://elostate.com/auth/recover");
    expect(signupConfirmRedirectUrl()).toBe("https://elostate.com/login");
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
