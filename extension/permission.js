// permission.js — runs on the extension's OWN permission.html page.
//
// This is the one place chrome.permissions.request works for the image-capture flow: it needs a user
// gesture, and (MV3) that gesture does NOT survive a content-script -> service-worker sendMessage hop, so
// the request can't be made from the injected panel or the worker. An extension page's own button click
// keeps the gesture, so we grant it here. We request the <all_urls> OPTIONAL host permission (declared in
// manifest.optional_host_permissions) so the worker can later fetch third-party image bytes cross-origin.

const btn = document.getElementById("grant");
const status = document.getElementById("status");

function show(msg, cls) {
  status.textContent = msg;
  status.className = cls || "";
}

// If it's already granted (user came back, or granted before), say so up front.
chrome.permissions.contains({ origins: ["*://*/*"] }).then((has) => {
  if (has) {
    btn.textContent = "Image capture is enabled";
    btn.disabled = true;
    show("Already enabled — you can close this tab and capture.", "ok");
  }
});

btn.addEventListener("click", () => {
  // Direct call inside the click handler — the gesture is intact here.
  chrome.permissions.request({ origins: ["*://*/*"] }).then((granted) => {
    if (granted) {
      btn.textContent = "Image capture is enabled";
      btn.disabled = true;
      show("Enabled. Close this tab and re-run your capture — images will now save.", "ok");
    } else {
      show("Not enabled. Images will still save as filenames only; you can allow it any time.", "no");
    }
  }).catch(() => {
    show("Couldn't complete the request. Try again, or reload this page.", "no");
  });
});
