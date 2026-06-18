"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import {
  ArrowUpRight,
  Box as BoxIcon,
  Check,
  Circle as CircleIcon,
  Highlighter,
  MousePointer2,
  Trash2,
  Type as TypeIcon,
  Undo2,
  X,
} from "lucide-react";

/**
 * FeedbackScreenshotEditor — opens after the tester captures a screenshot,
 * letting them point at the thing they're reporting before submitting.
 *
 * Tools:
 *   - Arrow      red line with arrowhead
 *   - Text       red rounded label box with white text
 *   - Highlight  semi-transparent yellow fill
 *   - Box        red rectangle outline
 *   - Circle     red ellipse outline
 *
 * On "Done" we draw every annotation into a canvas at the image's natural
 * resolution and hand back a new dataUrl. That keeps the rest of the
 * pipeline unchanged — admins see the annotated image via the same
 * <img src={screenshot_data_url}> path. Each editor session bakes the
 * marks in; reopening starts fresh on top of the already-annotated image.
 *
 * Coordinates are stored in image-natural pixels so they survive any
 * display-size scaling. SVG handles the live preview, canvas handles the
 * final bake.
 */

const RED = "#FACC15";
const YELLOW_FILL = "rgba(250, 204, 21, 0.45)";

type Tool = "select" | "arrow" | "text" | "highlight" | "box" | "circle";

type ArrowAnno = {
  id: string;
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};
type TextAnno = { id: string; kind: "text"; x: number; y: number; text: string };
type RectAnno = {
  id: string;
  kind: "highlight" | "box" | "circle";
  x: number;
  y: number;
  w: number;
  h: number;
};
type Annotation = ArrowAnno | TextAnno | RectAnno;

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

function approxBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  const payload = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.ceil((payload.length * 3) / 4);
}

const TOOLS: ReadonlyArray<{
  key: Tool;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "select", label: "Select", Icon: MousePointer2 },
  { key: "arrow", label: "Arrow", Icon: ArrowUpRight },
  { key: "text", label: "Text", Icon: TypeIcon },
  { key: "highlight", label: "Highlight", Icon: Highlighter },
  { key: "box", label: "Box", Icon: BoxIcon },
  { key: "circle", label: "Circle", Icon: CircleIcon },
];

