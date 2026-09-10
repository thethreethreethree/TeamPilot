#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# GOVERNANCE layer — installer
#
#   ./install.sh /path/to/your/project
#
# Installs the four law hooks and the tamper lock, brings the governing docs
# into the working tree (constitution §0.1 / A19), and then PROVES each gate
# actually fires before reporting success. A gate that did not fire is a gate
# that is not there.
#
# Safe to re-run: settings.json is MERGED (hooks concatenated per event, so the
# design-system's and the autonomous kit's hooks survive), never clobbered.
# ---------------------------------------------------------------------------
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT="$(dirname "$SRC")"
TARGET="${1:-}"

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_yel=$'\033[33m'
c_bld=$'\033[1m';  c_dim=$'\033[2m';  c_off=$'\033[0m'

die() { echo "${c_red}error:${c_off} $*" >&2; exit 1; }
ok()  { echo "  ${c_grn}✓${c_off} $*"; }
warn(){ echo "  ${c_yel}!${c_off} $*"; }
note(){ echo "  ${c_dim}·${c_off} $*"; }

[ -n "$TARGET" ] || die "usage: ./install.sh /path/to/your/project"
[ -d "$TARGET" ] || die "not a directory: $TARGET"
TARGET="$(cd "$TARGET" && pwd)"
[ "$TARGET" != "$SRC" ] || die "target must be a different directory from the source"

command -v node >/dev/null 2>&1 || die "node is required and was not found on PATH"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "node 18+ required (found $(node -v))"

STAMP="$(date +%Y%m%d-%H%M%S)"

echo
echo "${c_bld}BUILD STARTER V3 — governance layer${c_off}  →  $TARGET"
echo

# ------------------------------------------------------------------ 1 hooks
echo "${c_bld}1. Enforcement hooks${c_off}"
mkdir -p "$TARGET/.claude/hooks"
for h in law-session-start law-prompt-anchor law-read-gate law-read-record; do
  to="$TARGET/.claude/hooks/$h.mjs"
  if [ -e "$to" ] && ! cmp -s "$SRC/claude/hooks/$h.mjs" "$to"; then
    cp "$to" "$to.backup-$STAMP"
    warn "$h.mjs existed — previous version saved as $h.mjs.backup-$STAMP"
  fi
  cp "$SRC/claude/hooks/$h.mjs" "$to"
done
chmod +x "$TARGET"/.claude/hooks/law-*.mjs 2>/dev/null || true
ok ".claude/hooks/  law-session-start, law-prompt-anchor, law-read-gate, law-read-record"

# --------------------------------------------------------------- 2 settings
echo
echo "${c_bld}2. Settings${c_off}"
if [ -f "$TARGET/.claude/settings.json" ]; then
  cp "$TARGET/.claude/settings.json" "$TARGET/.claude/settings.json.backup-$STAMP"
  if node -e '
    const fs=require("fs");
    const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const b=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
    const merged={...a};
    // Per-event CONCAT, never overwrite. A shallow {...a.hooks,...b.hooks} would
    // silently destroy the design-system Stop gate or the autonomous
    // build-continue guard. Dedupe identical entries so a re-run never doubles them.
    const ah=a.hooks||{}, bh=b.hooks||{};
    merged.hooks={...ah};
    for(const k of Object.keys(bh)){
      const existing=merged.hooks[k]||[];
      const seen=new Set(existing.map(x=>JSON.stringify(x)));
      merged.hooks[k]=[...existing,...bh[k].filter(x=>!seen.has(JSON.stringify(x)))];
    }
    // deny beats ask in Claude Code, so a path the design-system merely ASKS
    // about becomes hard-denied once this layer lands. That is the intent.
    merged.permissions={
      allow:[...new Set([...(a.permissions?.allow||[]),...(b.permissions?.allow||[])])],
      deny: [...new Set([...(a.permissions?.deny ||[]),...(b.permissions?.deny ||[])])],
      ask:  [...new Set([...(a.permissions?.ask  ||[]),...(b.permissions?.ask  ||[])])],
    };
    fs.writeFileSync(process.argv[1],JSON.stringify(merged,null,2)+"\n");
  ' "$TARGET/.claude/settings.json" "$SRC/claude/settings.json" 2>/dev/null; then
    ok ".claude/settings.json  merged (existing hooks preserved)"
    warn "your original is at .claude/settings.json.backup-$STAMP — review the merge"
  else
    die "could not merge .claude/settings.json — merge the \"hooks\" and \"permissions\" blocks by hand rather than let this overwrite them"
  fi
