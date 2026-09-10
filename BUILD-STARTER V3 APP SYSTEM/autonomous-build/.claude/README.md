# Autonomous Build — HARD MODE (drop-in for Claude Code)

A **Stop hook** that keeps a Claude Code agent building until *you* say stop. While
armed, every attempt by the agent to end a turn is blocked and it is told to keep
going. You hold the only off switch: a single flag file.

---

## ⚠️ READ THIS FIRST — why it "keeps stopping"

**Hooks are loaded only at Claude Code session START.** If you install or arm this
mid-session, **nothing happens until you restart** — the agent will keep stopping
because the guard is not loaded yet. This is a Claude Code rule; no script can
force-load a hook into a session that is already running.

**To actually make it work:**
1. Set `autonomous-build.flag` first line to `ACTIVE`.
2. **Restart Claude Code** (fully close and reopen the session).
3. Run `/hooks` and confirm **both** `SessionStart` and `Stop` are listed.
4. On the new session's first turn you'll see the "HARD MODE IS ACTIVE" notice —
   that confirms it's loaded and enforcing.

If you did all of the above and it still stops, the flag's first line is probably a
stop word, or `node` isn't on PATH (see below).

---

## Files
- `settings.json` — registers the **SessionStart** and **Stop** hooks with Claude Code.
- `hooks/build-continue-guard.mjs` — the Stop guard (blocks ending a turn while armed).
- `hooks/autonomous-session-notice.mjs` — the SessionStart notice (announces, at the
  start of each session, that HARD MODE is armed and the guard is loaded).
- `autonomous-build.flag` — the control switch (first line = `ACTIVE` or `STOP`).

## Arm / disarm
| You want to… | Do this |
|---|---|
| **Arm / resume** the loop | Set the flag's **first line** to `ACTIVE`, then **restart Claude Code** |
| **Pause / stop** it | Set the **first line** to `STOP` (or delete the flag file) |
| Turn the whole mechanism off | Delete `autonomous-build.flag`, or remove the hooks from `settings.json` |

Stop words accepted on the first line: `PAUSE`, `STOP`, `HALT`, `STAND DOWN`, `END`,
`END BUILD`, `DONE`, `CEASE`. Anything else (e.g. `ACTIVE`) keeps the loop armed.

## Install
1. Copy this whole `.claude/` folder into your project root.
2. If the project **already** has `.claude/settings.json`, merge the `"hooks"` block
   (both `SessionStart` and `Stop`) instead of overwriting.
3. **Restart Claude Code** so it loads the hooks (hooks are read at session start).
4. Verify with `/hooks` — you should see `SessionStart` and `Stop` listed.
5. Flip `autonomous-build.flag` first line to `ACTIVE` when you want the loop, then
   restart again so the armed state is picked up from turn one.
6. (macOS/Linux only) `chmod +x .claude/hooks/*.mjs`.

## Know before you rely on it
1. **It only takes effect after a restart** (see the box above). This is the single
   most common reason it "doesn't work."
2. **It does not create turns.** The Stop hook only *blocks stopping*; it can't make
   the agent talk to itself. You still drive the session each turn (keep replying, or
   use Claude Code's `/loop` to auto-send a prompt on an interval). It prevents the
   agent from stopping *early* within a driven session.
3. **`node` must be on PATH** in the environment Claude Code runs hooks in. For a
   Node-less project, port the guard + notice scripts to Python and change the
   `command`s in `settings.json` accordingly.
4. **Paths are relative to the project root** (`.claude/...`) — portable as-is.
5. **It fails open:** if the flag file is missing or unreadable, the agent is allowed
   to stop. So a corrupt file can never wedge your session — worst case the loop just
   disarms.
6. **It's a discipline enforcer, not a sandbox.** Its only power is refusing to end a
   turn while `ACTIVE`; it does **not** bypass tool-permission prompts. Keep the flag
   file in version control so the switch is visible.
7. **⚠️ It amplifies the worst build failure: building process instead of product.**
   Because you cannot stop while armed, the pressure to "keep going" gets spent on
   make-work when real product tasks run out — a status manifest, a gate script, a rule
   amendment. **Don't.** "Keep building" means keep building the *product*. If you're
   blocked on an owner decision, **surface it loudly and do a different real product
   task — never manufacture process to look busy, and never amend the governing rules.**
   A real autonomous build died this way (a 12,635-line manifest, 24 audit scripts, 7
   mid-build rule amendments, 53% of commits producing no product). See `03-ANTI-FAULT.md`
   in the build-starter kit, and run its `build-guard.mjs` each session to stay honest.
