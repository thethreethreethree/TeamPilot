# BUILD - Edit or remove your own call comment

Migration 0333_comment_revisions.sql (applied; DB at 0333). No env keys.

### A manager edits their comment
write-path: call page → Comments → Edit → Save → PATCH /api/coach/sales-session/pitch-recordings/comment {commentId, body}
→ author + company check → recording_comment_revisions insert (body).
read-path: GET /api/coach/sales-session/pitch-recordings → readRecordings → applyCommentRevisions → the comment shows the
new text with "· edited" (call page, Coach Assessment, the rep's pitch detail).

### A manager removes their comment
write-path: Remove → "Remove it? The rep may already have read it." → Remove → PATCH {commentId, remove: true} →
revision (removed, no body).
read-path: the comment no longer shows to anyone; its original row and the removal stay on record.
