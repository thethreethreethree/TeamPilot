import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPwaPlatform, isPwaInstalled } from "../platform";

/**
 * PWA platform detection tests.
 *
 * The load-bearing case is the audit-F2 fix: "ios-safari" must fire ONLY for
 * real Safari on iOS, because the Share -> Add to Home Screen flow is
 * Safari-specific. iOS Chrome/Firefox/Edge (CriOS/FxiOS/EdgiOS) must route to
 * "chrome" — mis-routing them to the Safari-only steps would show instructions
 * that don't work. These tests pin that so the exclusion can't regress.
 */
function stubWindow(ua: string, extra: Record<string, unknown> = {}) {
  vi.stubGlobal("window", {
    navigator: { userAgent: ua },
    matchMedia: () => ({ matches: false }),
    ...extra,
  });
}

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ipadSafari:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/604.1",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectPwaPlatform", () => {
  it("returns ios-safari only for real Safari on iOS", () => {
    stubWindow(UA.iphoneSafari);
    expect(detectPwaPlatform()).toBe("ios-safari");
    stubWindow(UA.ipadSafari);
    expect(detectPwaPlatform()).toBe("ios-safari");
  });

  it("routes iOS Chrome / Firefox to chrome, NOT ios-safari (audit F2)", () => {
    stubWindow(UA.iphoneChrome);
    expect(detectPwaPlatform()).toBe("chrome");
    stubWindow(UA.iphoneFirefox);
    expect(detectPwaPlatform()).toBe("chrome");
  });

  it("returns chrome for desktop Chrome (has 'Safari' in UA but not iOS)", () => {
    stubWindow(UA.desktopChrome);
    expect(detectPwaPlatform()).toBe("chrome");
  });

  it("returns other when there is no window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(detectPwaPlatform()).toBe("other");
  });
});

describe("isPwaInstalled", () => {
  it("is true in standalone display mode", () => {
    stubWindow(UA.iphoneSafari, {
      matchMedia: (q: string) => ({ matches: q.includes("standalone") }),
    });
    expect(isPwaInstalled()).toBe(true);
  });

  it("is true via Safari's non-standard navigator.standalone flag", () => {
    vi.stubGlobal("window", {
      navigator: { userAgent: UA.iphoneSafari, standalone: true },
      matchMedia: () => ({ matches: false }),
    });
    expect(isPwaInstalled()).toBe(true);
  });

  it("is false in a normal browser tab", () => {
    stubWindow(UA.desktopChrome);
    expect(isPwaInstalled()).toBe(false);
  });
});
