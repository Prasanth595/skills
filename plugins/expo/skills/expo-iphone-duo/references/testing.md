# Testing on iPhone Duo

Check every screen and sheet closed and open, in light and dark mode, and compare with an iPhone build so
nothing moves there.

## Fast loop: a local Duo simulator with a development build

Layout work rarely needs native changes, so iterate against Metro instead of rebuilding:

1. **Simulator:** Xcode 27.1 with the iOS 27.1 runtime includes an iPhone Duo device. Boot it with
   `xcrun simctl boot <udid>` (find the UDID in `xcrun simctl list devices available`).
2. **Build:** install a development build made with the iOS 27.1 SDK, for example an existing EAS
   development simulator build (`eas build:list --platform ios --profile <dev-sim-profile>`), extracted
   and installed with `xcrun simctl install <udid> <App>.app`. See `expo-dev-client`.
3. **Metro:** `npx expo start --dev-client`, then open
   `<scheme>://expo-development-client/?url=http://127.0.0.1:<port>` with `xcrun simctl openurl`.
4. **Screens:** open each screen by link (`xcrun simctl openurl <udid> <scheme>://<route>`), and edits
   fast-refresh in seconds.

## Changing the pose

The simulator starts closed. Fold it with a device controller, then re-read the screen, since every frame
and coordinate changes with the display:

- agent-device: `agent-device fold open|closed|half-open` (it can report "the first hinge-angle read
  returned no sample" even though the pose changed; check the screenshot size: 466 × 678 closed,
  951 × 669 open).
- Argent: `argent run fold --args '{"udid":"<udid>","posture":"open"}'`.

## Screenshots and measurements

- **`xcrun simctl io <udid> screenshot` can return a black image on iPhone Duo.** Use your device
  controller's screenshot instead (`agent-device screenshot <path>`), which captures the lit display.
- **Measure, don't eyeball.** `agent-device snapshot --raw` prints every element's frame in points. Compare
  your content's edges with native elements, for example the navigation bar's search field (`SearchField`)
  and large title, and with the rail's safe-area edge (window width minus the rail inset).
- **A temporary on-screen readout** of `useSafeAreaInsets()` and `useSafeAreaFrame()` is the quickest way
  to learn what a view is told. Inside a sheet, render it under a nested `SafeAreaProvider` to see the
  sheet's own safe area.

## The first link prompt

The first time a session opens a custom-scheme link, iOS asks "Open in “App”?". It belongs to SpringBoard,
so a label-based press can fail; tap the Open button by coordinates. Later links in the same session open
directly.

## EAS Simulator

To test without a local Xcode 27.1, start a hosted Duo session (an EAS service; see `eas-simulator` for
costs, setup and driving the session):

```sh
npx --yes eas-cli@latest simulator:start --platform ios --device "iPhone Duo" --type agent-device \
  --build-id <simulator build> --name "<what you are checking>"
```

The session starts closed; fold it with the controller as above.

## What to check

- Content clear of the rail's clock, Dynamic Island and tab bar, with the rail on either side.
- Full-width bars, docks, shadows and borders reach the screen edge (light mode shows shadow ends).
- Rail-side content edges line up with native content (search field, large title).
- Floating and absolutely positioned controls clear of the rail's tab bar.
- Custom headers have space above them.
- Sheets: centred on the inner display; on the outer display, tall sheets clear of the clock and short ones
  full width; nothing clipped.
- iPhone and Android screenshots unchanged.
