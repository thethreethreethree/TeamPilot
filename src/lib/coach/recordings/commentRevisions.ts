/**
 * Call comments as their author last left them (0333; Gong F9.8 "edit/delete"). A comment row never changes; an edit
 * or a removal is a revision. The latest revision wins: an edit replaces the text shown (marked edited), a removal
 * leaves the comment out. Pure, so the rule is tested once and every reader uses it.
 */
export type CommentRow = { id: string; timestampS: number; body: string; createdAt: string; authorId: string };
export type RevisionRow = { commentId: string; id: number; body: string | null; removed: boolean };
export type ShownComment = CommentRow & { edited: boolean };

export function applyCommentRevisions(comments: CommentRow[], revisions: RevisionRow[]): ShownComment[] {
  const latest = new Map<string, RevisionRow>();
  for (const r of revisions) {
    const had = latest.get(r.commentId);
    if (!had || r.id > had.id) latest.set(r.commentId, r);
  }
  return comments.flatMap((c): ShownComment[] => {
    const r = latest.get(c.id);
    if (!r) return [{ ...c, edited: false }];
    if (r.removed || r.body === null) return [];
    return [{ ...c, body: r.body, edited: true }];
  });
}
