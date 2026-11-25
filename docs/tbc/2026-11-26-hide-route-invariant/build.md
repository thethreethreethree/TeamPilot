# BUILD - An audit check: service-role call reads must check hides

No migration. No env keys.

### A developer adds a service-role route that reads calls
write-path: npm run invariant:audit (part of npm run check and CI).
read-path: "A service-role route reads calls without checking hidden calls" until it calls a hide helper or is listed
with why no hidden call can reach a person.