else
  cp "$SRC/claude/settings.json" "$TARGET/.claude/settings.json"
  ok ".claude/settings.json"
fi

# ------------------------------------------------------- 3 the law in-tree
# Constitution §0.1 / A19: the methodology that governs the build must be IN the
# working tree at the moment of action. The read-gate blocks product writes if it
# is not, so shipping the layer without the law would wedge the project.
echo
echo "${c_bld}3. Governing docs (§0.1 / A19)${c_off}"
gov=0
for g in 00-START-HERE.md 01-CONSTITUTION.md 03-ANTI-FAULT.md; do
  if [ -f "$KIT/$g" ]; then
    to="$TARGET/$g"
    if [ -e "$to" ] && ! cmp -s "$KIT/$g" "$to"; then cp "$to" "$to.backup-$STAMP"; fi
    cp "$KIT/$g" "$to"
    gov=1
  fi
done
if [ "$gov" -eq 1 ]; then
  ok "00 / 01 / 03 copied to the project root — the read-gate can resolve them"
else
  warn "00/01/03 not found beside the kit. The read-gate will BLOCK product writes"
  warn "  and tell the agent to escalate — which is correct, but you must supply them."
fi

# ------------------------------------------------------------ 4 housekeeping
echo
echo "${c_bld}4. Housekeeping${c_off}"
GI="$TARGET/.gitignore"; touch "$GI"
add_ignore() { grep -qxF "$1" "$GI" 2>/dev/null || echo "$1" >> "$GI"; }
add_ignore ".governance/"
add_ignore "*.backup-*"
# ANCHORED with a leading slash, deliberately: a bare `01-CONSTITUTION.md` is a
# gitignore PATTERN matching at every depth, which would silently un-track the
# kit's own copies wherever the kit sits inside the project. That has happened
# before — git then reports no diff for a file it is not tracking.
add_ignore "/00-START-HERE.md"
add_ignore "/01-CONSTITUTION.md"
add_ignore "/03-ANTI-FAULT.md"
ok ".gitignore updated (.governance/, *.backup-*, the root law copies)"
mkdir -p "$TARGET/.governance"

# ---------------------------------------------------------------- 5 verify
# A gate that did not fire is a gate that is not there. Each probe drives the
# hook exactly as Claude Code would and asserts the exit code.
echo
echo "${c_bld}5. Proving the gates bite${c_off}"
cd "$TARGET"

probe() {  # probe <payload-json>
  local rc=0
  printf '%s' "$1" | CLAUDE_PROJECT_DIR="$TARGET" node .claude/hooks/law-read-gate.mjs >/dev/null 2>&1 || rc=$?
  echo "$rc"
}

esc() { printf '%s' "$1" | sed 's/\\/\\\\/g'; }
T="$(esc "$TARGET")"

# 5a — tamper lock, file tool
rc=$(probe "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T/01-CONSTITUTION.md\",\"content\":\"x\"},\"session_id\":\"probe\"}")
[ "$rc" -eq 2 ] && ok "tamper lock blocks an EDIT to the constitution" \
                || warn "tamper lock did NOT fire on a constitution write (exit $rc)"

# 5b — tamper lock, shell route-around (08-LESSONS Shape 7)
rc=$(probe "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"echo hi >> 03-ANTI-FAULT.md\"},\"session_id\":\"probe\"}")
[ "$rc" -eq 2 ] && ok "tamper lock blocks the SHELL route around it" \
                || warn "tamper lock did NOT fire on a shell append (exit $rc)"

