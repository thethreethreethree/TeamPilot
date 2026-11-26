# BUILD - Lesson content: a library call and an outside link

Migration 0359 (training_course_steps: library_item_id, link_url with an https check; the kind shape check keeps both
off practice steps). No env keys.

### A manager adds a library call and a link to a lesson
write-path: PUT/POST /api/coach/remote/courses steps[{libraryItemId, linkUrl}] → cleanLink (https only) → library_items in a company folder, not removed → a new step version.
read-path: GET /courses → steps with libraryItemId and linkUrl → the editor's link field and company-library picker (GET /library?scope=company).

### A rep opens the lesson's call
write-path: none (listening is recorded by the library player as before).
read-path: GET /course-assignments → the step's libraryItemId → /dashboard/remote-sales/library?scope=company&item=…&from=training → GET /library (canPlay, hides) → the item marked, or "isn't in the library for you" / "older than the newest shown", and Back to Training.
