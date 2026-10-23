# Contributing

- Use your skills locally first to build something meaningful before contributing.

## Adding a new skill

Skills teach an agent how to do one Expo task well. Follow these guidelines so new
skills stay consistent with the rest of the plugin.

### 1. Scaffold it with `skill-creator`

From Claude Code, run the `/skill-creator` skill to scaffold a new skill - and to edit, optimize,
or eval an existing one. It sets up the folder structure and helps you tune the `description` for
reliable triggering.

Skills live one level deep:

```
skills/<skill-name>/
  SKILL.md            # required
  references/         # optional, loaded on demand
  scripts/            # optional, reusable logic
  agents/openai.yaml  # Codex trigger metadata
```

### 2. Name it `expo-*` or `eas-*`

Names are lowercase kebab-case (max 64 chars). The prefix signals the free/paid boundary:

- **`expo-*`** - open-source framework skills: the Expo SDK, Expo Router, React Native, and
  local tooling. Examples: `expo-router`, `expo-dom`, `expo-module`, `expo-web-to-native`.
- **`eas-*`** - skills whose core purpose is a paid Expo Application Services product.
  Examples: `eas-hosting`, `eas-app-stores`, `eas-workflows`, `eas-observe`, `eas-simulator`.

Name after what users say, and prefer the real product or package name (e.g. `eas-hosting`,
not `expo-api-routes`). To rename an existing skill, `git mv` the directory (to preserve
history), update the frontmatter `name:`, and fix every reference (catalogs, `agents/openai.yaml`,
cross-links in other skills).

### 3. Decide free vs paid - and be strict about it

A skill belongs in **Services & paid distribution** only if its **core purpose requires a paid
EAS product** (EAS Build, Submit, Hosting, Update, Workflows, Observe, Simulator, …).

- A paid **Apple Developer or Google Play** account does **not** make a skill "paid" here - that
  is app-store distribution, not EAS. `expo-app-clip` is a framework skill even though shipping a
  Clip needs an Apple account.
- If authoring is free and only *deploying* is paid, it is usually still framework - unless the
  skill is fundamentally about the paid service. (`eas-hosting` is the deploy skill, so it is
  paid; free API-route authoring lives inside it.)
- Litmus test: *can a developer get the main value of this skill without paying Expo?*
  Yes → framework (`expo-*`). No → paid (`eas-*`).

### 4. Add a costs note for paid skills

Paid skills open the `SKILL.md` **body** with a short callout:

```markdown
> **EAS service - costs apply.** <one line on what consumes the plan>. See https://expo.dev/pricing.
```

### 5. Write a description that triggers well

The `description` is how an agent decides to load the skill, so it matters more than any other field.

