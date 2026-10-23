# Publishing the Expo plugin

Requirements checked on October 23, 2026. This guide prepares a release; it does not record a submission, approval, or publication. Check the linked platform requirements again before publishing.

## Package and server ownership

The repository root is the `expo` plugin. Version 2.0.0 moves the shared skills, assets, and MCP configuration out of `plugins/expo`. `plugin.json` and `mcp.json` use [Agent Plugins 1.0.0](https://agent-plugins.org/specification). The repository retains only the portable manifest and `.claude-plugin/plugin.json`, preserving the manifest consolidation merged in [PR #139](https://github.com/expo/skills/pull/139). Codex loads the portable pair; Claude and Cursor use the Claude manifest with `.mcp.json`; Grok uses the root manifest with `.mcp.json`. Portable MCP uses `streamable-http`; `.mcp.json` uses the native `http` spelling for the same Expo endpoint. [Cursor supports both formats](https://cursor.com/docs/reference/plugins).

All 23 production skills live in `skills/`. `experimental-skills/` is outside component discovery and excluded from the release ZIP. A repository-based directory can still inspect files outside the discovered components.

This repository declares a connection to `https://mcp.expo.dev/mcp`. It contains no MCP server implementation or deployment. Server releases, OAuth configuration, domain verification, and service operations belong to the Expo MCP service owners. Expo documents [Streamable HTTP, OAuth, and the difference between remote and local capabilities](https://docs.expo.dev/eas/ai/mcp/).

An OpenAI `apps` / `.app.json` declaration references a registered integration by ID; an MCP declaration supplies the server connection. Either can accompany skills. This package uses a direct MCP connection. Public OpenAI ZIP submissions currently exclude app references and hooks. [OpenAI packaging reference](https://developers.openai.com/plugins/build/plugins)

## Build the release candidate

Install Bun and Python 3, with `bun` and `python3` on `PATH`. The version check also needs Git and an available `origin/main` reference. Run from the repository root:

```sh
bun scripts/check-skill-limits.ts
bun scripts/check-overview-routing.ts
bun scripts/check-plugin-version-bump.ts origin/main
bun scripts/check-plugin.ts
bun scripts/package-plugin.ts
```

The default archive is `dist/expo-plugin-2.0.0.zip`; an explicit destination uses `bun scripts/package-plugin.ts --output /absolute/path/expo-plugin.zip`. Use the package script rather than archiving the entire checkout. Keep generated archives out of Git. Record the source commit, archive checksum, and check output with the release candidate.

Complete [client testing](testing.md) against that exact candidate. Passing repository checks does not establish successful OAuth, available MCP tools, skill quality, or directory acceptance.

## Migration and existing listings

The root marketplace catalogs are intentionally removed. This repository now distributes one plugin through external directories. The old `plugins/expo` path and repository-as-marketplace commands, including `/plugin marketplace add expo/skills` and `codex plugin marketplace add expo/skills`, do not describe version 2.0.0. Deprecated aliases are no longer maintained here.

Before advancing any official listing to this release:

- Change a source path of `plugins/expo` to the repository root. Check every external catalog's source, branch, version, and commit pin, including the [Claude official catalog](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json) and [OpenAI catalog](https://github.com/openai/plugins/blob/main/.agents/plugins/marketplace.json). A package release does not rewrite those records.
- Coordinate existing listing identities with their owners. Preserve the stable plugin name `expo`; do not create duplicate listings to work around an inaccessible publisher account.
- Update Expo's installation documentation and links that still use the nested directory or this repository's old marketplaces. Existing directory releases can remain pinned until their replacement has passed testing.
- Reconcile overlapping work in [PR #219](https://github.com/expo/skills/pull/219) and the ChatGPT runtime/package changes in PRs [#222](https://github.com/expo/skills/pull/222) through [#237](https://github.com/expo/skills/pull/237). Carry forward reviewed skill improvements at their new paths. This structural migration does not supersede those reviews or platform scan findings.

## ChatGPT and Codex

Prepare the ZIP for the shared OpenAI directory using **With MCP**. The current public catalog is a separate distribution source; changing this repository cannot remove a `CODEX`-only product restriction or update a copied package. Confirm ChatGPT eligibility and the exact published skill/MCP contents with the listing owner.

Use root `extensions.com.openai.interface` as the single source of OpenAI listing metadata. No Codex overlay is shipped. Verify the short description, starter prompts, icons, support, privacy, terms, and website links with the validator. [Package reference](https://developers.openai.com/plugins/build/plugins)

The publisher must resolve the following in the [OpenAI submission portal](https://platform.openai.com/apps):

1. Select Expo's verified publishing organization and confirm access to the existing listing. Adding MCP to an existing skills-only submission is currently unsupported; agree on the migration with OpenAI before creating another listing.
2. Upload the complete candidate through **With MCP**, connect the HTTPS endpoint, verify domain ownership, and complete OAuth and the tool scan.
3. Supply dedicated reviewer access through the secure portal, an accessible demonstration video, and five positive plus three negative test cases. [Testing](testing.md) contains a draft plan, not executed evidence. Keep credentials and private reviewer instructions out of Git and manifests.
4. Resolve required findings, confirm product availability, and request review. Publication is a later explicit action after approval.

Package/skill changes require a new ZIP; hosted-tool changes follow the MCP scan process. [Submission requirements](https://developers.openai.com/plugins/deploy/submission)

## Claude chat, Cowork, and Claude Code

Use the existing Expo publishing organization in the [Claude directory portal](https://claude.ai/directory/manage). The bundle source is `expo/skills`, the plugin path is empty for the repository root, and the tracked branch or release tag must contain the reviewed candidate. Keep `.claude-plugin/plugin.json`, `skills/`, and `.mcp.json` together. Enable the intended chat, Cowork, and Code listings in the publisher settings. [Plugin submission](https://claude.com/docs/plugins/submit)

Expo already documents a remote Claude connector. Confirm ownership of that connector, keep its endpoint identical, and pair it with the plugin bundle under the same organization. A connector-only listing does not include skills. Do not create a second connector for this structural change. [Bundle and connector pairing](https://claude.com/docs/directory/publish)

Run `claude plugin validate .` when Claude Code is installed. The directory performs additional checks on the repository: regular files, portable names, README and license, declared connections, readable code, and file limits. Avoid root dependency lockfiles that cause installation, and do not use `.gitattributes` export filters to hide release content. Because the plugin is now the repository root, the directory can inspect development files too. Record any holds instead of claiming the ZIP allowlist avoids them. [Pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)

Confirm the connector's OAuth behavior and plugin loading in Claude chat before requesting review. Configure tracked updates deliberately; do not enable automatic publication as part of preparing this repository.

## Grok Bot and Cursor

Use the public repository URL, `https://github.com/expo/skills`, in the [Grok Bot/Cursor submission form](https://x.ai/bot/marketplace/submit-a-plugin). Request both destinations and explicitly identify the root package with skills and MCP. An endpoint-only submission does not establish skill distribution. Grok Build uses the root `plugin.json` and `.mcp.json`; its [official marketplace](https://github.com/xai-org/plugin-marketplace) is a separate integration with its own source and commit pin.

The form requests publisher contact/organization details, a public square SVG or PNG logotype with a background, a description, testing instructions, and confirmation that the plugin worked locally and in-app. Supply that confirmation only after recording the tests. Verify the reviewed version and all skills in each resulting catalog. Grok Bot supports [plugins and packaged skills](https://docs.x.ai/grok-bot/settings-and-notifications); its availability must be tested separately from Cursor.

## Why this structure

[Vercel](https://github.com/vercel/vercel-plugin) and [Cloudflare](https://github.com/cloudflare/skills) keep shared skills, MCP configuration, and client manifests at the repository root. Both also retain marketplace catalogs; removing Expo's catalogs is a deliberate distribution decision, not a requirement copied from them.

[Stripe](https://github.com/stripe/ai) uses client packages inside a broader repository. [Sentry](https://github.com/getsentry/sentry-for-ai) generates client distributions from shared source and [checks links in the built output](https://github.com/getsentry/sentry-for-ai/blob/main/scripts/validate-built-links.sh). Expo keeps one package because its shared skills and remote MCP need no client-specific build. Validate the shipped artifact as well as the source checkout.
