# C.A.R.E Browser Extension — Troubleshooting

A short, shareable checklist for when the extension "isn't working." Work top to bottom — each step
distinguishes a *different* cause, so the first one that matches is your answer.

---

## 1. Did the C.A.R.E panel appear at all?

The panel does **not** pop up on its own. You open it by **clicking the C.A.R.E icon in your browser's
toolbar** (top-right, near the address bar). If you don't see the icon, click the puzzle-piece / extensions
button and pin C.A.R.E.

- **Nothing happens when you click the icon on a normal web page?** Make sure the extension is enabled
  (`chrome://extensions` → C.A.R.E → toggle on). Reload the page and try again.
- **You clicked it on a special page** (a `chrome://` settings page, the Chrome Web Store, a PDF, or a local
  file)? The panel can't open there — browsers block extensions on those pages. Try it on a normal website
  (your email, a chat tool, any `https://` page).

If the panel opens, go to step 2.

## 2. The panel opened, but a tool shows an error

Click a tool and read the message in the panel.

- **"Your 14-day trial has ended" or "your plan doesn't include the extension"** → this is an access/plan
  message. If you just started, it should open a free trial automatically on your first use — try once more.
  If it persists, your workspace admin needs to enable access for your account.
- **"Please sign in" / it says you're not connected even though you signed in** → the sign-in didn't carry
  through to the extension. Click **Connect** in the panel again and complete sign-in; you should land back on
  the connect page, which hands the session to the extension.
- **"Couldn't reach C.A.R.E. Check your connection."** → the extension can't reach the C.A.R.E servers. First
  check your internet. If your connection is fine, this usually means a **web-address mismatch**: see step 3.

## 3. "Couldn't reach C.A.R.E" but your internet is fine — web-address mismatch

The extension is built to talk to C.A.R.E at **one specific web address**. If you're using the C.A.R.E web app
at a *different* address (for example a preview/staging link, or a company web address that isn't the official
one), the extension will try the official address, not the one you're on, and can't connect.

**What to check with your workspace admin / the person who set up C.A.R.E:**

1. Confirm the **official C.A.R.E web address** for your workspace, and make sure you're signing in and using
   the app at *that* address — not a preview or temporary link.
2. If your team runs C.A.R.E at a custom address, the extension needs to be pointed at it (an advanced setting).
   Ask your admin to configure that, or to give you a version of the extension set up for your address.

## Still stuck?

Tell your workspace admin **exactly which of the above you saw** — "the panel never opened," "trial ended," "it
says I'm not connected after sign-in," or "couldn't reach C.A.R.E." — and, if possible, what web address you
were using. Each of those points to a different fix, so naming the exact symptom gets you unstuck fastest.
