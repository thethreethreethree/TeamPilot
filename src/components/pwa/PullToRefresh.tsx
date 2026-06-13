"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";

/**
 * PullToRefresh — window-level pull-down-to-refresh for PWA surfaces.
 *
 * Listens to touch events at the window level. When the user is at
 * the top of the page (scrollY === 0) and pulls down past the
 * threshold, calls `onRefresh()`. Standard native pattern.
 *
 * Why window-level not container-level:
 *   - Most page layouts let the BODY scroll, not a fixed-height
 *     container. Wrapping the page in a scroll container would fight
 *     the existing layout (sticky TopBar, etc.)
 *   - Window-level pull matches the native iOS / Android pull gesture
 *     position, not a sub-scrolling div
 *
 * Activation:
 *   - Only active in PWA standalone context. Browser tabs ignore the
 *     gesture so we don't fight Chrome's built-in pull-to-refresh
 *     which would reload the whole page.
 *   - Only triggers when scrollY === 0. Mid-page pulls are just
 *     scroll inertia.
 *
 * The component renders ONLY the visual indicator (the spinner at
 * the top of the viewport). It does not wrap children — page layout
 * stays untouched. Drop it anywhere in the page; it self-positions.
 */

const PULL_THRESHOLD = 80;
const MAX_PULL = 140;

export function PullToRefresh({
  onRefresh,
  /** Optional override — pass false to disable. */
  enabled = true,
}: {
  onRefresh: () => Promise<void> | void;
  enabled?: boolean;
}) {
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

  const active = enabled && isStandalone;

  useEffect(() => {
    if (!active) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      if (refreshing) return;
      const currentY = e.touches[0]?.clientY ?? null;
      if (currentY === null) return;
      const delta = currentY - startY.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // Damp the pull: each pixel of finger movement contributes
      // proportionally less. Rubber-band effect.
      const damped = Math.min(MAX_PULL, Math.sqrt(delta) * 12);
      pullRef.current = damped;
      setPull(damped);
    };

    const handleTouchEnd = async () => {
      if (startY.current === null) return;
      const finalPull = pullRef.current;
      startY.current = null;
      if (finalPull >= PULL_THRESHOLD) {
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        try {
          await onRefresh();
        } catch {
          // Swallow — spinner clears regardless so the user never
          // gets stuck.
        } finally {
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        }
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [active, refreshing, onRefresh]);

  if (!active) return null;

  // Spinner rotates with pull distance (standard pattern). Refreshing
  // state shows the CSS spin animation.
  const spinnerRotation = (pull / PULL_THRESHOLD) * 360;
  const spinnerOpacity = Math.min(1, pull / 40);

  return (
    <div
      aria-hidden
      className="fixed left-0 right-0 top-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.max(0, pull - 32)}px)`,
        opacity: spinnerOpacity,
        transition: pull === 0 ? "transform 200ms ease-out, opacity 200ms" : undefined,
      }}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-surface border border-default shadow-sm mt-2">
        <RotateCw
          className="w-4 h-4 text-brand"
          style={{
            transform: refreshing ? undefined : `rotate(${spinnerRotation}deg)`,
            animation: refreshing ? "spin 1s linear infinite" : undefined,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
