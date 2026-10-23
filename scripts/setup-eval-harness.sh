#!/usr/bin/env bash
# Maintainer-only setup. Reads the reviewed pin; no package install runs this.
set -euo pipefail

read -r harness_repository harness_revision < <(python3 - <<'PY'
import json, re
from pathlib import Path
pin = json.loads(Path('scripts/eval-harness.json').read_text())
if not re.fullmatch(r'[0-9a-f]{40}', pin['revision']):
    raise SystemExit('The evaluation revision must be a full Git commit SHA')
print(pin['repository'], pin['revision'])
PY
)

askpass_file=''
trap '[ -z "$askpass_file" ] || rm -f "$askpass_file"' EXIT
if [ -n "${EVAL_HARNESS_ACCESS_TOKEN:-}" ]; then
  # Keep the token out of command arguments, remote URLs, and Git config.
  askpass_file="$(mktemp)"
  cat > "$askpass_file" <<'ASKPASS'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' 'x-access-token' ;;
  *) printf '%s\n' "$EVAL_HARNESS_ACCESS_TOKEN" ;;
esac
ASKPASS
  chmod 700 "$askpass_file"
  export GIT_ASKPASS="$askpass_file"
fi
export GIT_TERMINAL_PROMPT=0

git_for_harness() {
  if [ -n "$askpass_file" ]; then
    git -c credential.helper= -c http.https://github.com/.extraheader= "$@"
  else
    git "$@"
  fi
}

if [ -L eval-harness ]; then
  echo 'eval-harness must not be a symlink.' >&2
  exit 1
fi
# Git can leave an empty directory after removing the old submodule entry.
if [ -d eval-harness ] && [ ! -e eval-harness/.git ]; then
  rmdir eval-harness 2>/dev/null || true
fi
if [ ! -d eval-harness ]; then
  git init -q eval-harness
  git -C eval-harness remote add origin "$harness_repository"
fi
if [ ! -d eval-harness/.git ]; then
  echo 'eval-harness must be a standalone checkout; move an old submodule checkout aside first.' >&2
  exit 1
fi
if [ "$(git -C eval-harness remote get-url origin)" != "$harness_repository" ]; then
  echo 'eval-harness has an unexpected origin; refusing to change it.' >&2
  exit 1
fi
# Cache fingerprints identify this checkout by commit SHA. Local edits would
# change the evaluator without changing that key, even when HEAD is at the pin.
if [ -n "$(git -C eval-harness status --porcelain)" ]; then
  echo 'eval-harness has local changes; refusing to use it for a pinned evaluation.' >&2
  exit 1
fi
if [ "$(git -C eval-harness rev-parse HEAD 2>/dev/null || true)" = "$harness_revision" ]; then
  exit 0
fi
git_for_harness -C eval-harness fetch --depth=1 origin "$harness_revision"
git -C eval-harness checkout --detach "$harness_revision"
