import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A41 / §1.5.3 drift-guard (2026-08-14 recovery outage).
 *
 * Every auth email-redirect — `resetPasswordForEmail(..., { redirectTo })` and `signUp(..., { options:
 * { emailRedirectTo } })` — must target the ONE canonical app origin via the shared helpers
 * (`canonicalRecoverUrl()` / `signupConfirmRedirectUrl()`), NEVER `window.location.origin`. The outage was a
 * reset link built from the browser origin: a request started on a preview/marketing domain produced a
 * `redirectTo` Supabase could not allow-list, so it silently fell back to the Site URL (the marketing page).
 *
 * This is the A30 "encode the class in a gate" for that fix: a NEW auth-redirect call site that reaches for
 * `window.location.origin` (the code smell A41 names) fails the build instead of shipping a silent regression.
 * The canonical helpers themselves are behaviour-tested in passwordRecovery.test.ts.
 */
function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      tsxFiles(full, acc);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
  return acc;
}

// A redirect target (redirectTo:/emailRedirectTo:) whose value pulls in the browser origin — the drift.
const REDIRECT_FROM_BROWSER_ORIGIN =
  /(redirectTo|emailRedirectTo)\s*:\s*[^,\n}]*window\.location\.origin/;
// The specific recovery-helper-fed-the-browser-origin shape.
const RECOVER_HELPER_BROWSER_ORIGIN = /recoverRedirectUrl\(\s*window\.location\.origin/;

describe("auth email-redirects use the canonical origin, never window.location.origin (A41 / §1.5.3)", () => {
  it("no redirectTo/emailRedirectTo is built from window.location.origin", () => {
    const offenders: string[] = [];
    for (const f of tsxFiles(join(process.cwd(), "src", "app"))) {
      const src = readFileSync(f, "utf8");
      if (REDIRECT_FROM_BROWSER_ORIGIN.test(src) || RECOVER_HELPER_BROWSER_ORIGIN.test(src)) {
        offenders.push(f.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }
    expect(
      offenders,
      "auth email-redirect built from window.location.origin — use canonicalRecoverUrl()/signupConfirmRedirectUrl() " +
        "so there is ONE allow-listed URL that can't drift onto a preview/marketing domain (A41 / §1.5.3):\n  " +
        offenders.join("\n  ")
    ).toEqual([]);
  });
});
