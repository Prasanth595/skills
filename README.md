[![Expo](assets/expo.png)](https://docs.expo.dev/skills/)

# Expo Plugin

Official Expo skills and the Expo MCP connection for building, deploying, upgrading, and debugging Expo and React Native apps.

This repository is the plugin. `skills/` contains the instructions and supporting files; `mcp.json` connects compatible clients to Expo's hosted MCP server. The root `plugin.json` uses the portable [Agent Plugins format](https://agent-plugins.org/specification) for Codex and other compatible clients. Claude and Cursor use `.claude-plugin/plugin.json`; Grok uses the root manifest. `.mcp.json` supplies the connection for Claude, Cursor, and Grok.

## Installation

Use the Expo listing in your client's official directory. Directory releases are reviewed separately from this repository; a change here does not automatically update an installed plugin.

| Client | Installation and release status |
| --- | --- |
| Claude Code | `claude plugin install expo@claude-plugins-official` installs the currently approved release. |
| Codex | Open `/plugins` and install Expo from the OpenAI-curated directory. The currently approved release may differ from this source. |
| ChatGPT | This repository prepares the skills-plus-MCP package. ChatGPT publication and account testing are still pending. |
| Claude chat | The [Expo MCP connector](https://claude.com/marketplace/connectors/expo) is available separately. Publication of this skills-plus-MCP bundle for chat is still pending. |
| Grok Bot and Cursor | This repository prepares the package for directory submission. Publication and client testing are still pending. |

After installing a plugin with MCP, use the client's connection flow to sign in to Expo. A connector installed by URL supplies MCP tools; it does not install this repository's skills. Local project editing and device testing also require access to the project and the appropriate execution tools.

This repository no longer hosts marketplace catalogs. Older instructions using `/plugin marketplace add expo/skills`, `codex plugin marketplace add expo/skills`, or the deprecated plugin aliases do not apply to this layout. See the [publication and migration guide](https://github.com/expo/skills/blob/main/docs/publishing.md) for official listing updates.

### Skills only

Install selected skills with the [skills CLI](https://skills.sh/docs/cli), for example:

```text
npx skills@latest add expo/skills --skill expo-overview --skill expo-router
```

The CLI asks which agents to install into. Add `--agent <agent>` to choose one. To select all stable skills, use `npx skills@latest add https://github.com/expo/skills/tree/main/skills --skill '*'`. Pointing at `skills/` keeps maintainer and experimental skills out of discovery. Skills-only installation does not configure MCP. Follow the [Expo MCP setup guide](https://docs.expo.dev/eas/ai/mcp/) to connect it separately.

Update skills installed this way with `npx skills@latest update`. Plugins update through the directory where they were installed.

### Test the source locally

With Claude Code installed, load the repository as a plugin:

```bash
claude --plugin-dir /absolute/path/to/skills
```

For a reviewable ZIP containing the skills, assets, manifests, and MCP configuration:

```bash
bun scripts/check-plugin.ts
bun scripts/package-plugin.ts
```

The archive is written to `dist/`. These commands do not publish or upload it. See the [client testing guide](https://github.com/expo/skills/blob/main/docs/testing.md) before submission.

## Try it

- "Build a native-feeling Expo Router screen with tabs and animations."
- "Investigate why my latest EAS build failed."
- "Help me upgrade this app to the latest Expo SDK."
- "Check whether this EAS Update rollout is healthy."

Agents choose skills from the task and each skill's description. A skill can provide guidance in chat even when the tools needed to execute its commands are unavailable.

## Skills Included

Skills come in two groups so the free vs paid boundary is clear. Every services skill opens with a costs/plan-limits note.

### Start Here

Load this first for any Expo/EAS task, then route to the specific skill below.

| Skill | Use it for |
| --- | --- |
| `expo-overview` | Router and shared setup rules; the entry point when a request is vague or the user hasn't named a specific Expo tool. |

### Framework (open source)

Free, open-source Expo SDK and React Native skills.

| Skill | Use it for |
| --- | --- |
| `expo-project-structure` | Folder structure for a new Expo app: `src/` layout, routes-only `app/`, screens, server code, platform-specific files. |
| `expo-router` | Expo Router navigation: file-based routes, links, native stacks, modals, sheets, native tabs, and headers. |
| `expo-animation` | Polished React Native animations and gestures with Reanimated, Gesture Handler, Expo Router, and expo-haptics. |
| `expo-native-ui` | Native-feeling screen styling, semantic colors, controls, icons, media, and visual effects. |
| `expo-design-system` | In-app design systems: a token theme (color, spacing, typography, radius, shadow, motion), reusable component conventions, and design-system drift audits. |
| `expo-ui` | `@expo/ui` native components: universal cross-platform first, with SwiftUI and Jetpack Compose for platform-specific needs. |
| `expo-data-fetching` | API calls, React Query, SWR, caching, offline support, and Expo Router data loaders. |
| `expo-dom` | Expo DOM components for gradually using web code in native apps. |
| `expo-web-to-native` | Migrating an existing web/React app (Next.js, Vite, CRA) to a native iOS/Android app with Expo. |
| `expo-module` | Expo native modules and views with Swift, Kotlin, TypeScript, config plugins, and autolinking. |
| `expo-brownfield` | Adding Expo or React Native to an existing iOS or Android app. |
| `expo-dev-client` | Development clients (local builds are free; EAS Build/TestFlight is a paid step). |
| `expo-examples` | The `expo/examples` repo of `with-*` integrations to adapt or scaffold a new project from. |
| `expo-app-clip` | iOS App Clip targets, AASA files, associated domains, and Smart App Banners. |
| `expo-upgrade` | Expo SDK upgrades, dependency conflicts, deprecated packages, and cache cleanup. |

### Services & paid distribution

Skills whose core purpose uses paid Expo Application Services (EAS).

| Skill | Use it for |
| --- | --- |
| `eas-app-stores` | Build and submit iOS/Android apps: Expo and other React Native projects, plus existing native apps; TestFlight, profiles, versioning, and metadata. |
| `eas-hosting` | Deploying Expo websites and Expo Router API routes to EAS Hosting: secrets, custom domains, Cloudflare Workers. |
| `eas-workflows` | EAS Workflow YAML files and CI/CD automation. |
| `eas-observe` | EAS Observe setup and launch, route, event, and version metrics. |
| `eas-update` | EAS Update setup, OTA publishing, runtime compatibility, testing, and debugging. |
| `eas-update-insights` | EAS Update health, crash rates, launch counts, payload size, and rollout gates. |
| `eas-simulator` | Run and drive your app on a remote iOS simulator or Android emulator on EAS cloud - from the CLI or an agent, with a live browser preview (iOS only). |

### Experimental

Skills for Expo APIs that are not finalized. Content may change or be retired; skills graduate to the groups above when the underlying API stabilizes. They live in `experimental-skills/` and are excluded from the published Expo plugin. Install one explicitly with the skills CLI: `npx skills@latest add https://github.com/expo/skills/tree/main/experimental-skills/expo-migrate-module`.

| Skill | Use it for |
| --- | --- |
| `expo-migrate-module` | Migrating a Swift Expo module from the Modules API 1.0 definition DSL to the 2.0 macro API. |

## Expo MCP server

The package registers `https://mcp.expo.dev/mcp` using Streamable HTTP and Expo OAuth. This repository contains connection configuration, not the hosted server's implementation or deployment. Remote account operations and optional local development tools have different prerequisites; see [Expo MCP setup and capabilities](https://docs.expo.dev/eas/ai/mcp/).

`mcp.json` is the portable configuration. `.mcp.json` registers the same endpoint for native client loaders. The plugin uses a direct MCP connection and does not depend on an OpenAI app ID or an `.app.json` file.

## Execution and data

Installing this package does not run a setup hook or install dependencies. When a skill is used, the agent may fetch Expo documentation and GitHub examples, invoke package managers and Expo/EAS CLIs, edit project files, or call connected Expo MCP tools. Builds, submissions, deployments, and cloud simulator sessions use the selected Expo account and may consume plan resources. Skills do not grant additional access beyond the client's tools and permissions.

The EAS Workflows helper fetches workflow schemas from `api.expo.dev` and documentation from `raw.githubusercontent.com`. It caches responses in the system temporary directory, or `EXPO_SKILLS_CACHE_DIR` when configured. Other skill commands can download packages from npm and access the Expo, Apple, Google, and other services needed for the requested integration.

Feedback instructions use `npx --yes @expo/agent-cli@latest feedback`. The supplied category, subject, and report text are sent to Expo; include relevant context without secrets or unrelated private data. This package contains no background telemetry or automatic feedback hook. Data returned by MCP is also processed by the connected AI client under that provider's policies. See [Expo's privacy policy](https://expo.dev/privacy) and [MCP data privacy](https://docs.expo.dev/eas/ai/mcp/#data-privacy).

## Contributing and publishing

Read [CONTRIBUTING.md](https://github.com/expo/skills/blob/main/CONTRIBUTING.md) to add or update a skill. The [publication guide](https://github.com/expo/skills/blob/main/docs/publishing.md) describes packaging, pending review requirements, and the official directory handoff. Experimental skills, evaluation infrastructure, test fixtures, and maintainer documentation are excluded from the upload ZIP.

## License

[MIT](LICENSE)
