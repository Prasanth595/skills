---
name: expo-iphone-duo
description: Make an Expo app look right on iPhone Duo, Apple's foldable with an outer and an inner display and a vertical system rail. Use when the user mentions iPhone Duo, foldable iPhone, the side rail or status column, iOS 27.1, Split View on iPhone, content under the clock or a vertical tab bar, sheets or headers misplaced on Duo, or testing closed and open poses. Covers build requirements (SDK 58, Xcode 27.1), safe areas and asymmetric margins beside the rail, custom headers, form sheets, full-width bars, reserved regions, and testing on a Duo simulator. Not for general safe-area or navigation questions on phones (use expo-router or expo-native-ui).
---

# iPhone Duo Support for Expo Apps

iPhone Duo has two displays with the same aspect ratio and a vertical **rail** for system UI. Most of an Expo app adapts on its own: Expo Router's native stack headers and native tabs place themselves. What you own is layout: anything that reads safe-area insets, sizes itself from the window, or draws its own header, bar or sheet content.

## The device

| | Outer display (closed) | Inner display (open) |
|---|---|---|
| Size | ~5.4″, 466 × 678 pt | ~7.6″, 669 × 951 pt panel; the app window can be 951 × 669 |
| Rail | right or left edge | right or left edge (vertical bars in landscape) |

- **The rail** holds the clock, Dynamic Island, status icons and, with native tabs, a vertical tab bar. iOS reports it as a **~84 pt left or right safe-area inset**. The **top inset is 0** because the status bar is in the rail. Never assume which side it's on.
- **Poses:** closed, open, partly folded. The app can move between displays while it runs, and the inner display supports Split View, so your app can also be half of it.
- **Detect it only if you must:** `expo-device` reports `modelName` "iPhone Duo" (`modelId` `iPhone19,4`). Lay out from insets and window size instead; the same rules apply to Split View and resizable windows.

## 1. Build requirements

- **Expo SDK 58.** iOS 27 requires the UIKit scene life cycle; `npx expo prebuild` generates the scene delegate. Hand-managed `ios` directories and config plugins that edit `AppDelegate.swift` need review: https://expo.fyi/ios-scene-lifecycle (`expo-upgrade` covers the upgrade).
- **Xcode 27.1 / the iOS 27.1 SDK.** On EAS Build the `sdk-58` image alias is `macos-tahoe-26.6-xcode-27.1`. If `eas.json` pins an older `image`, set it to that for every iOS profile. Apps built against an older SDK run in a reduced compatibility layout on Duo.
- **Orientation locks are preferences now.** On iOS 27 the system can refuse `lockAsync` and ignores `requireFullScreen`. Design screens that adapt to the space they get.

## 2. Layout rules

Apple's guidance: foreground content stays in the safe area, backgrounds fill the bounds, and **layout margins are asymmetric**, so content can get closer to the rail. Apply these in order.

