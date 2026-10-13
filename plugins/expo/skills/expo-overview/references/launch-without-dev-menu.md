# Launch Expo Go or a development build without the dev menu

When you open the app yourself, to look at it, take screenshots, or drive it, skip the Expo UI that stands between launch and the app:

- the onboarding sheet on first launch after install
- the dev menu that opens by itself at launch
- the floating Tools button, which covers content and shows up in every screenshot

Each one costs taps and screenshots to dismiss, and an agent can mistake them for the app. Suppress all three on every launch you start. Leave them alone only when you hand the device to the user to explore the dev menu.

Do not edit the app config, such as the `expo-dev-client` config plugin options, to get this. That changes the build for every person who uses it. Launch flags affect only the launch you start.

Check the `expo` version in `package.json` first. SDK 58 changed the URL form.

## SDK 58 and later

**Expo CLI adds the flags for you.** Start the dev server with `EXPO_NO_DEV_MENU=1`:

```bash
EXPO_NO_DEV_MENU=1 npx expo start --ios        # or --android, or press i / a
EXPO_NO_DEV_MENU=1 npx expo run:ios            # development builds
```

The CLI then adds the reserved params to every launch URL it opens or prints, including the terminal URL, the QR code, `expo start --ios/--android`, and `expo run:*`. It already does this when it is not interactive (CI, or no TTY), but set the variable anyway. An agent harness may give the CLI a TTY.

**When you open a URL yourself**, add these three params:

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

The `__expo_*` params and `EXPO_NO_DEV_MENU` do not exist. Use the older mechanisms below.

**Development build (iOS and Android):** use the legacy launch URL with its flags:

```text
<scheme>://expo-development-client/?url=<url-encoded dev server URL>&disableOnboarding=1&disableFab=1&disableAutoLaunch=1
```

These flags are saved for that install. The Tools button and the dev menu at launch stay off until someone turns them back on in the dev menu settings. Tell the user if you did this on their own device.

**Expo Go on iOS:** URL params do nothing. Launch Expo Go with UserDefaults launch arguments first, then open the project. The open reaches the running process, so the arguments still apply:

```bash
xcrun simctl terminate booted host.exp.Exponent 2>/dev/null
xcrun simctl launch booted host.exp.Exponent \
  -EXDevMenuIsOnboardingFinished 1 -EXDevMenuShowsAtLaunch 0 -EXDevMenuShowFloatingActionButton 0
xcrun simctl openurl booted "exp://<host>:8081"   # or press i in `npx expo start`
```

The arguments apply only to that process. If Expo Go quits or you relaunch it, launch it again with the arguments. The same arguments work on an iOS development build when you launch it by bundle identifier.

**Expo Go on Android:** no launch flag exists. Dismiss the onboarding sheet once. Expo Go saves that for the install, so do not reinstall Expo Go between runs.

## Opening a URL on a simulator or emulator

```bash
# iOS Simulator
xcrun simctl openurl booted "<launch URL>"

# Android emulator: quote the URL inside the remote command, or the device shell cuts it at the first &
adb shell "am start -a android.intent.action.VIEW -d '<launch URL>'"
```

On an EAS cloud simulator, the `eas-simulator` skill has its own launch commands. Add the same URL params and launch arguments there.
