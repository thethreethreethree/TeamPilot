/**
 * Links out to the website, where some things can only be done.
 *
 * WHY THIS EXISTS. Ten places in this app tell a rep that something happens "on
 * the website" and, until now, none of them offered a way to get there. That is
 * the same shape as an empty state that explains what would fill it and gives no
 * way to start: it teaches, and leaves the person exactly where they were.
 *
 * NOT EVERY MENTION BECAME A LINK, and the test applied was narrow on purpose:
 * **is the person blocked at this moment, and does that page unblock them?**
 * Two passed it — a topic that was created without adding you, and Calibration
 * refusing this app's token — and both are messages shown immediately after
 * something failed. The rest are notes about where older data lives, or ask you
 * to get a human to add you, which no URL can do. Making all ten tappable would
 * mean none of them read as important.
 *
 * PURE, so the URL is a tested rule rather than a template literal inside a
 * screen. Screens have no business knowing how a path is joined to a host.
 */

/** Paths on the website, named once so a screen never types one. */
export const WEB_PATHS = {
  topic: (topicId: string) => `/dashboard/chats/${encodeURIComponent(topicId)}`,
  calibration: () => '/dashboard/sales-coach/calibration',
  /**
   * THE ONE LINK HERE THAT IS NOT AN UNBLOCKING LINK, and the exception is deliberate.
   *
   * The rule stated above this object is "is the person blocked at this moment, and does that page
   * unblock them?" - which is what keeps ten passing mentions of the website from all becoming
   * controls. A privacy policy passes no such test and belongs here anyway, because it is not a note
   * about where data lives: it is a document this app is REQUIRED to put in front of the person
   * using it, and it was missing entirely.
   *
   * This app records other people's voices. The policy at this address names who receives that
   * audio - it was corrected on 4 September precisely because preparing the App Store submission
   * showed it did not name ElevenLabs, which receives every recorded conversation for
   * transcription, and claimed nothing reached Anthropic that the user had not authored, which
   * stopped being true when transcripts containing the CUSTOMER's words began being sent for
   * analysis. A rep cannot consent to what they are not shown.
   *
   * OUTSIDE THE LOGIN. `/privacy` is not in the website's middleware matcher, which guards only
   * /dashboard, /onboarding and the two login routes. Verified 11 September: 200, no redirect. A
   * policy that requires an account to read is not published.
   */
  privacy: () => '/privacy',
} as const;

/**
 * Join the configured host to a path, or return null.
 *
 * NULL RATHER THAN A BEST GUESS. With no API base there is no website to send
 * anyone to, and a control that opened `/dashboard/chats/abc` with no host — or
 * worse, opened the site's 404 — would read to a rep as the thing having been
 * deleted. That is a different and more alarming message than "this build has
 * no server configured", and it is the one they would act on.
 */
export function webUrl(apiBase: string | null | undefined, path: string): string | null {
  const base = (apiBase ?? '').trim().replace(/\/+$/, '');
  if (!base) return null;
  if (!path.startsWith('/')) return null;
  return `${base}${path}`;
}

/** The website page for one chat topic. */
export function webTopicUrl(apiBase: string | null | undefined, topicId: string): string | null {
  const id = (topicId ?? '').trim();
  if (!id) return null;
  return webUrl(apiBase, WEB_PATHS.topic(id));
}

/** The website's Score Calibration page. */
export function webCalibrationUrl(apiBase: string | null | undefined): string | null {
  return webUrl(apiBase, WEB_PATHS.calibration());
}

/**
 * The published Privacy Policy.
 *
 * ALWAYS RESOLVES FOR A REAL BUILD, unlike the two links above: `ENV.API_BASE` falls back to
 * the production host rather than to empty, so this cannot come back null in an app anyone
 * has installed. That matters more here than it does for a convenience link - `WebsiteLink`
 * renders nothing without a URL, which is the right answer for a shortcut and the wrong one
 * for a document that has to be reachable.
 */
export function webPrivacyUrl(apiBase: string | null | undefined): string | null {
  return webUrl(apiBase, WEB_PATHS.privacy());
}
