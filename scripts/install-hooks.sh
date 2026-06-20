#!/usr/bin/env bash
# Install the constitutional citation friction hooks.
#
# What this does:
#   Points git's core.hooksPath at scripts/hooks/. This is a
#   per-clone setting (not committed) so each contributor (the
#   agent on its laptop; the founder if they want it) opts in.
#
# What this does NOT do:
#   Enforce hook installation globally. A contributor that runs
#   `git config --unset core.hooksPath` opts out silently. Per the
#   honest framing in scripts/hooks/pre-commit, these hooks are
#   friction, not enforcement.
#
# Run once after cloning:
#   bash scripts/install-hooks.sh
#
# Verify installation:
#   git config core.hooksPath
#   -> should print: scripts/hooks

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath scripts/hooks

# Make sure the scripts are executable (chmod survives commit in
# git but a fresh clone on Windows can lose the bit).
chmod +x scripts/hooks/pre-commit
chmod +x scripts/hooks/commit-msg 2>/dev/null || true

echo "[install-hooks] core.hooksPath set to scripts/hooks"
echo "[install-hooks] pre-commit + commit-msg hooks active"
echo ""
echo "What these do:"
echo "  - Detect constitutional citations (§A14, §3.1, etc.) in"
echo "    commit messages and diff content."
echo "  - Require a Session-Reads: trailer in the commit body."
echo "  - Either inline (asset:timestamp pairs) or reference a"
echo "    docs/closures/<date>-<slug>.md file."
echo ""
echo "These are FRICTION (against forgetting), not enforcement."
echo "See scripts/hooks/pre-commit for the honest framing."
