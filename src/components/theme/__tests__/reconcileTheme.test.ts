import { describe, it, expect } from "vitest";
import { reconcileTheme } from "../ThemeProvider";

/**
 * reconcileTheme decides which preference a freshly-loaded device adopts, given
 * the local cache and the DB (per-user override + company default). This is the
 * user -> company -> system resolution the founder specified (2026-07-28).
 */
describe("reconcileTheme", () => {
  it("keeps a device's explicit local choice — never overrides it", () => {
    for (const localRaw of ["light", "dark", "system"] as const) {
      expect(
        reconcileTheme({ localRaw, dbPref: "dark", companyDefault: "light" })
      ).toEqual({ preference: null, shouldCache: false });
    }
  });

  it("with no local choice, a personal DB preference wins AND is cached", () => {
    expect(
      reconcileTheme({ localRaw: null, dbPref: "light", companyDefault: "dark" })
    ).toEqual({ preference: "light", shouldCache: true });
  });

  it("with no local and no personal pref, the company default applies but is NOT cached", () => {
    expect(
      reconcileTheme({ localRaw: null, dbPref: null, companyDefault: "dark" })
    ).toEqual({ preference: "dark", shouldCache: false });
  });

  it("with nothing set anywhere, makes no change", () => {
    expect(
      reconcileTheme({ localRaw: null, dbPref: null, companyDefault: null })
    ).toEqual({ preference: null, shouldCache: false });
  });

  it("treats a garbage local value as 'no local choice' so DB/company can apply", () => {
    expect(
      reconcileTheme({ localRaw: "purple", dbPref: "dark", companyDefault: null })
    ).toEqual({ preference: "dark", shouldCache: true });
  });

  it("ignores an invalid DB preference and falls through to the company default", () => {
    expect(
      reconcileTheme({
        localRaw: null,
        dbPref: "neon" as unknown as null,
        companyDefault: "light",
      })
    ).toEqual({ preference: "light", shouldCache: false });
  });
});
