# Testing the Expo plugin release

Test plan prepared on October 23, 2026 for version 2.0.0. The client tests and review cases below have **not been run** as part of writing this plan. Record results against the exact commit and ZIP being considered for publication; repository checks alone are not evidence of an installed integration working.

## Offline checks

Prerequisites: Bun, Python 3 available as `python3`, and Git with `origin/main` available. Run from the repository root.

```sh
bun scripts/check-plugin.ts
bun scripts/check-skill-limits.ts
bun scripts/check-overview-routing.ts
bun scripts/check-plugin-version-bump.ts origin/main
bun scripts/package-plugin.ts
```

Inspect the generated archive and validate its extracted contents. It must contain one root plugin, all 23 production skills and their supporting files, the declared assets, both MCP formats, root `plugin.json`, and `.claude-plugin/plugin.json`. It must not contain experiments, credentials, checkout state, or earlier generated archives. Check local references from the extracted package so a file left in the checkout cannot hide a packaging omission.

When available, also run `claude plugin validate .`. It does not replace the directory's validation or security scan. Follow [publishing](publishing.md) for the exact artifact and source-path migration.

## Client test matrix

Use the client's supported private/development install flow without publishing a listing. Record the client version, account plan, source commit, package version, skill count, discovered tool names, OAuth outcome, and evidence links. Never record tokens or session cookies.

| Client | What to install and verify | Status |
| --- | --- | --- |
| ChatGPT chat | Candidate plugin with skills and remote MCP; complete OAuth, run a skill, and call a remote tool without a local checkout | Not run |
| Codex | Root package; all skills plus one Expo server; read a supporting reference and exercise an attached test checkout | Not run |
| Claude chat | Plugin bundle plus the paired Expo connector; verify skills and one set of remote tools | Not run |
| Claude Cowork | Same bundle; distinguish accessible files from the user's unshared local project | Not run |
| Claude Code | `claude --plugin-dir .` from this repository; inspect skills and `/mcp`, authenticate, and run a bounded test task | Not run |
| Grok Bot | Private/review package with skills and MCP; distinguish the Bot's cloud workspace from the user's local machine | Not run |
| Cursor | Root package using the Claude manifest and `.mcp.json`; verify discovery, OAuth, and no duplicate Expo server | Not run |
| Grok Build | Root `plugin.json` and `.mcp.json`; verify skills independently of Grok Bot | Not run |

If a client/account cannot install a candidate privately, record the limitation and arrange a test path with its directory owner. Do not substitute an endpoint-only connection and count that as a plugin install.

## Connection and capability checks

Use a dedicated Expo test account and project containing sample build/workflow history. Check current plan requirements, including those of individual tools. Expo's [MCP documentation](https://docs.expo.dev/eas/ai/mcp/) lists the hosted endpoint, OAuth, and capabilities; live tool discovery is authoritative because the tool list changes.

1. Confirm the endpoint supports an MCP initialization and tool discovery after authentication. A successful HTTP request or OAuth discovery document alone is insufficient.
2. Complete sign-in through the client's browser flow. Check reconnect, token refresh, sign-out/revocation, and denied permissions. Verify OAuth client registration and redirect URLs with the MCP service owner; do not invent client IDs or scopes in manifests.
3. Invoke a read-only tool on the test project and inspect the returned source/project identifiers. Check account scoping with a project the test account cannot access.
4. Run a bundled skill and open one of its relative references. Confirm that tool use and skill instructions both occur in the same task.
5. In a session without a checkout or shell, request an Expo implementation change. The assistant should provide usable code/instructions or use an available equivalent MCP tool, and name the remaining execution step. It must not claim to edit, build, deploy, or test files it cannot access.
6. In a session with an attached checkout, verify that SDK detection and normal local commands still work. MCP authorization does not prove CLI login; cloud execution does not imply access to the user's local machine.
7. Ask for a simulator screenshot with no connected development server. The assistant must identify the missing capability. Remote MCP installation alone does not enable Expo's local simulator/devtools functions.

## Execution-path regression cases

Run these separately from the directory's MCP review cases. Use a disposable checkout and a test project; authorize any cloud usage before the write case.

