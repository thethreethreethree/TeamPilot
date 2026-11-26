# BUILD - Call categories: an admin's list, the rep's pick

Migration 0367 (call_categories, call_category_picks). No env keys.

### A company admin keeps the list
write-path: POST /api/coach/remote/call-categories {name} (admins; checkName) → call_categories. Retire: PATCH → retired_at.
read-path: GET /call-categories → live categories → the Protection page list and the call page's picker.

### A rep picks a finished call's category
write-path: POST /api/coach/remote/[id]/category {categoryId|null} → getSession through the caller's client → the call's own rep, call over, phone/video → a live company category → call_category_picks.
read-path: GET /[id]/category → the latest pick through the caller's client → the picker (rep) or the label (others).
