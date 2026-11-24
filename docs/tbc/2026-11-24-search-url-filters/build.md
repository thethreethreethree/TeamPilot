# BUILD - Search opens with the filters in its URL

No migration. No env keys.

### A manager opens a rep's calls from Team call stats
write-path: none.
read-path: Coaching → Team call stats → a rep's name → /dashboard/remote-sales/search?rep=<id>&from=<date> → Search shows
that rep's calls since the period start, with the filters filled in.
