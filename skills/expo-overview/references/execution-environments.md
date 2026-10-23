# Working in coding agents and chat clients

Check capabilities before executing project or account actions. A plugin installation supplies instructions and an MCP connection; it does not by itself provide the user's checkout, a terminal, Expo CLI credentials, or a running device.

## Choose the available path

- **Project files and a terminal are available:** inspect the actual project and SDK, then follow the skill's commands. Run commands in the user's project, not the plugin installation. Check the installed CLI's help when flags differ.
- **Expo MCP tools are available:** inspect their current descriptions and required arguments. Use the matching connected tool for account data or remote actions. Tool names and capabilities can vary by client and account; do not invent tools or call an unrelated tool as a substitute.
- **Only chat or read-only files are available:** provide the requested explanation, code, configuration, or commands. Ask for the specific project details needed to make advice accurate. State which steps still need to be applied or run in the user's development environment.

A chat client's terminal can be an isolated cloud sandbox. Check whether it contains the intended project and required tooling before treating it as the user's machine. A remote MCP connection can work without that checkout. Apply the command steps in a skill only when their execution prerequisites hold; otherwise follow the MCP or guidance path above.

## Connect to Expo

Use the client's connection or authentication flow for the `expo` MCP server at `https://mcp.expo.dev/mcp`. OAuth access to MCP and CLI login are separate: a connected plugin does not imply that `eas whoami` will succeed in a terminal. Never copy MCP tokens into CLI commands or ask for credentials in chat.

Resolve the Expo account and target project from the request, accessible configuration, or tool results. For an existing project, do not scaffold, relink with `eas init`, or create a replacement merely because local files are unavailable. Clarify the target if several projects match.

[Expo MCP setup and capabilities](https://docs.expo.dev/eas/ai/mcp/) describes the remote tools and optional local development-server connection. Use the tools actually exposed in this session as the authority. Local screenshots, device interaction, and development tools require the documented local setup or another connected device tool; installing this plugin alone does not provide a simulator.

## Complete and verify the requested action

Use existing authorization and the client's approval rules. Check the intended project, platform, profile, and release destination before a write. A request to inspect a failed build does not authorize starting a new build or submitting it to a store.

Report what the tool actually returned: a queued build, completed build, submitted artifact, and public release are different states. Include available result IDs or URLs. If execution or verification was unavailable, label the output as proposed commands or unverified changes. Keep credentials and unrelated private project data out of logs and feedback.

## Helpers and feedback

Only run a bundled helper when the required runtime and network access are available. Resolve its path relative to the installed skill. If the helper cannot run, use an equivalent available tool or describe the remaining step. Feedback commands send their supplied text to Expo; provide relevant, non-sensitive details, and never claim feedback was sent without a successful result.