export function FeedbackScreenshotEditor({
  dataUrl,
  onCancel,
  onDone,
}: {
  dataUrl: string;
  onCancel: () => void;
  onDone: (annotatedDataUrl: string, annotationCount: number, bytes: number) => void;
}) {
  const [tool, setTool] = useState<Tool>("arrow");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [drawing, setDrawing] = useState<Annotation | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Resolve the image's true dimensions so SVG viewBox and canvas bake
  // both work in natural pixel space.
  useEffect(() => {
    let cancelled = false;
    void loadImage(dataUrl).then((img) => {
      if (!cancelled) setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    });
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  // Editor-scoped keyboard shortcuts. Esc cancels, Ctrl/Cmd+Z undoes
  // the last annotation. We check both metaKey (macOS) and ctrlKey
  // (Windows/Linux) so the shortcut feels native on either platform —
  // the user explicitly asked for cross-platform support. While a text
  // annotation is being edited (editingTextId set), we let the
  // textarea own its own key handling and skip both shortcuts.
  // The parent FeedbackPanel skips its own Esc handler while editing
  // (see FeedbackPanel.tsx).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingTextId) return;
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      // Ctrl+Z (Windows/Linux) or Cmd+Z (macOS), no Shift → undo last.
      if (
        e.key.toLowerCase() === "z" &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setAnnotations((prev) => prev.slice(0, -1));
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, editingTextId]);

  const toImageCoords = (clientX: number, clientY: number) => {
    if (!imgRef.current || !naturalSize) return null;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * naturalSize.w;
    const y = ((clientY - rect.top) / rect.height) * naturalSize.h;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (editingTextId) return;
    if (tool === "select") return;
    const p = toImageCoords(e.clientX, e.clientY);
    if (!p) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const id = uid();
    if (tool === "arrow") {
      setDrawing({ id, kind: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    if (tool === "text") {
      // Drop the label immediately and enter inline edit mode. We keep
      // the Text tool active rather than auto-switching to Select so a
      // tester can drop several labels without re-picking the tool.
      const a: TextAnno = { id, kind: "text", x: p.x, y: p.y, text: "" };
      setAnnotations((prev) => [...prev, a]);
      setEditingTextId(id);
      return;
    }
    setDrawing({ id, kind: tool, x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const p = toImageCoords(e.clientX, e.clientY);
    if (!p) return;
    if (drawing.kind === "arrow") {
      setDrawing({ ...drawing, x2: p.x, y2: p.y });
    } else if (drawing.kind !== "text") {
      setDrawing({ ...drawing, w: p.x - drawing.x, h: p.y - drawing.y });
    }
  };

  const onPointerUp = () => {
    if (!drawing) return;
    if (drawing.kind === "arrow") {
      const d = Math.hypot(drawing.x2 - drawing.x1, drawing.y2 - drawing.y1);
      if (d < 6) {
        setDrawing(null);
        return;
      }
      setAnnotations((prev) => [...prev, drawing]);
      setDrawing(null);
      return;
    }
    if (drawing.kind !== "text") {
      if (Math.abs(drawing.w) < 6 || Math.abs(drawing.h) < 6) {
        setDrawing(null);
        return;
      }
      const norm: RectAnno = {
        id: drawing.id,
        kind: drawing.kind,
        x: Math.min(drawing.x, drawing.x + drawing.w),
        y: Math.min(drawing.y, drawing.y + drawing.h),
        w: Math.abs(drawing.w),
        h: Math.abs(drawing.h),
      };
      setAnnotations((prev) => [...prev, norm]);
      setDrawing(null);
      return;
    }
    setDrawing(null);
  };

  const undo = () => setAnnotations((prev) => prev.slice(0, -1));
  const clearAll = () => setAnnotations([]);

  const updateText = (id: string, text: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id && a.kind === "text" ? { ...a, text } : a))
    );
  };

  const removeAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDone = async () => {
    if (saving) return;
    // If a text annotation is mid-edit, commit it first so its text
    // value is in state before bake runs. We also drop any text
    // annotation that ended up empty — submitting a blank red box
    // would just be noise on the chain.
    if (editingTextId) {
      setEditingTextId(null);
      const editing = annotations.find((a) => a.id === editingTextId);
      if (editing && editing.kind === "text" && !editing.text.trim()) {
        setAnnotations((prev) => prev.filter((a) => a.id !== editingTextId));
      }
      // Give React a frame to flush the state updates so `annotations`
      // reflects the just-committed text inside bake().
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
    }
    const finalAnnotations = annotations.filter(
      (a) => a.kind !== "text" || a.text.trim().length > 0
    );
    if (finalAnnotations.length === 0) {
      onDone(dataUrl, 0, approxBytes(dataUrl));
      return;
    }
    setSaving(true);
    try {
      const baked = await bakeWith(finalAnnotations);
      onDone(baked, finalAnnotations.length, approxBytes(baked));
    } finally {
      setSaving(false);
    }
  };

  // bake() runs against the current `annotations` closure. handleDone
  // sometimes needs to bake a filtered copy (empty text removed), so we
  // expose this variant that takes the list explicitly.
  const bakeWith = async (list: Annotation[]): Promise<string> => {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0);
    const strokePx = Math.max(3, Math.round(img.naturalWidth / 600));
    const fontPx = Math.max(16, Math.round(img.naturalWidth / 65));
    for (const a of list) drawAnnotationOnCanvas(ctx, a, strokePx, fontPx);
    // Match the capture pipeline (screenshot.ts) — near-lossless WebP so
    // baking annotations doesn't degrade the originally-sharp screenshot.
    // Falls back to high-quality JPEG only if the browser silently
    // rejects WebP (very rare on modern engines).
    const webp = canvas.toDataURL("image/webp", 0.97);
    if (webp.startsWith("data:image/webp")) return webp;
    return canvas.toDataURL("image/jpeg", 0.95);
  };

  const stroke = naturalSize ? Math.max(3, Math.round(naturalSize.w / 600)) : 3;
  const fontSize = naturalSize ? Math.max(16, Math.round(naturalSize.w / 65)) : 16;
  const visible: Annotation[] = drawing ? [...annotations, drawing] : annotations;

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Annotate screenshot"
      data-feedback-ignore
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-default bg-base">
        <div className="flex flex-wrap items-center gap-1">
          {TOOLS.map((t) => {
            const Icon = t.Icon;
            const active = tool === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTool(t.key)}
                title={t.label}
                aria-pressed={active}
                aria-label={t.label}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  active
                    ? "border-brand bg-[#FACC15]/15 text-brand"
                    : "border-default text-secondary hover:text-primary"
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={annotations.length === 0}
            title="Undo last"
            aria-label="Undo last annotation"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-default text-secondary hover:text-primary disabled:opacity-40"
          >
            <Undo2 className="w-3.5 h-3.5" aria-hidden />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={annotations.length === 0}
            title="Clear all"
            aria-label="Clear all annotations"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-default text-secondary hover:text-primary disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
            <span className="hidden sm:inline">Clear</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            title="Cancel"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-default text-muted hover:text-primary"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            <span className="hidden sm:inline">Cancel</span>
          </button>
          <button
            type="button"
            onClick={handleDone}
            disabled={saving}
            title="Save annotations"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-50 text-[#09090B] font-semibold"
          >
            <Check className="w-3.5 h-3.5" aria-hidden />
            {saving ? "Saving…" : "Done"}
          </button>
        </div>
      </div>

      {/* Canvas surface */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        <div className="relative inline-block max-w-full" style={{ touchAction: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={dataUrl}
            alt="Screenshot to annotate"
            className="block max-w-full h-auto select-none"
            draggable={false}
          />
          {naturalSize && (
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`}
              preserveAspectRatio="none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            >
              <defs>
                <marker
                  id="execos-arrowhead"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth={6}
                  markerHeight={6}
                  orient="auto-start-reverse"
                  markerUnits="strokeWidth"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={RED} />
                </marker>
              </defs>
              {visible.map((a) =>
                renderSvgAnnotation(a, stroke, fontSize, editingTextId)
              )}
            </svg>
          )}

          {/* Inline text editors — HTML overlay positioned in display
              pixels above the SVG so users can actually type into the
              red label box. */}
          {naturalSize &&
            annotations
              .filter((a): a is TextAnno => a.kind === "text" && a.id === editingTextId)
              .map((a) => (
                <TextEditOverlay
                  key={a.id}
                  annotation={a}
                  naturalSize={naturalSize}
                  imgRef={imgRef}
                  fontSize={fontSize}
                  onChange={(text) => updateText(a.id, text)}
                  onCommit={() => {
                    if (!a.text.trim()) removeAnnotation(a.id);
                    setEditingTextId(null);
                  }}
                />
              ))}
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 text-[11px] text-muted text-center border-t border-default bg-base">
        Drag on the image with the active tool. Text drops a red label —
        type into it, press Enter to commit.{" "}
        <kbd className="font-mono text-brand">Ctrl/Cmd+Z</kbd> undoes the
        last mark. Done bakes the marks into the screenshot.
      </div>
    </div>
  );
}

function renderSvgAnnotation(
  a: Annotation,
  stroke: number,
  fontSize: number,
  editingTextId: string | null
): React.ReactNode {
  if (a.kind === "arrow") {
    return (
      <line
        key={a.id}
        x1={a.x1}
        y1={a.y1}
        x2={a.x2}
        y2={a.y2}
        stroke={RED}
        strokeWidth={stroke}
        strokeLinecap="round"
        markerEnd="url(#execos-arrowhead)"
      />
    );
  }
  if (a.kind === "highlight" || a.kind === "box" || a.kind === "circle") {
    const x = a.w >= 0 ? a.x : a.x + a.w;
    const y = a.h >= 0 ? a.y : a.y + a.h;
    const w = Math.abs(a.w);
    const h = Math.abs(a.h);
    if (a.kind === "highlight") {
      return <rect key={a.id} x={x} y={y} width={w} height={h} fill={YELLOW_FILL} />;
    }
    if (a.kind === "box") {
      return (
        <rect
          key={a.id}
          x={x}
          y={y}
          width={w}
          height={h}
          fill="none"
          stroke={RED}
          strokeWidth={stroke}
        />
      );
    }
    return (
      <ellipse
        key={a.id}
        cx={x + w / 2}
        cy={y + h / 2}
        rx={w / 2}
        ry={h / 2}
        fill="none"
        stroke={RED}
        strokeWidth={stroke}
      />
    );
  }
  // Text — skip while it's being edited inline; the HTML overlay shows it instead.
  // The kind check is exhaustive above; this guards TS's union narrowing.
  if (a.kind !== "text") return null;
  if (a.id === editingTextId) return null;
  if (!a.text.trim()) return null;
  const lines = a.text.split("\n");
  const padX = fontSize * 0.7;
  const padY = fontSize * 0.4;
  const lineH = fontSize * 1.25;
  // Approximate text width — 0.6× font size per char is a fair sans-serif average.
  const textW = Math.max(...lines.map((line: string) => line.length * fontSize * 0.6));
  const rectW = textW + padX * 2;
  const rectH = lineH * lines.length + padY * 2;
  return (
    <g key={a.id}>
      <rect
        x={a.x}
        y={a.y}
        width={rectW}
        height={rectH}
        fill={RED}
        rx={fontSize * 0.25}
      />
      <text
        x={a.x + padX}
        y={a.y + padY}
        fill="white"
        fontSize={fontSize}
        fontFamily="sans-serif"
        fontWeight={600}
        dominantBaseline="text-before-edge"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={a.x + padX} dy={i === 0 ? 0 : lineH}>
            {line || " "}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function TextEditOverlay({
  annotation,
  naturalSize,
  imgRef,
  fontSize,
  onChange,
  onCommit,
}: {
  annotation: TextAnno;
  naturalSize: { w: number; h: number };
  imgRef: React.RefObject<HTMLImageElement | null>;
  fontSize: number;
  onChange: (text: string) => void;
  onCommit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Re-render this overlay when the surrounding image resizes (e.g.
  // browser zoom or layout shift) so positioning stays accurate.
  const [, setTick] = useState(0);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  useEffect(() => {
    const onResize = () => setTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const img = imgRef.current;
  if (!img) return null;
  const displayW = img.clientWidth;
  const displayH = img.clientHeight;
  if (displayW === 0 || displayH === 0) return null;
  const scale = displayW / naturalSize.w;
  const left = annotation.x * scale;
  const top = annotation.y * (displayH / naturalSize.h);
  // The textarea font tracks the natural-pixel font size scaled down
  // to display pixels, so the on-screen edit affordance matches the
  // baked label size as closely as possible.
  const fontPx = Math.max(14, fontSize * scale);

  // Tiny floating "confirm" check on the editor — gives testers a
  // deterministic way to commit text (instead of relying on Enter or
  // blur, both of which can race with the Done button click and leave
  // a half-committed annotation).
  return (
    <>
      <textarea
        ref={ref}
        value={annotation.text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onCommit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCommit();
          }
        }}
        rows={1}
        placeholder="Type label, press Enter…"
        className="absolute bg-[#FACC15] text-[#09090B] font-bold rounded-md outline-none resize-none ring-2 ring-white shadow-lg placeholder:text-[#09090B]/60"
        style={{
          left,
          top,
          fontSize: `${fontPx}px`,
          lineHeight: 1.25,
          padding: `${fontPx * 0.4}px ${fontPx * 0.7}px`,
          minWidth: "160px",
          maxWidth: `${Math.max(180, displayW - left - 8)}px`,
        }}
      />
      <button
        type="button"
        onClick={onCommit}
        title="Save label (Enter)"
        aria-label="Save label"
        className="absolute bg-white text-[#FACC15] rounded-full shadow-lg ring-2 ring-white hover:bg-emerald-50 flex items-center justify-center"
        style={{
          left: left - 14,
          top: top - 14,
          width: 28,
          height: 28,
        }}
      >
        <Check className="w-4 h-4" aria-hidden />
      </button>
    </>
  );
}

function drawAnnotationOnCanvas(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  stroke: number,
  fontSize: number
): void {
  if (a.kind === "arrow") {
    ctx.strokeStyle = RED;
    ctx.fillStyle = RED;
    ctx.lineWidth = stroke;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const head = stroke * 4;
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(
      a.x2 - head * Math.cos(angle - Math.PI / 6),
      a.y2 - head * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      a.x2 - head * Math.cos(angle + Math.PI / 6),
      a.y2 - head * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (a.kind === "highlight") {
    ctx.fillStyle = YELLOW_FILL;
    ctx.fillRect(a.x, a.y, a.w, a.h);
    return;
  }
  if (a.kind === "box") {
    ctx.strokeStyle = RED;
    ctx.lineWidth = stroke;
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    return;
  }
  if (a.kind === "circle") {
    ctx.strokeStyle = RED;
    ctx.lineWidth = stroke;
    ctx.beginPath();
    ctx.ellipse(
      a.x + a.w / 2,
      a.y + a.h / 2,
      Math.abs(a.w / 2),
      Math.abs(a.h / 2),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
    return;
  }
  // text — kind check is exhaustive above, this guards TS narrowing.
  if (a.kind !== "text") return;
  if (!a.text.trim()) return;
  // Wrap in save/restore so font, baseline, align, and fill changes do
  // not bleed into subsequent annotations rendered after this one.
  ctx.save();
  try {
    const lines = a.text.split("\n");
    // "bold" is more cross-engine reliable in the font shorthand than
    // a numeric weight like "600", which some Canvas implementations
    // silently reject and fall back to default styling for.
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const padX = fontSize * 0.7;
    const padY = fontSize * 0.4;
    const lineH = fontSize * 1.25;
    const widths = lines.map((line: string) => ctx.measureText(line).width);
    const textW = widths.length ? Math.max(...widths) : 0;
    const rectW = Math.max(fontSize * 4, textW + padX * 2);
    const rectH = lineH * lines.length + padY * 2;
    const radius = fontSize * 0.25;
    ctx.fillStyle = RED;
    drawRoundRect(ctx, a.x, a.y, rectW, rectH, radius);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    lines.forEach((line: string, i: number) => {
      ctx.fillText(line, a.x + padX, a.y + padY + i * lineH);
    });
  } finally {
    ctx.restore();
  }
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
