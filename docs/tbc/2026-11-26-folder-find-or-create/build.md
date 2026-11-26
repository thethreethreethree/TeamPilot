# BUILD - Folder path levels found or made in one statement

Migration 0365 (rss_library_folder_find_or_create, service role only). No env keys.

### Two people save into the same new path at once
write-path: POST /api/coach/remote/library {action:"add", folderName} → per level rpc rss_library_folder_find_or_create (library lock; by current parent; case-insensitive) → the one folder id.
read-path: GET /library → one folder of that name.
