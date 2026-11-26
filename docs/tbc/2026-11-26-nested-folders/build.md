# BUILD - Nested library folders

Migration 0353 (applied to production before the code). No env keys.

### A rep saves a call into a folder inside a folder
write-path: call page → Folder "Objections / Pricing" → POST /api/coach/remote/library {action: "add", folderName} →
library_folders "Objections" (parent null) and "Pricing" (parent = Objections), found or created; library_items.
read-path: Library → headed "Objections" then "Objections / Pricing"; the save box suggests both.

### A manager archives a parent folder
write-path: Library → "Archive folder" → library_folder_events (archive), as before.
read-path: the folder and everything inside it leave the list; "Archived folders (1)" restores them together.
