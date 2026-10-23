#!/usr/bin/env bash
# Consolidated shell CI helper for skill-eval-ci.yml and
# skill-eval-main-baseline.yml. One file, one function per responsibility,
# called via `bash scripts/ci.sh <function> [args...]` -- see scripts/ci.py
# for the Python-side counterpart these two workflows also depend on.
#
# Deliberately does NOT set -e/-u/pipefail at the top level: author_and_evaluate
# needs to tolerate a failing author-app.sh (see its own comment below), so
# functions that DO need strict-failure semantics wrap their own body in a
# `(set -euo pipefail; ...)` subshell instead of relying on a global option.

# Has to be the 1M variant. On 200k, Claude Code drops the skill descriptions
# from its menu, so nothing triggers and every trigger score reads 0. Nobody
# documents this, we hit it in CI. Shared here so both workflows stay in sync.
export AGENT_MODEL="${AGENT_MODEL:-sonnet[1m]}"

# Fetch the private evaluation checkout only when a maintainer runs an eval.
# The revision is reviewed in scripts/eval-harness.json, not a plugin submodule.
fetch_eval_harness() {
  bash scripts/setup-eval-harness.sh
}

# Normalize either historical nested packages or root packages into one baseline
# directory. This keeps PR comparisons working while origin/main still uses the
# old layout. Extract tracked files only, never the private evaluation checkout.
# Usage: extract_plugin <git-ref> <new-destination>
extract_plugin() {
  (
    set -euo pipefail
    local ref="$1" destination="$2"
    mkdir "$destination"
    if git cat-file -e "${ref}:skills" 2>/dev/null; then
      local paths=() path
      for path in plugin.json mcp.json .mcp.json .claude-plugin/plugin.json assets/expo.png skills README.md LICENSE; do
        if git cat-file -e "${ref}:${path}" 2>/dev/null; then
          paths+=("$path")
        fi
      done
      git archive "$ref" "${paths[@]}" | tar -x -C "$destination"
    elif git cat-file -e "${ref}:plugins/expo/skills" 2>/dev/null; then
      git archive "$ref" plugins/expo | tar -x --strip-components=2 -C "$destination"
    else
      echo "No Expo plugin found on $ref" >&2
      exit 1
    fi
  )
}

# Install dependencies for eval-harness
install_harness_deps() {
  (
    set -euo pipefail
    cd eval-harness
    bun install --frozen-lockfile
  )
}

# Extract main's plugin, or use the current root plugin, and fingerprint only
# packaged content. The archived layout is normalized by extract_plugin.
# Usage: fingerprint_main_content extract|checkout
#   extract: clean archive of origin/main at /tmp/expo-plugin-main
#   checkout: current repository root, already checked out on main
#
# Requires PRD, PRD_ID, SCENARIO, AGENT, EVAL_HARNESS_ACCESS_TOKEN in env
# (already set as job env vars / repo secrets); AGENT_MODEL is defaulted above.
fingerprint_main_content() {
  (
    set -euo pipefail
    local mode="$1"
    local skill_dir

    if [ "$mode" = "extract" ]; then
      # Only fingerprint JSON goes to stdout; setup logs go to stderr.
      git fetch origin main >&2
      local baseline_parent
      baseline_parent="$(mktemp -d /tmp/expo-plugin-baseline.XXXXXX)"
      extract_plugin origin/main "$baseline_parent/plugin" >&2
      # The later evaluation job in this workspace uses the same normalized path.
      # Refuse to replace an existing baseline instead of mixing archived trees.
      if [ -e /tmp/expo-plugin-main ]; then
        echo "/tmp/expo-plugin-main already exists; use a fresh evaluation workspace" >&2
        exit 1
      fi
      mv "$baseline_parent/plugin" /tmp/expo-plugin-main
      rmdir "$baseline_parent"
      skill_dir="/tmp/expo-plugin-main"
    elif [ "$mode" = "checkout" ]; then
      skill_dir="$(pwd)"
    else
      echo "usage: fingerprint_main_content extract|checkout" >&2
      exit 2
    fi

    fetch_eval_harness >&2

    python3 scripts/ci.py fingerprint \
      --skill-dir "$skill_dir" \
      --harness-dir eval-harness \
      --prd "eval-harness/${PRD}" \
      --prd-skills eval-harness/dataset/prd_skills.json \
      --prd-id "${PRD_ID}" \
      --scenario "${SCENARIO}" \
      --agent "${AGENT}" \
      --model "${AGENT_MODEL}"
  )
}

# Writes fingerprint_main_content's JSON to <json-path> and prints just the
# hash, so each workflow step is one `set-output` line.
#
# Usage: write_fingerprint extract|checkout <json-path>
write_fingerprint() {
  (
    set -euo pipefail
    fingerprint_main_content "$1" > "$2"
    python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['fingerprint'])" "$2"
  )
}