1. **Apply all four insets.** Anything padded by `insets.top`/`insets.bottom` only runs under the rail. Pad left and right too, or use `SafeAreaView` from `react-native-safe-area-context` with its default four edges. Handle each side independently.
2. **Inset content, not backgrounds.** Padding a whole screen (or a stack's `contentStyle`) also shortens full-width bars, docks and their shadows, so the shadow shows an end beside the rail (very visible in light mode). Let backgrounds, bars and their borders run to the edge, and pad only the controls inside.
3. **End content where native content ends.** Beside the rail UIKit drops its content margin, so native content (a navigation bar's search field, a large title in Split View) runs right up to the safe-area edge. If your screens keep their own margin (say 16 pt), pad by the rail inset **minus** that margin, or your content stops short of the native content above it. See `useRailInsets` in [references/layout-patterns.md](./references/layout-patterns.md).
4. **Use margins, not padding, on a box with absolutely positioned children.** An absolute child is placed against its parent's outer edge and ignores the parent's padding, so a floating button anchored `right: 16` inside a padded box slides under the rail's tab bar.
5. **Subtract the rail from anything sized from the window.** Controls that compute positions from `useWindowDimensions()` live in a narrower box: use `width - left - right` (the same insets you pad by).
6. **Custom headers need top space of their own.** With the status bar in the rail, `insets.top` is 0 and a header padded by it sits on the screen's top edge. UIKit puts its own navigation bars 24 pt down, and no React Native API reports that offset yet. Use `insets.top > 0 ? insets.top : 24`; phones always have a top inset, so they don't move. Prefer native headers (`Stack` options) where you can.
7. **Sheets: pad only where the sheet sits beside the rail.** On the inner display a form sheet is centred, away from the rail. On the outer display only a tall sheet (detent ~0.8 and up) reaches the rail's clock and camera; shorter ones cover the rail's tab bar and need no padding. Padding every sheet by the window's inset pushes content off centre. Use the sheet's own safe area, gated on its detent: `SheetSafeArea` in [references/layout-patterns.md](./references/layout-patterns.md).
8. **Fixed-width content must fit the narrower space.** A card or image drawn at a phone width clips beside the rail. Scale it down to fit (keeps exported images identical) and keep phones' layout as is.
9. **Wide sheets on the inner display.** A form sheet there is ~650 pt wide. Layouts built for a phone row (content pinned left, full-width buttons) look broken; centre a column when the row is wider than any phone's (440 pt less padding).
10. **Expo UI `Form`/`List` in a `Host`** beside the rail (left Split View window) used to start 20 pt in from the large title because of a SwiftUI bug; Expo UI mitigates it (expo/expo#51606). Keep `@expo/ui` current rather than adding margins by hand.

Prefer native containers where they fit: Expo Router native stacks and `NativeTabs` adapt to both displays and Split View. Custom JS tab bars and headers have to handle the rail themselves.

## 3. Folds, hinges and cameras (optional)

- **Reserved regions** (the fold when partly open, the outer and inner cameras) are not part of the safe area. To lay out around them, use `react-native-reserved-regions` (App&Flow): `ReservedRegionsProvider` + `useReservedRegions()` returns `division` and `occlusion` frames in the provider's coordinates. Needs the New Architecture and the iOS 27.1 SDK.
- **Hinge pose and angle** for effects and interactions (not layout): `react-native-hinges` (`useHinges()`, early alpha).

## 4. Test both displays

Check every screen and sheet **closed and open, in light and dark**, plus Split View if your app supports it. Compare with an iPhone build so nothing moves there.

For a fast feedback loop, run a **development build against Metro** so layout edits fast-refresh in seconds, on either:

- **A local iPhone Duo simulator** (Xcode 27.1 with the iOS 27.1 runtime), or
- **EAS Simulator**, with `--device "iPhone Duo"` and a development build connected to your Metro (the live-development mode in `eas-simulator`). No local Xcode 27.1 needed.

Change the pose with a device controller (agent-device `fold open|closed`, or Argent's `fold`). Use a full build and capture as the final check, not to iterate.

Details, gotchas (black `simctl` screenshots, the first link prompt) and how to measure frames to check alignment: [references/testing.md](./references/testing.md).

## Checklist

- [ ] SDK 58, Xcode 27.1 image, no `AppDelegate`-only window setup
- [ ] No content under the rail's clock, Dynamic Island or tab bar, on either side, in both poses
- [ ] Full-width bars, docks, shadows and borders run to the screen edge
- [ ] Content on the rail side ends where native content (search field, large title) ends
- [ ] Floating controls clear of the rail's tab bar
- [ ] Custom headers have space above them when `insets.top` is 0
- [ ] Sheets centred on the inner display; only tall sheets keep out of the rail on the outer display
- [ ] Nothing clipped or pinned to one side in wide sheets
- [ ] iPhone and Android unchanged

## References

- [references/layout-patterns.md](./references/layout-patterns.md): code for rail insets, sheets, headers, docks and fixed-width content
- [references/testing.md](./references/testing.md): local and EAS Duo testing, poses, measuring frames, gotchas

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-iphone-duo" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
