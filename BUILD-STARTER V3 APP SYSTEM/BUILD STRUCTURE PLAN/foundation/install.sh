#!/bin/sh
# ---------------------------------------------------------------------------
# FOUNDATION installer (Expo / React Native edition)
#
#   ./install.sh /path/to/expo/project
#
# Copies each foundation file to its place and strips the .template suffix.
# NEVER overwrites: anything already present is reported and skipped, so this is
# safe to re-run and safe on a project already underway.
#
# Run it AFTER scaffolding Expo + NativeWind (build sequence Phase 3), because
# the app entry, the NativeWind config, and the generated theme it builds on come
# from the scaffold and the token step — not from here.
#
# POSIX sh on purpose: no bashisms, so it runs under dash/ash on a minimal box.
# ---------------------------------------------------------------------------
set -eu

# Resolve this script's own directory portably (no BASH_SOURCE in POSIX sh).
SRC=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET=${1:-}

# Colours, but only when stdout is a terminal — piped output stays clean.
if [ -t 1 ]; then
  c_red=$(printf '\033[31m'); c_grn=$(printf '\033[32m'); c_yel=$(printf '\033[33m')
  c_bld=$(printf '\033[1m');  c_dim=$(printf '\033[2m');  c_off=$(printf '\033[0m')
else
  c_red=; c_grn=; c_yel=; c_bld=; c_dim=; c_off=
fi

die()  { printf '%serror:%s %s\n' "$c_red" "$c_off" "$*" >&2; exit 1; }
ok()   { printf '  %s+%s %s\n' "$c_grn" "$c_off" "$1"; }
skip() { printf '  %s.%s %s %s(exists, left alone)%s\n' "$c_yel" "$c_off" "$1" "$c_dim" "$c_off"; }

[ -n "$TARGET" ] || die "usage: ./install.sh /path/to/project"
[ -d "$TARGET" ] || die "not a directory: $TARGET"
TARGET=$(CDPATH= cd -- "$TARGET" && pwd)
[ "$TARGET" != "$SRC" ] || die "target must differ from the foundation folder"

printf '\n%sFOUNDATION (app)%s  ->  %s\n\n' "$c_bld" "$c_off" "$TARGET"

copied=0
skipped=0
skipped_list=""

# Walk every file under the foundation except this script and the READMEs.
# None of the template paths contain spaces or newlines (only the `(tabs)`
# parentheses, which the shell handles inside quotes), so a plain read loop is
# safe here and stays POSIX.
find "$SRC" -type f | while IFS= read -r file; do
  rel=${file#"$SRC"/}
  case "$rel" in
    # Skip this script, the README, and any stale tally temp files left behind
    # by a prior run that was killed before its cleanup (or they'd be copied in).
    install.sh|README.md|.install_copied.*|.install_skipped.*) continue ;;
  esac

  dest_rel=${rel%.template}
  dest="$TARGET/$dest_rel"

  if [ -e "$dest" ]; then
    skip "$dest_rel"
    # The loop runs in a subshell (it is piped), so counters set here would not
    # survive it. Record to a temp file and tally after — the portable way to get
    # data out of a piped while-read without bashisms.
    printf '%s\n' "$dest_rel" >> "$SRC/.install_skipped.$$"
    continue
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$file" "$dest"
  # Only shell scripts need the execute bit. There are none in the app
  # foundation today, but keep the rule so a future script installs runnable.
  case "$dest_rel" in
    *.sh) chmod +x "$dest" ;;
  esac
  ok "$dest_rel"
  printf 'x\n' >> "$SRC/.install_copied.$$"
done

# Tally from the temp files the subshell left behind, then clean them up.
[ -f "$SRC/.install_copied.$$" ]  && copied=$(wc -l < "$SRC/.install_copied.$$" | tr -d ' ')
[ -f "$SRC/.install_skipped.$$" ] && skipped=$(wc -l < "$SRC/.install_skipped.$$" | tr -d ' ')
[ -f "$SRC/.install_skipped.$$" ] && skipped_list=$(cat "$SRC/.install_skipped.$$")
rm -f "$SRC/.install_copied.$$" "$SRC/.install_skipped.$$"

