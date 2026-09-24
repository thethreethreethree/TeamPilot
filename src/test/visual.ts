import fs from "node:fs";
import path from "node:path";

/**
 * Hand a rendered subtree to the screenshot pass.
 *
 * Capture files (`*.capture.tsx`) render a real component with Testing Library, exactly as a
 * render test does, and call this with the element they want photographed. `scripts/visual/shoot.mjs`
 * wraps the HTML in the project's compiled Tailwind bundle and screenshots it in both themes.
 *
 * WHY THE WIDTH IS REQUIRED AND NOT DEFAULTED.
 *
 * The first capture I ever took of a mobile surface showed a button clipped off the right edge. It
 * was not clipped. I had lifted the `md:hidden` subtree out of its parent flex chain, so nothing
 * constrained its width, and a perfectly fine layout rendered as a defect. A harness whose failure
 * mode is INVENTING layout bugs is worse than no harness — it produces a page of findings that
 * are not real and teaches everyone to distrust the ones that are.
 *
 * So `width` is mandatory: the author has to say what viewport this surface is being judged at,
 * and the shooter builds a container of exactly that width for it to lay out inside.
 *
 * NOTHING HERE FAILS. There are no baselines and no comparison. It writes files for a human to
 * look at, which is the only check that catches "the header is below the list" or "this is
 * invisible on white".
 */
export function capture(
  name: string,
  el: HTMLElement | null,
  opts: { width: number; height?: number }
): void {
  const out = process.env.VISUAL_OUT;
  // Not running under the visual pass — the capture file is being executed by something else (a
  // stray vitest run, an editor). Do nothing rather than scatter JSON through the repo.
  if (!out) return;

  if (!el) {
    throw new Error(
      `capture("${name}") got no element. A capture that silently photographs nothing is the ` +
        `confident-zero shape: an empty PNG read as "this surface is fine".`
    );
  }

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, `${name}.json`),
    JSON.stringify({
      name,
      html: el.outerHTML,
      width: opts.width,
      // Tall enough to show the whole surface; the shooter crops nothing, so a short height hides
      // the bottom of a page without saying it did.
      height: opts.height ?? 900,
    }),
    "utf8"
  );
}

/**
 * jsdom ships neither, and several surfaces probe both on mount — a PWA banner reads `matchMedia`,
 * the theme provider reads it and `fetch`. Unmocked, `matchMedia` throws and takes the render down.
 *
 * `light: false` resolves the provider to dark. Both themes get screenshotted regardless, because
 * the shooter re-themes the same DOM via `data-theme` — so what this controls is which ICON STATE
 * a theme-aware control renders, not which background it is photographed on. Worth knowing before
 * reading a light-mode capture as proof of a light-mode control.
 */
export function stubBrowserApis(opts: { light?: boolean } = {}): void {
  // jsdom implements neither `Element.prototype.scrollTo` nor `scrollIntoView`. Any surface that
  // keeps a list pinned to the bottom — a chat, a log, a transcript — calls one of them in a mount
  // effect, and the missing method throws THROUGH React's commit phase and takes the whole render
  // down. That reads exactly like a product crash and is not one: the methods exist in every real
  // browser. Stubbing them here keeps that class of phantom out of the capture pass.
  const proto = globalThis.Element?.prototype as
    | (Element & { scrollTo?: unknown; scrollIntoView?: unknown })
    | undefined;
  if (proto) {
    if (typeof proto.scrollTo !== "function") proto.scrollTo = () => {};
    if (typeof proto.scrollIntoView !== "function") proto.scrollIntoView = () => {};
  }

  // ANSWERED PER QUERY, not one boolean for all of them.
  //
  // A count-up, a sliding odometer, a growing arc — each renders its FINAL value immediately when
  // the user asks for reduced motion, and its frame-zero value otherwise. jsdom never advances
  // rAF, so a blanket `false` here photographs frame zero forever: the Progress gauge was shot
  // with the arc at 74% and the number reading 0, and before the clamp landed in RepArena it read
  // -6750. Asking for reduced motion is not a trick — it is a real, supported code path, and it is
  // the one that settles.
  const light = opts.light ?? false;
  globalThis.matchMedia = ((q?: string): MediaQueryList =>
    ({
      matches: /prefers-reduced-motion/.test(q ?? "") ? true : light,
      media: q ?? "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof globalThis.matchMedia;
}
