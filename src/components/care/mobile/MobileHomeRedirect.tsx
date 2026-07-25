"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Reachability for the mobile radial (A31 — a surface you can't get to doesn't
 * exist). Mounted ONLY on the C.A.R.E home (/dashboard/care), not the whole care
 * layout — so deep links (settings, analytics) are untouched. On a small screen,
 * and unless the user chose "desktop view" this session, it sends them to the
 * radial home. Reversible by design: the escape flag below (set by the radial's
 * "Desktop" control) keeps them on desktop. Founder can flip this to opt-in by
 * removing this mount; the safe default is: phones land on the phone UI.
 */
export const CARE_PREFER_DESKTOP_KEY = "care-prefer-desktop";

export function MobileHomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(CARE_PREFER_DESKTOP_KEY) === "1") return;
    } catch {
      /* sessionStorage unavailable — fall through to the media check */
    }
    if (window.matchMedia("(max-width: 767px)").matches) {
      router.replace("/care/mobile");
    }
  }, [router]);
  return null;
}
