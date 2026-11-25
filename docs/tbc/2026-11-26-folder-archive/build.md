# BUILD - Archive a library folder

Migration 0346_library_folder_archive.sql (applied; DB at 0346). No env keys.

### A rep archives an old folder
write-path: Remote Sales → Library → folder heading → "Archive folder" → POST /api/coach/remote/library {action:
"archive", folderId} → library_folder_events.
read-path: the folder and its items leave the list; "Archived folders (1)" below lists it; Search still finds its calls.

### Restoring
write-path: "Restore" → {action: "restore"}; or saving a call to that folder by name → a restore event.
read-path: the folder and its items are back in the list.
