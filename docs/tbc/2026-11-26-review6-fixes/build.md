# BUILD - Acting on the review of nested folders

No migration. No env keys.

### A manager saves by folder id into a folder inside an archived one
write-path: POST /api/coach/remote/library {action: "add", scope: "company", folderId} → library_folder_events restore for each archived ancestor.
read-path: the folder and its parent show again in the Library.

### Someone looks at an archived folder inside an archived folder
write-path: none.
read-path: Library → Archived folders → "Old / Inner · Restore the folder it's in first".
