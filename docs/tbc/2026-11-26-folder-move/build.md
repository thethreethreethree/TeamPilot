# BUILD - Moving a library folder

Migration 0360 (library_folder_events: to_parent, kind 'move'; rss_folder_parent_now; library_folders_current view,
security invoker; rss_folder_levels_above; the move guard; 0353's create guard on current parents). No env keys.

### Someone moves a folder
write-path: POST /api/coach/remote/library {action:"move", folderId, toFolderId|null} → owner (personal) or manager (company) → library_folder_events (kind move) → rss_guard_folder_move (same library, no loop, ≤3 levels) → a refusal returns its sentence (400).
read-path: GET /library → library_folders_current (current_parent_id) → folderPaths / underArchived / archivedFolderIds (archive/restore only) → the folder under its new path; saving by path finds folders by current parent.