# Prints "true" or "false" for whether the given bundle dir is a valid,
# matching cache restore. Never exits non-zero itself -- the caller always
# gets a clean true/false regardless of which way the underlying verify
# call went (missing dir, bad manifest, fingerprint mismatch, or a genuine
# hit all collapse to a plain boolean here).
#
# Usage: check_cache_hit <bundle-dir> <expected-fingerprint>
check_cache_hit() {
  local bundle_dir="$1"
  local fingerprint="$2"
  if python3 scripts/ci.py bundle verify --bundle-dir "$bundle_dir" --expect-fingerprint "$fingerprint" >/dev/null 2>&1; then
    echo true
  else
    echo false
  fi
}

# Produces OUT_DIR/metrics.json for skill-eval-ci.yml's combined
# author+evaluate job: either copies a cache hit, or authors and evaluates
# directly in this job's own workspace (no tar/artifact round-trip --
# eval-skill-use.sh's --authored-artifact accepts a plain directory, so
# authoring and evaluating in the same job needs no packaging step at all).
#
# Deliberately does NOT print machine-readable output or capture its own
# stdout -- author-app.sh (Claude Code) and eval-skill-use.sh print a lot of
# their own progress output to stdout, which is fine to let through directly
# to the job log, but would corrupt anything that tried to `$(...)`-capture
# this whole function (bash would try to `eval` git/npm/Claude Code's own
# log lines as commands -- exactly the bug this replaced: a prior version
# called `ci.py print-outputs` as this function's own last line, and the
# caller wrapped the *entire* function in `eval "$(...)"`, which choked the
# first time a captured line happened to look like a shell word, e.g. git's
# own "Submodule path '...' checked out '<sha>'" message). The caller must
# call this function bare (uncaptured), then separately and only
# `eval "$(python3 scripts/ci.py print-outputs "$OUT_DIR/metrics.json")"` --
# that command is small, self-contained, and guaranteed to print nothing
# but the intended key='value' lines.
#
# Tolerates an author-app.sh or eval-skill-use.sh failure (no `set -e`) so
# the PR comment still shows *something* (ci.py print-outputs' own "no
# report"/"?" fallbacks) rather than the job aborting silently.
# author_and_evaluate_baseline is the strict sibling used by
# skill-eval-main-baseline.yml, where a failed baseline must never be
# cached or promoted.
#
# Usage: author_and_evaluate <cache_hit> <cached-dir> <plugin-dir> <out-dir> <scenario> <tarball>
#   cached-dir: only used when cache_hit is "true"; pass "-" otherwise.
#   tarball: also packages OUT_DIR into this path, so the caller doesn't
#     need a separate "Package skill-eval report" step.
author_and_evaluate() {
  local cache_hit="$1"
  local cached_dir="$2"
  local plugin_dir="$3"
  local out_dir="$4"
  local scenario="$5"
  local tarball="$6"

  if [ "$cache_hit" = "true" ]; then
    cp -r "$cached_dir" "$out_dir"
  else
    fetch_eval_harness || return
    install_harness_deps || return

    export SKILL_PLUGIN_DIR="$plugin_dir"
    bash ./eval-harness/eval_harness/app_builder/scripts/author-app.sh

    AUTHORED_ARTIFACT="$(pwd)/eval-harness" \
    SCENARIO="$scenario" \
    OUT_DIR="$out_dir" \
    PRD_SKILLS="$(pwd)/eval-harness/dataset/prd_skills.json" \
    bash ./eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh
  fi

  # Warn only: this function swallows failures on purpose (see above), and
  # ci.py print-outputs would fill the PR comment with "?" cells instead.
  if [ ! -f "$out_dir/metrics.json" ]; then
    echo "❌ skill-eval wrote no $out_dir/metrics.json -- this job's PR comment cells will all read '?'" >&2
  fi

  tar -czf "$tarball" "$out_dir" 2>/dev/null || true
}

# Runs author-app.sh then eval-skill-use.sh directly into OUT_DIR -- no
# tarball round-trip needed, since skill-eval-main-baseline.yml evaluates in
# the same job workspace it just authored in.
#
# Unlike author_and_evaluate, this DOES NOT tolerate an author-app.sh
# failure: if authoring fails, this fails, and every downstream step
# (manifest write, cache save, artifact upload) correctly gets skipped
# rather than caching a failed or incomplete baseline.
#
# Usage: author_and_evaluate_baseline <plugin-dir> <out-dir> <scenario>
author_and_evaluate_baseline() {
  (
    set -euo pipefail
    local plugin_dir="$1"
    local out_dir="$2"
    local scenario="$3"

    install_harness_deps

    export SKILL_PLUGIN_DIR="$plugin_dir"
    bash ./eval-harness/eval_harness/app_builder/scripts/author-app.sh

    AUTHORED_ARTIFACT="$(pwd)/eval-harness" \
    SCENARIO="$scenario" \
    OUT_DIR="$out_dir" \
    PRD_SKILLS="$(pwd)/eval-harness/dataset/prd_skills.json" \
    bash ./eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh

    [ -f "$out_dir/metrics.json" ] || {
      echo "❌ skill-eval wrote no $out_dir/metrics.json -- refusing to cache this baseline" >&2
      exit 1
    }
  )
}

"$@"
