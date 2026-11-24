# BUILD - Save a call to a folder you name, with a note; Listen later

No migration. No env keys.

### A rep saves a call to listen to later
write-path: call page → Listen later → POST /api/coach/remote/library {action: add, scope: mine, folderName: "Listen later"} →
the caller's "Listen later" folder (created on first use) + library_items.
read-path: Remote Sales → Library → "Listen later" group with the call (and the note if typed).

### Someone saves a call or clip to a named folder with a note
write-path: Folder (existing names suggested) + Note → Save call/clip to Mine/Company → the route finds or creates the
folder by name in that scope → library_items (note).
read-path: Library shows the folder group and the note under the item.
