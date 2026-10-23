---
name: eas-workflows
description: Helps understand and write EAS workflow YAML files for Expo projects. Use this skill when the user asks about CI/CD or workflows in an Expo or EAS context, mentions .eas/workflows/, or wants help with EAS build pipelines or deployment automation.
allowed-tools: "Read,Write,Bash(node:*),Bash(npx *eas-cli@*)"
version: 1.0.1
license: MIT License
---

# EAS Workflows Skill

> **EAS service - costs apply.** EAS Workflows run on Expo Application Services, a paid product with free-tier limits. Each workflow job consumes your plan's build/compute minutes, and jobs that build or submit also need paid Apple Developer and Google Play accounts. Review https://expo.dev/pricing before triggering runs.

Help developers write and edit EAS CI/CD workflow YAML files.

Use project/terminal or matching MCP tools when available; otherwise provide instructions and identify unexecuted steps. If `expo-overview` is installed, read its [execution guidance](../expo-overview/references/execution-environments.md) before acting.

## Reference Documentation

Fetch these resources before generating or editing workflow files, or when answering syntax questions. Use an available web/documentation tool, or the Node.js helper below when a terminal is available. Resolve the helper relative to this installed skill; it caches responses in the system temporary directory (override with `EXPO_SKILLS_CACHE_DIR`). In MCP-only sessions, inspect the exposed workflow documentation/creation tool and use its current syntax guidance. If no source can be fetched, label any proposed YAML as unverified.

```bash
# Fetch resources
node <skill-dir>/scripts/fetch.js <url>
```

1. **JSON Schema** — https://api.expo.dev/v2/workflows/schema
   - Fetch this schema when writing or checking YAML with local or web tools; MCP-only sessions use the available workflow tools and their validation
   - Source of truth for the workflow YAML structure; EAS CLI remains the authoritative final validator
   - All job types and their required/optional parameters
   - Trigger types and configurations
   - Runner types, VM images, and all enums

2. **Syntax Documentation** — https://raw.githubusercontent.com/expo/expo/refs/heads/main/docs/pages/eas/workflows/syntax.mdx
   - Overview of workflow YAML syntax
   - Examples and English explanations
   - Expression syntax and contexts

3. **Pre-packaged Jobs** — https://raw.githubusercontent.com/expo/expo/refs/heads/main/docs/pages/eas/workflows/pre-packaged-jobs.mdx
   - Documentation for supported pre-packaged job types
   - Job-specific parameters and outputs

Do not rely on memorized values; these resources evolve as new features are added.

## Workflow File Location

Workflows live in `.eas/workflows/*.yml` (or `.yaml`). Each file must be 16 KiB or smaller.

## Top-Level Structure

A workflow file has these top-level keys:

- `name` — Display name for the workflow
- `on` — Triggers that start the workflow (at least one required)
- `jobs` — Job definitions (required)
- `defaults` — Shared defaults for all jobs
- `concurrency` — Control parallel workflow runs

Consult the schema for the full specification of each section.

## Expressions

Use `${{ }}` syntax for dynamic values. The schema defines available contexts:

- `github.*` — GitHub repository and event information
- `inputs.*` — Values from `workflow_dispatch` inputs
- `needs.*` — Outputs and status from dependent jobs
- `jobs.*` — Job outputs (alternative syntax)
- `steps.*` — Step outputs within custom jobs
- `workflow.*` — Workflow metadata

## Generating Workflows

When generating or editing workflows:

1. Fetch the schema or use current guidance from the connected workflow tool for job types, parameters, and allowed values
2. Validate that required fields are present for each job type
3. Verify job references in `needs` and `after` exist in the workflow
4. Check that expressions reference valid contexts and outputs
5. Ensure `if` conditions respect the schema's length constraints

## Validation

With a terminal and the intended project, validate each generated or edited workflow with EAS CLI from the Expo project root:

```sh
npx -y eas-cli@latest workflow:validate .eas/workflows/<workflow.yml> --non-interactive
```

Run the command separately for each changed workflow file. It requires a logged-in EAS CLI session and a linked Expo project. Unlike schema-only validation, it also checks build profile references against the project's `eas.json` and performs EAS server-side validation. Fix every reported error and rerun the command until it prints `Workflow configuration YAML is valid.` A local YAML or JSON Schema validator alone does not establish EAS validation.

In an MCP-only session, use the exposed workflow validation tool with the target project and generated YAML, following its current input schema. Report the checks and result it actually returns; do not claim that a file was written to an unavailable checkout. If neither EAS CLI nor a suitable MCP validator is available, return the proposed YAML and this command as the remaining validation step.

To run an existing workflow through MCP, use the requested project, file, and Git reference with the available workflow-run tool. The file must already exist at that reference. Check the resulting run status using the exposed workflow info/log tools; creating YAML in chat does not commit it or start a run.

## Answering Questions

When users ask about available options (job types, triggers, runner types, etc.), fetch the schema and derive the answer from it rather than relying on potentially outdated information.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes @expo/agent-cli@latest feedback --category skills --subject "eas-workflows" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an agent repeatedly fails at an Expo task or the user has to step in, submit a brief report of the task, expected result, and what went wrong using `--category evals` and the relevant Expo package or command as `--subject`.