- **Max 1024 characters** (CI-enforced).
- Say **what it does** *and* **when to use it**, in the words users actually type ("turn a website
  into an app", "run on a cloud simulator", "ship to TestFlight").
- Use concrete package, command, and API names (`@expo/ui`, `eas deploy`, `+api.ts`) - but don't
  keyword-stuff with unrelated terms.
- When a sibling skill is easy to confuse with, add a `Not for …` clause (see `expo-ui` vs
  `expo-router`).

### 6. Keep it concise - context windows are the constraint

When a skill triggers, its whole `SKILL.md` loads into the agent's context. Shorter is better.

- The body is capped at **500 lines** (CI-enforced) - treat that as a ceiling, not a target.
- Move anything the agent needs only *sometimes* into `references/*.md` and link to it; references
  load on demand.
- Put reusable validation or fetching logic in `scripts/` instead of long inline command blocks.
- One skill = one job. If it grows two distinct triggers, split it (that is why `eas-hosting` and
  `eas-app-stores` are separate skills).
- Keep skills and references focused on requirements, supported workflows, and instructions.
  Put test results and validation history in fixture READMEs or PR descriptions.

### 7. Add the Codex agent file

Add `agents/openai.yaml` with `display_name`, `short_description`, and a `default_prompt`
that references the skill via `$<skill-name>`.

### 8. Register the skill in every catalog

Add it to the correct group (framework vs paid) in all of:

- `skills.sh.json`
- `skills/README.md`
- `README.md`

Also add a one-line entry to the `expo-overview` Skill Map
(`skills/expo-overview/SKILL.md`) so the router can dispatch to the new skill.
The `check` workflow (`bun scripts/check-overview-routing.ts`) enforces this.

### 9. Add the feedback instructions

Every `SKILL.md` ends with a canonical feedback block whose subject matches the skill name. Add or
refresh it automatically:

```bash
bun scripts/check-skill-limits.ts --fix-feedback
```

CI fails if the block is missing, has drifted, or names the wrong skill.

### 10. Bump the plugin version

Bump `version` in **both** manifests together - they must match each other and be greater
than `main`. CI enforces this.

- `plugin.json` - the portable Agent Plugins manifest for Codex, other compatible clients, and Grok.
- `.claude-plugin/plugin.json` - the Claude and Cursor manifest.

The check script writes both for you, rejecting a version that is not valid semver or is not
greater than the base ref:

```bash
bun scripts/check-plugin-version-bump.ts --set-version <next-version>
```

Run it with `--help` for the full usage, or `bun test scripts/check-plugin-version-bump.test.ts` to exercise
the version rules in disposable repositories.

The root `plugin.json` is the portable manifest. Keep shared metadata synchronized with the Claude manifest; `check-plugin.ts` detects drift. OpenAI listing metadata lives only under `extensions.com.openai.interface`. Codex and other Agent Plugins clients load `mcp.json`, which uses `streamable-http`; Claude, Cursor, and Grok load `.mcp.json`, which uses `http` for the same Expo endpoint. Do not restore separate Codex, Cursor, or Grok manifests.

### 11. Validate before opening a PR

```bash
claude plugin validate .
bun scripts/check-plugin.ts
bun scripts/check-skill-limits.ts
bun scripts/check-overview-routing.ts
bun scripts/check-plugin-version-bump.ts origin/main
```

Run `bun test scripts/` for script changes and `bun scripts/package-plugin.ts` to validate the extracted upload package. Packaging preserves source bytes and does not upload anything. See [docs/publishing.md](docs/publishing.md) for the external release handoff.

Also run `python3 -m json.tool <file>` on any JSON you edited, and if the skill ships `scripts/`,
run that skill's own validation.

`check-skill-limits.ts` enforces more than the size caps: the naming rule (step 2), the paid
costs callout (step 4), the Codex agent file (step 7), the `skills.sh.json` grouping (step 8),
and the feedback block (step 9) all fail CI when violated.

### Syncing `expo-animation`

`expo-animation` mirrors `skills/animate-expo` from `emilkowalski/skills`. Pull upstream changes
with `bun scripts/sync-animate-expo.ts`; use `--check` to detect drift without writing. The script
preserves this repository's skill name, collaboration notice, execution guidance, and feedback block.

### Conventions

- MIT license for every skill; use `@expo.io` or `@expo.dev` author emails.
- Keep `references/` next to the skill that uses them.
- Don't broaden a skill's scope or trigger intent when editing it - keep changes focused.

## Runnable brownfield fixtures

Use the [iOS brownfield playgrounds](tests/fixtures/expo-brownfield/README.md) to exercise integrated and isolated SwiftUI hosts when changing `expo-brownfield`. They include SDK 55 and SDK 57 dependency snapshots, setup commands, and a Debug/Release acceptance checklist. Native validation requires the selected SDK's Xcode toolchain; these fixtures are not part of the distributed plugin.

## Chat and coding-agent support

Keep instructions usable with the tools exposed by the current client. Before project or account execution, link to the shared [execution environment guidance](skills/expo-overview/references/execution-environments.md). Keep these links relative so they work in the installed package. Do not assume that a chat session has a checkout, terminal, native SDKs, or EAS CLI credentials just because MCP is connected. Client-specific execution improvements should include the manual cases in [docs/testing.md](docs/testing.md).

## Experimental skills

Keep unstable API guidance in `experimental-skills/<skill-name>/`, with no separate plugin manifest. Register it in the Experimental catalog group and the root README. Run the same metadata, feedback, and size checks. Graduation into the stable plugin requires moving it to `skills/` and adding it to the stable index and overview router.

## Evaluation infrastructure

The private evaluation harness is maintainer tooling and is not a plugin dependency. Follow the pinned setup in `scripts/setup-eval-harness.sh` when running evaluations; do not add a Git submodule or commit the downloaded checkout. Paid cloud evaluations are separate from the offline packaging checks.
