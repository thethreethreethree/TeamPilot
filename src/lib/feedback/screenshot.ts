"use client";

/**
 * Screenshot capture — DOM-rendered via html2canvas, no permission prompt.
 *
 * History: the first version tried `getDisplayMedia()` as the primary
 * path for pixel-accurate capture, with html2canvas as the fallback.
 * The user reported that path was unacceptable: Chrome's
 * `getDisplayMedia` always shows the native "choose what to share"
 * picker (tab / window / entire screen), even with the
 * `preferCurrentTab` hint. The picker reads as "the system is asking
 * me what to share" — exactly the friction that turns a feedback
 * report into a chore. For an in-app feedback tool capturing the
 * user's own current view, the browser permission prompt is the
 * wrong UX entirely.
 *
 * So this module captures only what the DOM can paint. Trade-offs:
 *   + No permission prompt, instant capture, completely silent
 *   + Works in every modern browser without an opt-in
 *   - Cross-origin iframes render blank (we don't paint them anyway
 *     and the feedback button itself is marked `data-feedback-ignore`
 *     so it doesn't appear in the capture)
 *   - Some complex CSS (gradient masks, advanced filters, shadow DOM)
 *     may render imperfectly — acceptable for a feedback diagnostic
 *
 * Output: a downscaled JPEG data URL ≤ ~200 KB so we can stash it
 * inline in the feedback payload's jsonb column without exhausting the
 * row-size budget. A future migration could route this to Supabase
 * Storage for full-resolution captures; for now inline base64 keeps
 * the data co-located with its feedback row.
 */

const MAX_WIDTH = 1600;
const TARGET_QUALITY = 0.7;

type CaptureResult = {
  dataUrl: string;
  method: "html2canvas";
  width: number;
  height: number;
  /** Approximate base64 byte size — useful for the payload-size guard. */
  bytes: number;
};

function downscaleCanvas(
  source: HTMLCanvasElement,
  maxWidth: number
): HTMLCanvasElement {
  if (source.width <= maxWidth) return source;
  const ratio = maxWidth / source.width;
  const out = document.createElement("canvas");
  out.width = maxWidth;
  out.height = Math.round(source.height * ratio);
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function canvasToResult(canvas: HTMLCanvasElement): CaptureResult {
  const downscaled = downscaleCanvas(canvas, MAX_WIDTH);
  const dataUrl = downscaled.toDataURL("image/jpeg", TARGET_QUALITY);
  // Rough byte estimate: base64 inflates by 4/3.
  const base64Len = dataUrl.split(",")[1]?.length ?? 0;
  const bytes = Math.floor((base64Len * 3) / 4);
  return {
    dataUrl,
    method: "html2canvas",
    width: downscaled.width,
    height: downscaled.height,
    bytes,
  };
}

/**
 * Capture a screenshot of the current page silently.
 *
 * No permission prompt, no picker. Returns null only if the DOM
 * cannot be rendered (SSR context, or html2canvas threw on a page
 * with cross-origin content it couldn't paint).
 */
export async function captureScreenshot(): Promise<CaptureResult | null> {
  if (typeof document === "undefined") return null;
  try {
    // Dynamic import keeps html2canvas out of the main bundle until
    // someone actually triggers a feedback screenshot.
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      // Capture at devicePixelRatio for sharpness on retina screens;
      // downscaleCanvas later trims to MAX_WIDTH for size.
      scale: Math.min(window.devicePixelRatio || 1, 2),
      // Skip nodes we explicitly opt out (the feedback button itself,
      // the slide-out panel, the annotation editor — anything marked
      // with data-feedback-ignore so the capture looks like what the
      // user sees, not what the feedback UI overlaid).
      ignoreElements: (el) => el.hasAttribute("data-feedback-ignore"),
    });
    return canvasToResult(canvas);
  } catch {
    return null;
  }
}