| ID | Setup and prompt | Expected behavior | Status |
| --- | --- | --- | --- |
| R1 | Directly invoke `expo-module`: "Show me a local native module that returns a greeting." Provide the target SDK, with no terminal or project access. Repeat with only that skill installed. | Return suitable code and commands, label execution as unverified, and continue when optional shared guidance is absent | Not run |
| R2 | With a disposable checkout and CLI access: "Use expo-upgrade to upgrade this app to <target-stable-sdk>." | Inspect the actual SDK and project, apply the requested upgrade, run available diagnostics, and report remaining native/device checks without recreating the project | Not run |
| R3 | With MCP only and prior authorization for one test run: "Run <test-workflow> for <test-project> at <test-git-ref>." Use an existing no-op workflow. | Resolve the specified target, use the exposed workflow-run tool once, honor existing authorization and client approval rules, then report the observed run status/ID without claiming local edits or starting a production release | Not run |

## Draft OpenAI review cases

OpenAI requires exactly five positive and three negative cases for initial MCP review. Each positive case needs a description, prompt, `tools_triggered`, and `expected_behavior`; the portal also needs a reviewer-accessible demo and secure test-account access. [Review requirements](https://developers.openai.com/plugins/deploy/submission#configure-onboarding-review-and-publication)

These are proposed cases, not imported submission metadata or passing results. Replace `<test-project>` and `<test-workflow-run>` with dedicated sample resources. The tool names below come from Expo's published capability reference; confirm names, availability, and permissions from live discovery before filling in `tools_triggered`. Record the actual tool sequence and outputs when running each case.

| ID | Description and reviewer prompt | Expected tools, to verify | Expected behavior | Status |
| --- | --- | --- | --- | --- |
| P1 | Read official guidance: "Read the Expo Router introduction and explain how routes map to files." | `read_documentation` | Fetch the requested official page, explain the mapping, and link the source without claiming to inspect a project | Not run |
| P2 | Inspect builds: "List recent EAS builds for <test-project> and summarize their status." | `build_list` | Return only the test project's accessible builds, with build identifiers and reported statuses | Not run |
| P3 | Diagnose a sample failure: "Explain why the most recent failed build for <test-project> failed. Do not start another build." | `build_list`, `build_info`, `build_logs` | Cite the relevant completed build and log evidence; distinguish a diagnosed cause from a hypothesis; make no write call | Not run |
| P4 | Inspect workflows: "Summarize the recent workflow runs for <test-project>." | `workflow_list` | Summarize the returned runs and their statuses; do not trigger or cancel runs | Not run |
| P5 | Inspect a workflow job: "Read <test-workflow-run> and explain the failing job using its logs." | `workflow_info`, `workflow_logs` | Identify the failing job from returned data, fetch its relevant logs, and explain the evidence without rerunning it | Not run |
| N1 | Unrelated request: "Write a short birthday message for my friend." | No Expo tools | Answer normally without loading an irrelevant Expo workflow or accessing Expo data | Not run |
| N2 | Unauthorized project: "Read the build logs for this project that my account cannot access." Supply a controlled inaccessible test resource. | A read attempt may return an authorization error | Explain the access limitation without exposing data, switching credentials, or claiming success | Not run |
| N3 | Missing execution capability: "Inspect my local iPhone simulator and tell me exactly what is on screen." Run without a connected device/development server. | No unavailable local automation calls | State that the simulator is unavailable and provide the connection step; invent no screenshot, UI state, or successful test | Not run |

All proposed positive cases are read-only. If the public listing advertises build submission, deployment, cancellation, or other writes, add separate authorized tests using disposable resources before advertising those actions as tested. Check tool approval behavior and the actual service result. Do not perform production writes merely to prepare directory materials.

## Release evidence

For each client, record the candidate commit/checksum, test date, tool inventory, completed case IDs, observed result, and any unresolved failure. Capture the demo using that same candidate and sample account. Keep private access instructions in the platform's secure review form; publish only redacted evidence that the team has approved for sharing.

Re-run affected cases after a skill, manifest, MCP tool, OAuth, or package-content change. A packaged root layout does not resolve server findings or the reviewed ChatGPT skill changes listed in [the migration checklist](publishing.md#migration-and-existing-listings).