# 5b2 — in-place edit, which takes its target as an argument rather than a redirect
rc=$(probe "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"sed -i s/a/b/ 01-CONSTITUTION.md\"},\"session_id\":\"probe\"}")
[ "$rc" -eq 2 ] && ok "tamper lock blocks an in-place edit (sed -i)" \
                || warn "tamper lock did NOT fire on sed -i (exit $rc)"

# 5c — a genuine READ of the law is not mistaken for a write
rc=$(probe "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"cat 01-CONSTITUTION.md\"},\"session_id\":\"probe\"}")
[ "$rc" -eq 0 ] && ok "reading the law is allowed (no false positive)" \
                || warn "reading the law was BLOCKED (exit $rc) — that is a false positive, report it"

# 5c2 — reading the law while redirecting output ELSEWHERE stays allowed. The
# destination is what the lock cares about, not the mention.
rc=$(probe "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"grep -n A19 01-CONSTITUTION.md > /tmp/notes.txt\"},\"session_id\":\"probe\"}")
[ "$rc" -eq 0 ] && ok "reading the law into a temp file is allowed (no false positive)" \
                || warn "a legitimate read-and-redirect was BLOCKED (exit $rc) — false positive"

# 5d — session-read gate, with nothing read
rm -f "$TARGET/.governance/read-probe.json"
rc=$(probe "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T/app/probe.tsx\",\"content\":\"export default () => null\"},\"session_id\":\"probe\"}")
[ "$rc" -eq 2 ] && ok "session-read gate blocks product code before the law is read" \
                || warn "session-read gate did NOT fire (exit $rc)"

# 5e — the recorder clears it, so the gate has a real escape
printf '%s' "{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$T/01-CONSTITUTION.md\"},\"session_id\":\"probe\"}" \
  | CLAUDE_PROJECT_DIR="$TARGET" node .claude/hooks/law-read-record.mjs >/dev/null 2>&1 || true
printf '%s' "{\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$T/03-ANTI-FAULT.md\"},\"session_id\":\"probe\"}" \
  | CLAUDE_PROJECT_DIR="$TARGET" node .claude/hooks/law-read-record.mjs >/dev/null 2>&1 || true
rc=$(probe "{\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$T/app/probe.tsx\",\"content\":\"export default () => null\"},\"session_id\":\"probe\"}")
[ "$rc" -eq 0 ] && ok "reading both law files RELEASES the gate (the escape works)" \
                || warn "the gate did not release after reading the law (exit $rc) — it would trap a session"
rm -f "$TARGET/.governance/read-probe.json"

# 5f — the anchor and the session notice run without crashing a turn
printf '{}' | CLAUDE_PROJECT_DIR="$TARGET" node .claude/hooks/law-prompt-anchor.mjs >/dev/null 2>&1 \
  && ok "prompt anchor runs" || warn "prompt anchor exited non-zero"
printf '{}' | CLAUDE_PROJECT_DIR="$TARGET" node .claude/hooks/law-session-start.mjs >/dev/null 2>&1 \
  && ok "session-start notice runs" || warn "session-start notice exited non-zero"

cat <<EOF

${c_grn}${c_bld}Installed.${c_off}

${c_bld}Restart Claude Code in this project now.${c_off}
  ${c_dim}Hooks load at session start and at NO other time. An installed-but-not-
  restarted layer enforces exactly nothing — this is the single most common
  reason the gates "do not work". After the restart, run /hooks and confirm
  SessionStart, UserPromptSubmit, PreToolUse and PostToolUse are listed.${c_off}

${c_bld}What is now enforced${c_off}
  · Writes to 00/01/03, tools/ and .claude/hooks/ are DENIED — by the permission
    list for the file tools, and by the hook for the shell route around it.
  · Product-code writes are BLOCKED until 01-CONSTITUTION.md and 03-ANTI-FAULT.md
    have been read in that session. Reading them is the whole remedy.
  · The standing law is re-injected on every prompt, so it survives compaction.
  · The anti-fault tripwire's verdict is REPORTED at session start, never gated on.

${c_bld}To lift the lock${c_off} (a genuine gate repair, a ratified rule change):
  edit ${c_bld}.claude/settings.json${c_off} yourself and remove the relevant deny entry.
  That file is denied to the agent and writable by you. That asymmetry is the point.

EOF
