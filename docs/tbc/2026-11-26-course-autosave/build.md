# BUILD - Course editor autosave

No migration. No env keys.

### A manager writes a course and reloads
write-path: the editor's state → localStorage teampilot:course-draft:<id|new> (400 ms after typing; wrapped).
read-path: New course / Edit lessons → readDraft → same starting version → the draft and "Picked up your unsaved changes"; else the course as saved. Save or Cancel → the draft is dropped.