printf '\n%s%s copied, %s skipped%s\n' "$c_bld" "${copied:-0}" "${skipped:-0}" "$c_off"

# The app entry (app/_layout.tsx) is ALWAYS created by a scaffold, so the
# foundation's version — the one carrying fonts, the safe-area and theme
# providers, the reduce-motion wiring, and the ErrorBoundary — is the file that
# is always skipped, and it is the most valuable one. Say so loudly.
if [ "${skipped:-0}" -gt 0 ]; then
  printf '\n%s%sNOT INSTALLED - these already existed:%s\n' "$c_yel" "$c_bld" "$c_off"
  printf '%s\n' "$skipped_list" | sed '/^$/d; s/^/  /'
  printf '\n%sNothing was overwritten. Merge anything you want by hand.%s\n' "$c_yel" "$c_off"

  if printf '%s\n' "$skipped_list" | grep -q "app/_layout.tsx"; then
    cat <<WARN

${c_red}${c_bld}READ THIS${c_off} - app/_layout.tsx was skipped, so you do NOT yet have:

  - ${c_bld}font loading${c_off}       useFonts + splash-hold, so no flash of system font
  - ${c_bld}safe-area provider${c_off} without it, content sits under the notch / home bar
  - ${c_bld}theme provider${c_off}     the navigator chrome coloured from your tokens
  - ${c_bld}reduce-motion${c_off}      transitions dropped when the user asks for it
  - ${c_bld}ErrorBoundary${c_off}      a human failure screen instead of a native crash

  Merge them in from: app/_layout.tsx.template
  (and app/(tabs)/_layout.tsx.template for the tab bar it hosts)
WARN
  fi
fi

# ---------------------------------------------------------------------------
# The part people forget
# ---------------------------------------------------------------------------
cat <<EOF

${c_bld}Next, in this order${c_off}

  1. ${c_bld}Resolve every TODO(project)${c_off}. Nothing here works correctly
     until they are gone:

       grep -rn "TODO(project)" --include="*.ts" --include="*.tsx" .

  2. Install the runtime dependencies these files assume. ${c_bld}All of them${c_off} -
     a missing native module fails the BUILD, not just the render, and often only
     in a release build, not in Expo Go:

       npx expo install expo-router expo-sqlite expo-secure-store \\
         expo-local-authentication expo-font expo-splash-screen expo-haptics \\
         expo-status-bar react-native-safe-area-context @expo/vector-icons \\
         @react-navigation/native
       # plus the permission modules you actually use, e.g.
       #   npx expo install expo-camera expo-image-picker expo-location expo-notifications
       # and NativeWind per its own current setup docs (babel + metro + global.css)

     ${c_dim}Use 'npx expo install' rather than a bare npm install: it pins each
     package to the version matching your Expo SDK. A version-skewed native module
     is the classic "works in dev, crashes in the release build".${c_off}

  3. Point ${c_bld}lib/theme.ts${c_off} at wherever 'token-gen --theme' wrote the
     generated theme, and confirm NativeWind resolves classes (global.css imported
     in app/_layout.tsx, babel + metro configured). No className renders until it
     does.

  4. Fill in ${c_bld}app.config.ts${c_off}: name, slug, bundleIdentifier, package,
     icon/splash/adaptive-icon assets, and the permission usage strings - keep ONLY
     the permissions you use, and make each iOS string agree with lib/permissions.ts.

  5. Write your on-device schema into ${c_bld}lib/schema.ts${c_off}, following the
     shape there. Migrations run on app launch, so a change needs a relaunch.

  6. Read ../01-BUILD-SEQUENCE.md for the phase order, and ../07-HANDOVER-GATE.md
     before telling anyone it is done.

${c_dim}The templates are a starting point, verified by reading, not by running -
there is no Expo project here to run them against. On YOUR project nothing is
verified until you exercise it on a real device (build sequence Phase 9).${c_off}

EOF
