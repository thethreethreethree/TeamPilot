#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Master Design Guide Line — installer
#
#   ./install.sh /path/to/your/project
#
# Copies the enforcement payload into the target project and verifies that the
# gates actually run. Safe to re-run: existing files are backed up, never
# silently overwritten.
# ---------------------------------------------------------------------------
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-}"

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_yel=$'\033[33m'
c_bld=$'\033[1m';  c_dim=$'\033[2m';  c_off=$'\033[0m'

die() { echo "${c_red}error:${c_off} $*" >&2; exit 1; }
ok()  { echo "  ${c_grn}✓${c_off} $*"; }
note(){ echo "  ${c_dim}·${c_off} $*"; }
warn(){ echo "  ${c_yel}!${c_off} $*"; }

[ -n "$TARGET" ] || die "usage: ./install.sh /path/to/your/project"
[ -d "$TARGET" ] || die "not a directory: $TARGET"
TARGET="$(cd "$TARGET" && pwd)"
[ "$TARGET" != "$SRC" ] || die "target must be a different directory from the source"

command -v node >/dev/null 2>&1 || die "node is required and was not found on PATH"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "node 18+ required (found $(node -v))"

STAMP="$(date +%Y%m%d-%H%M%S)"

echo
echo "${c_bld}Master Design Guide Line${c_off}  →  $TARGET"
echo

# --------------------------------------------------------------- copy helper
copy() {           # copy <relative-src> <relative-dest>
  local from="$SRC/$1" to="$TARGET/$2"
  mkdir -p "$(dirname "$to")"
  if [ -e "$to" ] && ! cmp -s "$from" "$to"; then
    cp "$to" "$to.backup-$STAMP"
    warn "$2 existed — previous version saved as $2.backup-$STAMP"
  fi
  cp "$from" "$to"
}

copy_tree() {      # copy_tree <relative-src-dir> <relative-dest-dir>
  local from="$SRC/$1" to="$TARGET/$2"
  mkdir -p "$to"
  # -prune node_modules: copying it file-by-file is thousands of needless
  # operations for something we delete on the next line.
  ( cd "$from" && find . \( -name node_modules -o -name .git \) -prune -o -type f -print0 ) \
    | while IFS= read -r -d '' f; do
        copy "$1/${f#./}" "$2/${f#./}"
      done
}

