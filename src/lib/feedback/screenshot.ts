"use client";

/**
 * Screenshot capture — getDisplayMedia primary, html2canvas fallback.
 *
 * Per the user's stated preference (accuracy > friction), this module
 * tries the high-accuracy native screen-capture path first and falls
 * back silently to a DOM render if:
 *   - the browser doesn't support getDisplayMedia (older Safari, all
 *     mobile browsers)
 *   - the user declines the permission prompt
 *   - getDisplayMedia throws for any reason mid-capture
 *
 * The fallback ensures every feedback report has some screenshot
 * rather than none — a partial screenshot is better diagnostic data
 * than no screenshot. The output format is a downscaled JPEG data
 * URL kept under ~200KB so we can stash it inline in the feedback
 * payload's jsonb column without exhausting database row size.
 *
 * A future migration could move this to Supabase Storage for the
 * full-resolution path; for now inline base64 keeps the integration
 * shape simple and the data co-located with the feedback row.
 */

const MAX_WIDTH = 1600;
const TARGET_QUALITY = 0.7;

type CaptureResult = {
  dataUrl: string;
  method: "getDisplayMedia" | "html2canvas";
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

function canvasToResult(
  canvas: HTMLCanvasElement,
  method: CaptureResult["method"]
): CaptureResult {
  const downscaled = downscaleCanvas(canvas, MAX_WIDTH);
  const dataUrl = downscaled.toDataURL("image/jpeg", TARGET_QUALITY);
  // Rough byte estimate: base64 inflates by 4/3.
  const base64Len = dataUrl.split(",")[1]?.length ?? 0;
  const bytes = Math.floor((base64Len * 3) / 4);
  return {
    dataUrl,
    method,
    width: downscaled.width,
    height: downscaled.height,
    bytes,
  };
}

async function captureViaGetDisplayMedia(): Promise<CaptureResult | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return null;
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
  };
  if (!md.getDisplayMedia) return null;

  let stream: MediaStream | null = null;
  try {
    // `preferCurrentTab: true` hints Chromium-based browsers to default
    // the screen-share picker to the current tab — reduces the picker
    // friction for the common case.
    stream = await md.getDisplayMedia({
      video: {
        // @ts-expect-error preferCurrentTab is a Chromium-only hint
        preferCurrentTab: true,
      },
      audio: false,
    });
    const track = stream.getVideoTracks()[0];
    if (!track) return null;

    // Grab a single frame. ImageCapture is the cleanest path, but
    // not all browsers expose it from a display stream; fall back to
    // drawing the live video element onto a canvas.
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // One frame is enough — let the video tick once.
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.pause();
    video.srcObject = null;
    return canvasToResult(canvas, "getDisplayMedia");
  } catch {
    // User declined OR browser threw. Caller falls back to html2canvas.
    return null;
  } finally {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  }
}

async function captureViaHtml2Canvas(): Promise<CaptureResult | null> {
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
      // Skip nodes that obviously can't be rendered (third-party
      // iframes, etc.).
      ignoreElements: (el) => el.hasAttribute("data-feedback-ignore"),
    });
    return canvasToResult(canvas, "html2canvas");
  } catch {
    return null;
  }
}

/**
 * Public capture entry point. Tries getDisplayMedia first; falls back
 * to html2canvas on failure (incl. user decline). Returns null only
 * if BOTH paths fail (e.g. SSR context, or html2canvas threw on a
 * page with cross-origin content it couldn't paint).
 */
export async function captureScreenshot(): Promise<CaptureResult | null> {
  const primary = await captureViaGetDisplayMedia();
  if (primary) return primary;
  return await captureViaHtml2Canvas();
}
