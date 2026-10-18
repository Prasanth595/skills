# Testing on iPhone Duo

Check every screen and sheet closed and open, in light and dark mode, and compare with an iPhone build so
nothing moves there.

## Fast loop: a development build against Metro

Layout work rarely needs native changes, so iterate against Metro instead of rebuilding. Either simulator
works; pick by what you have:

- **Local iPhone Duo simulator:** needs a Mac with Xcode 27.1 and the iOS 27.1 runtime. No session costs.
- **EAS Simulator:** no local Xcode 27.1 needed (works from Linux or CI too). An EAS service with costs.

Both need a **development build** made with the iOS 27.1 SDK (`developmentClient: true`; see
`expo-dev-client`). A release build freezes its JavaScript and won't fast-refresh.

### Local simulator

1. **Simulator:** boot the iPhone Duo with `xcrun simctl boot <udid>` (find the UDID in
   `xcrun simctl list devices available`).
2. **Build:** install the development build, for example an existing EAS development simulator build
   (`eas build:list --platform ios --profile <dev-sim-profile>`), extracted and installed with
   `xcrun simctl install <udid> <App>.app`.
3. **Metro:** `npx expo start --dev-client`, then open
   `<scheme>://expo-development-client/?url=http://127.0.0.1:<port>` with `xcrun simctl openurl`.
4. **Screens:** open each screen by link (`xcrun simctl openurl <udid> <scheme>://<route>`), and edits
   fast-refresh in seconds.

### What to check

- Content clear of the rail's clock, Dynamic Island and tab bar, with the rail on either side.
- Full-width bars, docks, shadows and borders reach the screen edge (light mode shows shadow ends).
- Rail-side content edges line up with native content (search field, large title).
- Floating and absolutely positioned controls clear of the rail's tab bar.
- Custom headers have space above them.
- Sheets: centred on the inner display; on the outer display, tall sheets clear of the clock and short ones
  full width; nothing clipped.
- iPhone and Android screenshots unchanged.
