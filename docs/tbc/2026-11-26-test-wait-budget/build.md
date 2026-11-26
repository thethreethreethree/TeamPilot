# BUILD - One wait budget for every render test

No migration. No env keys.

### The gate runs a render test on a loaded machine
write-path: none.
read-path: vitest.config.ts setupFiles → vitest.setup.ts → configure({ asyncUtilTimeout: 5000 }) in DOM tests only.
