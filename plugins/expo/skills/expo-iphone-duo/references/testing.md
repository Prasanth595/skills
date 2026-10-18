# Testing on iPhone Duo

Check every screen and sheet closed and open, in light and dark mode, and compare with an iPhone build so nothing moves there.

## Fast loop: a development build against Metro

Layout work rarely needs native changes, so iterate against Metro instead of rebuilding. Either simulator works; pick by what you have:

- **Local iPhone Duo simulator:** needs a Mac with Xcode 27.1 and the iOS 27.1 runtime. No session costs.
- **EAS Simulator:** no local Xcode 27.1 needed (works from Linux or CI too). An EAS service with costs.

Both need a **development build** made with the iOS 27.1 SDK (`developmentClient: true`; see `expo-dev-client`). A release build freezes its JavaScript and won't fast-refresh.

### Local simulator

1. **Simulator:** boot the iPhone Duo with `xcrun simctl boot <udid>` (find the UDID in `xcrun simctl list devices available`).
2. **Build:** install the development build, for example an existing EAS development simulator build (`eas build:list --platform ios --profile <dev-sim-profile>`), extracted and installed with `xcrun simctl install <udid> <App>.app`.
3. **Metro:** `npx expo start --dev-client`, then open `<scheme>://expo-development-client/?url=http://127.0.0.1:<port>` with `xcrun simctl openurl`.
4. **Screens:** open each screen by link (`xcrun simctl openurl <udid> <scheme>://<route>`), and edits fast-refresh in seconds.

### EAS Simulator

Start a session on the Duo and follow the live-development mode in `eas-simulator` (development build, Metro through a tunnel, the dev client connected to it):

```sh
npx --yes eas-cli@latest simulator:start --platform ios --device "iPhone Duo" --type agent-device \
  --build-id <development simulator build> --name "<what you are checking>"
```

Edits then fast-refresh on the hosted Duo just as they do locally. The session starts closed.

## Changing the pose

The simulator starts closed. Fold it with a device controller, then re-read the screen, since every frame and coordinate changes with the display:

- agent-device: `agent-device fold open|closed|half-open` (it can report "the first hinge-angle read returned no sample" even though the pose changed; check the screenshot size: 466 × 678 closed, 951 × 669 open).
- Argent: `argent run fold --args '{"udid":"<udid>","posture":"open"}'`.

## Screenshots and measurements

- **`xcrun simctl io <udid> screenshot` can return a black image on iPhone Duo.** Use your device controller's screenshot instead (`agent-device screenshot <path>`), which captures the lit display.
- **Measure, don't eyeball.** `agent-device snapshot --raw` prints every element's frame in points. Compare your content's edges with native elements, for example the navigation bar's search field (`SearchField`) and large title, and with the rail's safe-area edge (window width minus the rail inset).
- **A temporary on-screen readout** of `useSafeAreaInsets()` and `useSafeAreaFrame()` is the quickest way to learn what a view is told. Inside a sheet, render it under a nested `SafeAreaProvider` to see the sheet's own safe area.

## The first link prompt

The first time a session opens a custom-scheme link, iOS asks "Open in “App”?". It belongs to SpringBoard, so a label-based press can fail; tap the Open button by coordinates. Later links in the same session open directly.

## What to check

- Content clear of the rail's clock, Dynamic Island and tab bar, with the rail on either side.
- Full-width bars, docks, shadows and borders reach the screen edge (light mode shows shadow ends).
- Rail-side content edges line up with native content (search field, large title).
- Floating and absolutely positioned controls clear of the rail's tab bar.
- Custom headers have space above them.
- Sheets: centred on the inner display; on the outer display, tall sheets clear of the clock and short ones full width; nothing clipped.
- iPhone and Android screenshots unchanged.
