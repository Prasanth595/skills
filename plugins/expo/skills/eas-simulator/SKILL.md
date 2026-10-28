---
name: eas-simulator
description: "Compatibility entrypoint for explicit eas-simulator references. Use expo-simulators for new requests to run apps on remote/cloud iOS simulators or Android emulators."
version: 1.0.0
license: MIT
disable-model-invocation: true
---

# Expo Simulators (legacy skill name)

> **EAS service - costs apply.** Sessions count toward your account's pricing and limits. See https://expo.dev/pricing for current terms.

The canonical skill name is `expo-simulators`. This entrypoint preserves existing
`eas-simulator` installations and explicit references.

Read [the Expo Simulators workflow](./workflow.md) in full before running any
simulator commands, then follow it. Its relative `./references/` links resolve
here too. These files share the canonical implementation; this entrypoint also
works when installed on its own.

The CLI stays `eas simulator:*` / `npx --yes eas-cli@latest simulator:*`, and the
session config stays `.env.eas-simulator`.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes @expo/agent-cli@latest feedback --category skills --subject "eas-simulator" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an agent repeatedly fails at an Expo task or the user has to step in, submit a brief report of the task, expected result, and what went wrong using `--category evals` and the relevant Expo package or command as `--subject`.