# ------------------------------------------------------------------- 1 tools
echo "${c_bld}1. Verification tools${c_off}"
copy_tree "tools" "tools"
chmod +x "$TARGET"/tools/*.mjs 2>/dev/null || true
ok "tools/  (design-lint, token-gen, contrast-audit, runtime-audit, gate)"

# ------------------------------------------------------------------ 2 claude
echo
echo "${c_bld}2. Claude Code enforcement${c_off}"
mkdir -p "$TARGET/.claude"
copy_tree "claude/hooks"   ".claude/hooks"
copy_tree "claude/rules"   ".claude/rules"
copy_tree "claude/skills"  ".claude/skills"
copy_tree "claude/agents"  ".claude/agents"
chmod +x "$TARGET"/.claude/hooks/*.mjs 2>/dev/null || true
ok ".claude/hooks/   5 hooks (session, prompt anchor, pre-write, post-write, stop gate)"
ok ".claude/rules/   5 path-scoped rulesets"
ok ".claude/skills/  5 skills (/design-intake … /design-ship)"
ok ".claude/agents/  design-auditor"

# settings.json — merge rather than clobber
if [ -f "$TARGET/.claude/settings.json" ]; then
  cp "$TARGET/.claude/settings.json" "$TARGET/.claude/settings.json.backup-$STAMP"
  if node -e '
    const fs=require("fs");
    const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const b=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
    const merged={...a};
    // Per-event CONCAT, not overwrite: a shallow {...a.hooks,...b.hooks} would
    // silently destroy any existing Stop/SessionStart hook (e.g. the BUILD-STARTER
    // autonomous build-continue-guard). Concatenate so both sets of hooks run, and
    // dedupe identical entries so re-running the installer never doubles them.
    const ah=a.hooks||{}, bh=b.hooks||{};
    merged.hooks={...ah};
    for(const k of Object.keys(bh)){
      const existing=merged.hooks[k]||[];
      const seen=new Set(existing.map(x=>JSON.stringify(x)));
      merged.hooks[k]=[...existing,...bh[k].filter(x=>!seen.has(JSON.stringify(x)))];
    }
    merged.permissions={
      allow:[...new Set([...(a.permissions?.allow||[]),...(b.permissions?.allow||[])])],
      deny:[...new Set([...(a.permissions?.deny||[]),...(b.permissions?.deny||[])])],
      ask:[...new Set([...(a.permissions?.ask||[]),...(b.permissions?.ask||[])])],
    };
    fs.writeFileSync(process.argv[1],JSON.stringify(merged,null,2)+"\n");
  ' "$TARGET/.claude/settings.json" "$SRC/claude/settings.json" 2>/dev/null; then
    ok ".claude/settings.json  merged with your existing settings"
    warn "your original is at .claude/settings.json.backup-$STAMP — review the merge"
  else
    copy "claude/settings.json" ".claude/settings.json"
    warn "could not merge settings.json; replaced it (original backed up)"
  fi
else
  copy "claude/settings.json" ".claude/settings.json"
  ok ".claude/settings.json"
fi

# CLAUDE.md — append rather than replace
if [ -f "$TARGET/CLAUDE.md" ]; then
  # Match a stable marker the appended block actually contains (the design-law
  # H1). The old "Master Design Guide Line" string isn't in the appended text, so
  # the guard never fired and a re-run would append the design law twice.
  if grep -qF "# Design law for this project" "$TARGET/CLAUDE.md" 2>/dev/null; then
    note "CLAUDE.md already references the guide — left untouched"
  else
    cp "$TARGET/CLAUDE.md" "$TARGET/CLAUDE.md.backup-$STAMP"
    {
      printf '\n\n---\n\n'
      cat "$SRC/claude/CLAUDE.md"
    } >> "$TARGET/CLAUDE.md"
    ok "CLAUDE.md  design law appended (original backed up)"
  fi
else
  copy "claude/CLAUDE.md" "CLAUDE.md"
  ok "CLAUDE.md"
fi

# -------------------------------------------------------------- 3 reference
echo
echo "${c_bld}3. Reference material${c_off}"
copy_tree "reference" "reference"
copy_tree "templates" "templates"
copy "Master-Design-Guide-line.Md" "Master-Design-Guide-line.Md"
ok "reference/, templates/, Master-Design-Guide-line.Md"

# ------------------------------------------------- 3b governing docs (A19 guard)
# The design law appended to CLAUDE.md declares itself SUBORDINATE to
# 01-CONSTITUTION.md. If that file isn't in the project tree, CLAUDE.md cites a
# constitution nobody can read — the exact A19 failure. So when this design-system
# is installed from inside the BUILD-STARTER kit, bring the governing docs along.
# These are dev-time governance, gitignored below — never committed.
echo
echo "${c_bld}3b. Governing docs${c_off}"
KIT="$(dirname "$SRC")"
gov_copied=0
for g in 00-START-HERE.md 01-CONSTITUTION.md 03-ANTI-FAULT.md; do
  if [ -f "$KIT/$g" ]; then
    to="$TARGET/$g"
    if [ -e "$to" ] && ! cmp -s "$KIT/$g" "$to"; then cp "$to" "$to.backup-$STAMP"; fi
    cp "$KIT/$g" "$to"
    gov_copied=1
  fi
done
if [ "$gov_copied" -eq 1 ]; then
  ok "00/01/03 copied so CLAUDE.md's constitution reference resolves (gitignored, dev-only)"
else
  warn "00/01/03 not found beside the kit — CLAUDE.md cites 01-CONSTITUTION.md;"
  warn "  add it to this project yourself or the reference dangles (constitution §A19)"
fi

# ------------------------------------------------------------------ 4 gitignore
echo
echo "${c_bld}4. Housekeeping${c_off}"
GI="$TARGET/.gitignore"
add_ignore() {
  grep -qxF "$1" "$GI" 2>/dev/null || echo "$1" >> "$GI"
}
touch "$GI"
add_ignore ".design/"
add_ignore "*.backup-*"
# Governing docs are dev-time only and (for 02) secret — never commit them.
# ANCHORED with a leading slash, deliberately. A bare `00-START-HERE.md` is a
# gitignore *pattern*, not a path — it matches at EVERY depth, which silently
# un-tracks the kit's own copies wherever the kit folder happens to sit inside
# the project. That has happened: the law files stopped being version-controlled
# and `git diff` then reported them as unchanged no matter what, because git
# reports nothing for a file it is not tracking.
#
# These three are the ROOT-level dev copies this installer writes. Only those.
add_ignore "/00-START-HERE.md"
add_ignore "/01-CONSTITUTION.md"
add_ignore "/03-ANTI-FAULT.md"
ok ".gitignore updated (.design/, *.backup-*, governing docs)"

mkdir -p "$TARGET/.design"

# ------------------------------------------------------------------ 5 verify
echo
echo "${c_bld}5. Verifying${c_off}"
cd "$TARGET"

# Each probe runs with errexit suspended: these tools intentionally exit
# non-zero when they find problems, which is not an installer failure.
probe() { local rc=0; "$@" >/dev/null 2>&1 || rc=$?; echo "$rc"; }

rc=$(probe node tools/design-lint.mjs --json)
if [ "$rc" -le 1 ]; then ok "design-lint runs"; else die "design-lint failed to run (exit $rc)"; fi

rc=$(probe node tools/token-gen.mjs --seed '#3B5BA9' --json)
if [ "$rc" -eq 0 ]; then ok "token-gen runs"; else die "token-gen failed to run (exit $rc)"; fi

# Probe both gates. Use a temporary contract so the second probe exercises the
# LINT path rather than tripping the contract gate again.
probe_hook() {
  local rc=0
  printf '%s' "$1" | node .claude/hooks/pre-write-guard.mjs >/dev/null 2>&1 || rc=$?
  echo "$rc"
}

PAYLOAD_CONTRACT='{"tool_name":"Write","tool_input":{"file_path":"'"$TARGET"'/app/__probe.tsx","content":"export default () => <div/>"}}'
PAYLOAD_LINT='{"tool_name":"Write","tool_input":{"file_path":"'"$TARGET"'/app/__probe.tsx","content":"export default () => <div className=\"bg-[#ff0000]\"/>"}}'

HAD_CONTRACT=0
[ -f "$TARGET/DESIGN-CONTRACT.md" ] && HAD_CONTRACT=1

if [ "$HAD_CONTRACT" -eq 0 ]; then
  rc=$(probe_hook "$PAYLOAD_CONTRACT")
  [ "$rc" -eq 2 ] && ok "pre-write guard blocks UI writes with no contract" \
                  || warn "contract gate did not fire (exit $rc)"
  printf -- '---\ndirection: probe\ncolor:\n  seed: "#3B5BA9"\ntype:\n  display: X\n  body: Y\nnavigation: top-visible\nvoice: probe\nwaivers: []\n---\n' \
    > "$TARGET/DESIGN-CONTRACT.md"
fi

rc=$(probe_hook "$PAYLOAD_LINT")
[ "$rc" -eq 2 ] && ok "pre-write guard blocks rule violations" \
                || warn "lint gate did not fire (exit $rc) — check .claude/hooks/"

[ "$HAD_CONTRACT" -eq 0 ] && rm -f "$TARGET/DESIGN-CONTRACT.md"

rc=$(probe node tools/gate.mjs --json)
if [ "$rc" -le 1 ]; then ok "gate runs"; else warn "gate exited $rc — run 'node tools/gate.mjs' to see why"; fi

# --------------------------------------------------------------------- done
cat <<EOF

${c_grn}${c_bld}Installed.${c_off}

${c_bld}Next steps${c_off}

  1. Restart Claude Code in this project so the hooks and settings load.
     ${c_dim}The VS Code extension reads .claude/ at session start.${c_off}

  2. Run the intake before writing any UI:

       ${c_bld}/design-intake${c_off}

     UI writes are blocked until DESIGN-CONTRACT.md exists. That is deliberate.

  3. Then, in order:

       /design-direction    choose and justify an art direction
       ...scaffold + foundation/install.sh...
       /design-tokens       generate and verify globals.css
       ...build...
       /design-review       independent audit
       /design-ship         all gates green

  4. This design system is the DESIGN LAW layer of a larger kit. The build
     order, the backend shape, the deployment method and the handover gate
     live one level up, in the METHOD layer:

       ${c_bld}BUILD STRUCTURE PLAN/01-BUILD-SEQUENCE.md${c_off}   the phases and their gates
       ${c_bld}BUILD STRUCTURE PLAN/foundation/${c_off}            working code to install

     Run foundation/install.sh AFTER scaffolding and BEFORE tokens.

${c_bld}Optional — runtime gates${c_off}

  The runtime audit needs a browser:

       npm i -D playwright @axe-core/playwright
       npx playwright install chromium

  Then:  node tools/gate.mjs --url http://localhost:3000

${c_dim}Read Master-Design-Guide-line.Md for the full specification.${c_off}

EOF
