# Launch Expo Go or a development build without the dev menu

When you open the app yourself, to look at it, take screenshots, or drive it, skip the Expo UI that stands between launch and the app:

- the onboarding sheet on first launch after install
- the dev menu that opens by itself at launch
- the floating Tools button, which covers content and shows up in every screenshot

Each one costs taps and screenshots to dismiss, and an agent can mistake them for the app. Suppress all three on every launch you start. Leave them alone only when you hand the device to the user to explore the dev menu.

Do not edit the app config, such as the `expo-dev-client` config plugin options, to get this. That changes the build for every person who uses it. Launch flags affect only the launch you start.

Check the `expo` version in `package.json` first. SDK 58 changed the URL form.

## SDK 58 and later

**Launches through Expo CLI need nothing.** When the CLI is not interactive (no TTY, or `CI` is set), it adds the reserved params to every launch URL it opens or prints, including `expo start --ios/--android`, pressing `i` / `a`, and `expo run:*`. Agent shells usually have no TTY. If yours does, set `EXPO_NO_DEV_MENU=1` to force it. `EXPO_NO_DEV_MENU=0` turns it off.

**When you open a URL yourself**, with `simctl openurl`, `adb`, or a controller, the CLI never sees it. Add these three params:

```text
__expo_disable_onboarding=1&__expo_disable_fab=1&__expo_disable_auto_launch=1
```

| App | Launch URL |
|-----|------------|
| Expo Go | `exp://<host>:8081?__expo_disable_onboarding=1&__expo_disable_fab=1&__expo_disable_auto_launch=1` |
| Expo Go, at a route | `exp://<host>:8081/--/<route>?__expo_disable_onboarding=1&__expo_disable_fab=1&__expo_disable_auto_launch=1` |
| Development build | `<scheme>://?__expo_url=<url-encoded dev server URL>&__expo_disable_onboarding=1&__expo_disable_fab=1&__expo_disable_auto_launch=1` |

`<scheme>` is the app config `scheme`, or `exp+<slug>` when none is set. The launcher removes the `__expo_*` params before the app sees the URL. `__expo_disable_onboarding` is saved for that install. The other two apply to the launched process only.

## SDK 57 and earlier

Expo CLI adds no flags, and the `__expo_*` params do not exist. Every launch needs one of the mechanisms below, including launches through `npx expo start --ios` or `expo run:*`.

**iOS, Expo Go and development builds:** launch the app with UserDefaults launch arguments, then open the project. The open reaches the running process, so the arguments still apply. This works on every SDK 57 and earlier build:

```bash
APP=host.exp.Exponent   # Expo Go; for a development build, use its ios.bundleIdentifier
xcrun simctl terminate booted $APP 2>/dev/null
xcrun simctl launch booted $APP \
  -EXDevMenuIsOnboardingFinished 1 -EXDevMenuShowsAtLaunch 0 -EXDevMenuShowFloatingActionButton 0
xcrun simctl openurl booted "<launch URL>"   # or press i in `npx expo start`
```

The arguments apply only to that process. If the app quits or you relaunch it, launch it again with the arguments. Prefer this over URL flags on iOS: before `expo-dev-launcher` 57.0.20, iOS reads `disableOnboarding=1` only from inside the encoded `url=` value, and nothing in the URL stops the dev menu from opening at launch.

**Android, development builds:** use the legacy launch URL with its flags:

```text
<scheme>://expo-development-client/?url=<url-encoded dev server URL>&disableOnboarding=1&disableFab=1&disableAutoLaunch=1
```

`disableFab` and `disableAutoLaunch` need `expo-dev-launcher` 57.0.20 or later. Older builds read only `disableOnboarding`, so the dev menu still opens at launch; close it. These flags are saved for that install, and the Tools button and the dev menu at launch stay off until someone turns them back on in the dev menu settings. Tell the user if you did this on their own device.

**Android, Expo Go:** no launch flag exists. Dismiss the onboarding sheet once. Expo Go saves that for the install, so do not reinstall Expo Go between runs.

## Opening a URL on a simulator or emulator

```bash
# iOS Simulator
xcrun simctl openurl booted "<launch URL>"

# Android emulator: quote the URL inside the remote command, or the device shell cuts it at the first &
adb shell "am start -a android.intent.action.VIEW -d '<launch URL>'"
```

**iOS asks "Open in '<app>'?"** the first time `simctl openurl` sends a scheme to an app, even when that app is in the foreground. Expo CLI approves the scheme itself when it opens a URL. When you call `simctl openurl` yourself, approve the scheme first:

```bash
UDID=<booted simulator udid>     # xcrun simctl list devices booted
SCHEME=exp                       # or the development build's scheme, such as exp+my-app
APP=host.exp.Exponent            # or the development build's bundle identifier
P=~/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Preferences/com.apple.launchservices.schemeapproval.plist
K="com.apple.CoreSimulator.CoreSimulatorBridge-->$SCHEME"
/usr/libexec/PlistBuddy -c "Set :'$K' $APP" "$P" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :'$K' string $APP" "$P"
```

On an EAS cloud simulator, the `eas-simulator` skill has its own launch commands. Add the same URL params and launch arguments there.
