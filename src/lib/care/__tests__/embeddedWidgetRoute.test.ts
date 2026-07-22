import { describe, it, expect } from "vitest";
import { isEmbeddedWidgetRoute } from "@/lib/care/embeddedWidgetRoute";

/**
 * Regression guard for audit V5 (2026-07-22): ELOSTATE's global chrome (Feedback FAB + Jeff
 * CareChatWidget) leaked onto the customer-facing embedded widget. Both must hide on /widget/* routes.
 */
describe("isEmbeddedWidgetRoute (V5)", () => {
  it("matches the widget iframe routes", () => {
    expect(isEmbeddedWidgetRoute("/widget")).toBe(true);
    expect(isEmbeddedWidgetRoute("/widget/care/abc123")).toBe(true);
  });

  it("does NOT match app routes", () => {
    expect(isEmbeddedWidgetRoute("/")).toBe(false);
    expect(isEmbeddedWidgetRoute("/dashboard/care")).toBe(false);
    expect(isEmbeddedWidgetRoute("/login")).toBe(false);
  });

  it("does NOT over-match a route that merely starts with the string (e.g. /widgets)", () => {
    expect(isEmbeddedWidgetRoute("/widgets")).toBe(false);
    expect(isEmbeddedWidgetRoute("/widget-preview")).toBe(false);
  });

  it("is safe on null/undefined", () => {
    expect(isEmbeddedWidgetRoute(null)).toBe(false);
    expect(isEmbeddedWidgetRoute(undefined)).toBe(false);
  });
});
