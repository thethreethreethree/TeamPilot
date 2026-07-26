"use client";

import { useEffect } from "react";

/**
 * GLOBAL error boundary — the ONLY thing that catches an error thrown by the ROOT LAYOUT itself
 * (src/app/layout.tsx). The segment error.tsx boundaries render INSIDE the root layout, so they cannot
 * catch a failure of the layout that hosts them; without this file, a root-layout throw falls through to
 * Next.js's unbranded default screen.
 *
 * This component REPLACES the whole document, so it must render its own <html>/<body>. It uses INLINE
 * styles on purpose: the layout that loads globals.css (Tailwind) is exactly what failed here, so utility
 * classes (bg-base, text-primary, …) may be unstyled. Inline styles guarantee a legible, on-brand fallback
 * even when no stylesheet loaded. Kept minimal + dependency-light for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[Global error boundary — root layout failed]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#09090B",
          color: "#FAFAFA",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "32rem", width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "-0.01em", marginBottom: "28px" }}>
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "2px",
                background: "#FB923C",
                marginRight: "8px",
                verticalAlign: "middle",
              }}
              aria-hidden="true"
            />
            ELOSTATE
          </div>

          <p
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "#FCA5A5",
              marginBottom: "12px",
              fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
            }}
          >
            something broke
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.2, margin: "0 0 12px" }}>
            The app hit an error.
          </h1>
          <p style={{ fontSize: "14px", color: "#A1A1AA", lineHeight: 1.6, margin: "0 0 24px" }}>
            Something failed while loading the app shell. Try again, or reload the page.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: "10px",
                color: "#71717A",
                margin: "0 0 24px",
                fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
              }}
            >
              digest: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                background: "#FB923C",
                color: "#09090B",
                fontWeight: 600,
                fontSize: "12px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "transparent",
                color: "#A1A1AA",
                fontWeight: 500,
                fontSize: "12px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid #3F3F46",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
