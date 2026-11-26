# BUILD - Filter Search and Team call stats by call category

No migration. No env keys.

### A manager narrows to one category
write-path: none.
read-path: Search ?category= → call_category_picks (calls ever in it) → all their picks → currentCategories → calls in it now → results. Team call stats ?category= → stats rows → categoriesOf (caller's client, chunked, paged) → only calls in it now → averages.
