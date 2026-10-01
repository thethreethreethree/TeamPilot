// @vitest-environment jsdom
import { describe, it } from "vitest";
import { render } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";
import { MacroModeToggle } from "@/components/sales-coach/doorlog/MacroModeToggle";

/**
 * The desktop Macro Mode card with its door-surface links.
 *
 * Captured because the links changed on 2026-10-01: Pitch Performance left (founder, matching the app,
 * which dropped it as a tab), so the row went from three tiles to two. Whether two tiles read as a
 * deliberate pair or as a row with a gap is something only a picture answers.
 */
describe("capture", () => {
  it("macro toggle with desktop links", () => {
    stubBrowserApis();
    const { container } = render(<MacroModeToggle enabled saving={false} onToggle={() => {}} showLinks />);
    capture("macro-toggle-links", container.firstElementChild as HTMLElement, { width: 420, height: 260 });
  });
});
