# Chrome Web Store Publishing Guide

Instructions for preparing and publishing a Chrome extension to the Chrome Web Store. Use this as context when asking Claude Code to help prepare, validate, or package an extension for submission.

## Prerequisites

- Extension must use **Manifest V3** (`"manifest_version": 3` in `manifest.json`)
- A Google account for the Chrome Web Store Developer Dashboard
- One-time $5 developer registration fee (covers up to 20 extensions)

## 1. Prepare the Extension Package

The `manifest.json` must include at minimum:

```json
{
  "manifest_version": 3,
  "name": "Extension Name",
  "version": "1.0.0",
  "description": "Short description under 132 characters.",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

Requirements:

- **Icons**: 16x16, 48x48, and 128x128 PNG files. The 128x128 is mandatory for the store listing.
- **Version**: Use semantic versioning. Every new upload must have a higher version number than the last.
- **Description**: Keep it under 132 characters — this shows in search results.
- **Permissions**: Request only what the extension actually uses. Broad permissions (e.g. `<all_urls>`, `tabs`, `history`) trigger longer reviews and more rejections.
- Prefer `activeTab` over host permissions where possible.
- Use `optional_permissions` for features the user can opt into later.

### Packaging

Zip the extension folder contents (manifest at the zip root, not nested inside a folder):

```bash
# From inside the extension directory
zip -r ../extension.zip . -x ".*" -x "__MACOSX" -x "node_modules/*" -x "*.map"
```

Exclude from the zip:

- `node_modules/`, source maps, build configs, `.git`, README files
- Any unused files — reviewers flag dead code

### Pre-submission validation checklist

- [ ] `manifest.json` parses as valid JSON
- [ ] `manifest_version` is 3
- [ ] All icon files referenced in the manifest exist at the declared paths
- [ ] No remote code execution (no loading JS from external URLs — bundle everything)
- [ ] No `eval()` or `new Function()` (blocked by MV3 CSP)
- [ ] Content Security Policy is MV3-compliant if customized
- [ ] Extension loads without errors via `chrome://extensions` → "Load unpacked"
- [ ] Every declared permission is actually used in the code
- [ ] Version number is bumped (for updates)

## 2. Register a Developer Account

1. Go to https://chrome.google.com/webstore/devconsole
2. Sign in with a Google account
3. Pay the one-time $5 registration fee
4. Fill in the publisher display name and contact email (email must be verified)

## 3. Upload

1. Click **New Item** in the dashboard
2. Upload the zip — the dashboard parses the manifest and reports errors immediately
3. Fix any flagged issues and re-upload if needed

## 4. Store Listing

Required assets and fields:

| Field | Requirement |
|---|---|
| Detailed description | Explain what it does, how to use it |
| Screenshots | At least 1, either 1280x800 or 640x400 PNG/JPEG |
| Category | Pick the closest match |
| Language | Primary listing language |
| Small promo tile | 440x280 (optional, helps discoverability) |
| Marquee promo tile | 1400x560 (optional, needed for featuring) |

## 5. Privacy Tab

This is where most rejections happen.

- **Single purpose**: Describe the extension's one narrow purpose. Multi-purpose extensions get rejected.
- **Permission justifications**: Write one justification per requested permission, explaining the specific feature that needs it.
- **Data usage disclosure**: Declare exactly what user data is collected (if any) and certify compliance with the developer program policies.
- **Privacy policy URL**: Required if the extension handles any user data. Host it on a public URL.

## 6. Submit for Review

- Click **Submit for review**
- Review time: a few hours to a few days; longer for broad host permissions
- Visibility options:
  - **Public** — listed in search
  - **Unlisted** — installable only via direct link (good for beta testing)
  - **Private** — restricted to specified accounts or a Google Workspace domain
- You'll receive an email on approval or rejection. Rejections include the policy violation cited — fix and resubmit.

## Common Rejection Reasons

1. Requesting permissions not used by the code
2. Missing or inadequate privacy policy when handling user data
3. Misleading description or functionality
4. Remotely hosted code (violates MV3)
5. Keyword spam in the title or description
6. Single-purpose policy violations

## Updating a Published Extension

1. Bump `version` in `manifest.json`
2. Re-zip and upload via the dashboard's **Package** tab
3. Submit for review — updates go through review again
4. Users receive the update automatically within a few hours of approval
