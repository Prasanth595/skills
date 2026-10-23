# Expo Plugin Repository

This repository is the official Expo plugin. It ships shared Agent Skills and a connection to Expo's hosted MCP server. Publish through the clients' official directories; this repository does not host marketplace catalogs or MCP server implementation code.

## Structure

```text
plugin.json                     # Portable Agent Plugins manifest
mcp.json                        # Portable MCP configuration (streamable-http)
.mcp.json                       # Native MCP configuration (http)
.claude-plugin/plugin.json      # Claude and Cursor manifest
skills/
  README.md                     # Stable skill index
  <skill-name>/
    SKILL.md
    references/                 # Optional supporting documentation
    scripts/                    # Optional reusable helpers
    agents/openai.yaml          # Codex trigger metadata
experimental-skills/            # Explicit opt-in skills, excluded from the plugin
assets/expo.png                  # Shared listing icon
README.md                       # Installation, skills, execution and data disclosure
CONTRIBUTING.md                  # Contribution guide
skills.sh.json                  # Stable and experimental catalog groups
docs/publishing.md              # Release handoff and source-layout migration
docs/testing.md                 # Manual client acceptance cases
scripts/                        # Validation, packaging, evaluation tooling
tests/                          # Maintainer fixtures, excluded from upload ZIP
```

`skills/` is the only stable skill root. Keep experimental skills outside it until their API is ready. Do not introduce a second plugin wrapper or restore root marketplace catalogs without an explicit distribution requirement.

## Manifests and MCP

- Keep the name `expo`, version, description, author, repository, and license consistent across both manifests. Version changes must exceed the base branch's version. `bun scripts/check-plugin-version-bump.ts --set-version <version>` updates them together.
- Root `plugin.json` follows Agent Plugins 1.0.0. Its schema is closed: the permitted top-level fields are `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, and `extensions`. It discovers `skills/` and `mcp.json` implicitly; do not add native `skills`, `mcpServers`, or `displayName` fields to it.
- OpenAI listing metadata lives only under `extensions.com.openai.interface` in the portable manifest. Do not restore separate Codex, Cursor, or Grok manifests.
- Codex and other Agent Plugins clients load `plugin.json` and `mcp.json`. Claude loads `.claude-plugin/plugin.json` and `.mcp.json`. Cursor falls back to the Claude manifest and reads `.mcp.json` before `mcp.json`; Grok uses the root manifest and `.mcp.json`. Claude and Cursor discover `skills/` by default; keep explicit `skills` and `mcpServers` overrides out of the Claude manifest. Keep any component paths relative to the plugin root.
- Both MCP files must register the same `expo` endpoint, `https://mcp.expo.dev/mcp`. The transport names differ by schema: `streamable-http` in `mcp.json`, `http` in `.mcp.json`.
- Do not include credentials, OAuth tokens, `.app.json`, local hooks, or reviewer-account secrets in a public package. Expo uses the direct MCP submission route.
- Directory publication, publisher/domain verification, authenticated testing, and hosted server updates happen outside this repository. Never claim a local validation proves directory approval or authenticated runtime compatibility.

## Skill conventions

Each `SKILL.md` has YAML frontmatter:

```markdown
---
name: expo-example
description: What the skill does and when to use it.
version: 1.0.0
license: MIT
---

# Example
```

- Use kebab-case names up to 64 characters: `expo-*` for open-source framework guidance, `eas-*` for paid EAS services.
- Descriptions must explain natural triggers and stay under 1024 characters. Keep the body under 500 lines.
- Paid skills open with a costs/plan-limits callout. See `CONTRIBUTING.md` for the free/paid boundary.
- Keep detailed material in nearby `references/`; reusable code belongs in `scripts/`. Reference packaged files with relative paths.
- Preserve each skill's scope and trigger intent. Avoid broad unrelated rewrites.
- Include `agents/openai.yaml` with the display name, short description, and prompt using `$<skill-name>`.
- Before execution, use the shared guidance in `skills/expo-overview/references/execution-environments.md`. Check actual client tools, project access, and authentication; a connected MCP server does not imply a local terminal or CLI login.
- Keep the canonical feedback footer. Run `bun scripts/check-skill-limits.ts --fix-feedback`; CI verifies the subject matches the skill name.
- Use MIT licensing and `@expo.io` or `@expo.dev` author addresses.

## Adding a skill

1. Follow `CONTRIBUTING.md`; create `skills/<skill-name>/SKILL.md` and focused supporting files.
2. Add its Codex metadata and canonical feedback footer.
3. Register it in `skills.sh.json`, `skills/README.md`, and `README.md`.
4. Add an entry to the `expo-overview` Skill Map. CI checks both missing and dangling routes.
5. Bump both plugin versions together and validate the installed package, not just the source files.

For an experimental API, use `experimental-skills/<skill-name>/` and the Experimental catalog group instead. Keep it out of the stable overview map and upload ZIP until graduation.

## Validation and packaging

```bash
bun test scripts/
bun scripts/check-skill-limits.ts
bun scripts/check-overview-routing.ts
bun scripts/check-plugin-version-bump.ts origin/main
bun scripts/check-plugin.ts
claude plugin validate .
bun scripts/package-plugin.ts
```

Run relevant helper checks when changing a bundled script. Native fixtures need their documented toolchain; paid EAS evaluations are separate from offline validation.

The package script uses an explicit allowlist, preserves source bytes, validates an extracted ZIP, and refuses to overwrite an existing archive. Keep experiments, caches, credentials, test fixtures, maintainer tooling, and generated archives out of it. Packaging must never submit to a directory.

For evaluation infrastructure, use `bash scripts/ci.sh fetch_eval_harness` to obtain the pinned private harness in ignored `eval-harness/`. Do not commit a submodule or downloaded checkout. Baseline extraction and version checks must support both the former `plugins/expo` layout and the repository-root layout during migration.

See `docs/publishing.md` for external catalog updates. Official listings still pointing to `plugins/expo` need a source-path and revision update before adopting this release; keep the existing pinned versions available while that review happens.

## Commit and PR conventions

- Commit messages are a single lowercase-leading line, with no conventional prefix or body.
- Use PR titles such as `[plugins] move Expo to a repository-root plugin`.
- Never add AI co-author trailers or credits.
