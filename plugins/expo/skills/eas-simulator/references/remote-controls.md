# Direct iOS controls and preview embedding

## Discover actions on the selected session

**eas-cli 25.2.0+** provides `simulator:control` for a running iOS session whose
preview host exposes a token and an action catalog (serve-sim 0.10.0+). It uses
the authenticated session query, so it does not need `--public-link` or a token
copied from JSON output. Android sessions are not supported by this command.

Run from the Expo project directory and pass the session id explicitly. Discover
what that host supports before invoking an action; upgrading the local CLI does
not upgrade an existing session's host:

```bash
npx --yes eas-cli@latest simulator:control --id <session-id>
npx --yes eas-cli@latest simulator:control screenshot.capture --help --id <session-id>
npx --yes eas-cli@latest simulator:control screenshot.capture --output ./shot.png --id <session-id>
```

Use `--json` on the discovery command for parameter schemas, or per-action
`--help` for usage. Actions accept positional values or `name=value`; put `--`
before values starting with `--`. Available actions can cover clipboard,
appearance, permissions, input, app lifecycle, app files, and device controls.
Choose only actions needed for the user's task. Keep using the selected
controller for snapshots and element-reference navigation.

## Files and screenshots

`--output` is a **local** destination; action path arguments refer to the remote
host unless the action declares an upload. Screenshots get a generated filename
when no output path is given. On serve-sim 0.10.4+, captures follow the active
display; use the action's optional `display` parameter only with a known simctl
screen ID from that device, not a guessed panel index.

For installation, `app.install` accepts a file, not a local `.app` directory.
Use an installable simulator `.ipa` and consult that session's action help.
Upload-enabled actions stage an existing local file automatically. A nonexistent
absolute path is treated as a remote path; confirm which machine owns a path
before passing it. Downloads and clipboard output can contain app data; keep
those files and output private and inspect the saved image before reporting it.

## Embed or call the preview from another page

With **eas-cli 25.1.1+**, `simulator:start` supports two separate repeatable flags:

- `--frame-ancestor https://app.example.com` lets that page embed the preview in
  an iframe. Use the direct preview URL printed for embedding, not the expo.dev
  page URL.
- `--cors-origin https://app.example.com` lets that page call the preview API,
  for example through `@expo/hub-client`. It is not needed just for an iframe.

Use the specific origins needed for the requested integration. The printed direct
URL carries the session token; a page that receives it can control the simulator
and read app data and logs. The allowlist does not replace token authentication.
Keep that URL out of source control and public pages. For ordinary viewing, use
the browser preview link rather than adding embedding or CORS grants.
