/*!
 * C.A.R.E — Customer Assistance and Response Engine
 * Embeddable widget loader.
 *
 * Usage:
 *   <script src="https://elostate.com/care-widget.js"
 *           data-token="YOUR_EMBED_TOKEN"></script>
 *
 * What this script does:
 *   1. Reads the embed token from its own script tag's data-token
 *      attribute.
 *   2. Inserts a fixed-position iframe pointing at
 *      https://elostate.com/widget/care/<token>
 *   3. Listens for postMessage from the iframe to resize itself
 *      between the bubble state (60x60) and the expanded panel
 *      state (~400x600).
 *
 * No third-party dependencies. Lightweight (no React, no
 * frameworks). Works on any site that can run a <script> tag.
 *
 * Origin enforcement: the iframe page resolves the embed token
 * server-side and verifies the parent origin against the
 * tenant's allowed_origins list. If the origin doesn't match,
 * the iframe renders an error and conversations can't be opened.
 */
(function () {
  "use strict";

  // Idempotent: if someone drops the script twice, the second
  // invocation is a no-op.
  if (window.__careWidgetLoaded) return;
  window.__careWidgetLoaded = true;

  // Find the script tag that loaded us. We use document.currentScript
  // when available; fall back to looking for the last script with
  // our src as the user agent might have processed and discarded
  // currentScript by the time this IIFE runs.
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("care-widget.js") >= 0) {
        script = scripts[i];
        break;
      }
    }
  }
  if (!script) {
    console.warn("[C.A.R.E] widget loader couldn't find its own script tag");
    return;
  }

  var token = script.getAttribute("data-token");
  if (!token) {
    console.warn("[C.A.R.E] widget loader: data-token attribute is required");
    return;
  }

  // Derive the host from the script src so the widget always
  // points at the same domain that served it. This is what makes
  // self-hosted variants work — flip the script URL, get the
  // iframe URL changed automatically.
  var srcUrl;
  try {
    srcUrl = new URL(script.src);
  } catch (e) {
    console.warn("[C.A.R.E] widget loader: couldn't parse its own src URL");
    return;
  }
  var widgetOrigin = srcUrl.protocol + "//" + srcUrl.host;
  var widgetUrl =
    widgetOrigin + "/widget/care/" + encodeURIComponent(token);

  // Create the iframe. Start small (just the bubble); grow on
  // postMessage when the user opens the panel.
  var iframe = document.createElement("iframe");
  iframe.src = widgetUrl;
  iframe.title = "Customer support";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("aria-label", "Customer support widget");
  iframe.setAttribute("data-care-widget", "1");
  iframe.style.cssText = [
    "position: fixed",
    "z-index: 2147483647",
    "bottom: 0",
    "right: 0",
    "width: 88px",
    "height: 88px",
    "border: 0",
    "background: transparent",
    "color-scheme: normal",
  ].join(";");
  // Allow scripts + same-origin so our React widget runs.
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups allow-forms"
  );

  // Insert after page load so we don't fight document.write or
  // partial DOM states.
  function insert() {
    if (document.body) {
      document.body.appendChild(iframe);
    } else {
      window.addEventListener("DOMContentLoaded", insert);
    }
  }
  insert();

  // Listen for resize messages from the iframe.
  window.addEventListener("message", function (event) {
    // Only accept messages from our widget origin.
    if (event.origin !== widgetOrigin) return;
    var data = event.data;
    if (!data || data.type !== "care:widget:size") return;
    if (data.open) {
      // Expanded panel — roughly 400x620, capped to viewport.
      iframe.style.width = "min(420px, 100vw)";
      iframe.style.height = "min(640px, 100vh)";
    } else {
      // Collapsed bubble.
      iframe.style.width = "88px";
      iframe.style.height = "88px";
    }
  });
})();
