/** F9.13 - snippets. A snippet reaches other reps only through the rep-consent flow that already
 *  exists for team examples [OBSERVED recording_share_events, 0260]. */
export class SnippetError extends Error {}

export function validateSnippet(startMs: number, endMs: number, sessionMs: number): void {
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs)) throw new SnippetError('Times must be whole milliseconds');
  if (startMs < 0 || endMs > sessionMs) throw new SnippetError('Snippet must sit inside the recording');
  if (endMs - startMs < 1000) throw new SnippetError('Snippet must be at least one second long');
}

export type ShareState = 'none' | 'requested' | 'granted' | 'declined' | 'revoked';

/** Who may play a snippet: the rep, people who can view the rep, and - only when granted -
 *  everyone in the company through a company library folder. */
export function canPlaySnippet(opts: { viewerIsRep: boolean; viewerCanViewRep: boolean; inCompanyLibrary: boolean; share: ShareState }): boolean {
  if (opts.viewerIsRep || opts.viewerCanViewRep) return true;
  return opts.inCompanyLibrary && opts.share === 'granted';
}
