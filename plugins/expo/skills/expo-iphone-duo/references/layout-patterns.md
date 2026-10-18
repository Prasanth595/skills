# Layout patterns for iPhone Duo

Code for the rules in `SKILL.md`. All of it is a no-op on phones (their left and right insets are 0) and on Android unless noted.

## What the app can read (iOS 27.1, iPhone Duo simulator)

| | Outer display (466 × 678) | Inner display (951 × 669 window) |
|---|---|---|
| Window safe area (`useSafeAreaInsets()`) | left 0, top 0, right 84, bottom 34 | left 0, top 0, right 84, bottom 34 |
| `Constants.statusBarHeight` | 0 | 0 |
| Native navigation bar frame | y 24, height 58 | y 24, height 58 |
| A form sheet's own safe area | right 76 for every sheet, any height | 0 (the sheet is centred) |
| Native search field in the navigation bar | x 20 to 382 (the safe-area edge) | x 20 to the safe-area edge |

The rail was on the right in these measurements; it can be on the left, so always handle both sides.

## Rail insets that line up with native content

Beside the rail UIKit drops its content margin, so native content ends on the safe-area edge. If your screens add their own horizontal margin inside, take it out of the rail inset:

```ts
// theme/rail.ts
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The screens' own horizontal margin. */
export const CONTENT_MARGIN = 16;

/** How far content moves in for a side rail: the inset less the margin the screen already has. 0 on phones. */
export function useRailInsets() {
  const insets = useSafeAreaInsets();
  return {
    left: Math.max(0, insets.left - CONTENT_MARGIN),
    right: Math.max(0, insets.right - CONTENT_MARGIN),
  };
}
```

Use the same values everywhere the rail is applied, so content, floating controls and anything sized from the window agree.

## Tab screens that are lists or forms

Pad the tab's stack content. Native headers and the tab bar stay where iOS puts them, and the screen background still fills the strip beside the rail:

```tsx
// app/(tabs)/(settings)/_layout.tsx
import { Stack } from 'expo-router/stack';
import { useRailInsets } from '@/theme/rail';

export default function SettingsStack() {
  const rail = useRailInsets();
  return (
    <Stack screenOptions={{ contentStyle: { paddingLeft: rail.left, paddingRight: rail.right } }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
  );
}
```

It's a hook because the insets change at run time (moving between displays, Split View). Don't pad the root navigator or `NativeTabs`: that pulls native bars out of the rail and leaves an empty strip.

## Screens with a full-width bar, dock or custom header

Don't pad the whole screen. Pad the parts that hold content, use margins for a box with absolutely positioned children, and give the bar its own edge insets so its background, border and shadow still run to the edge:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRailInsets } from '@/theme/rail';

/** UIKit's top offset for navigation bars when the status bar is in the rail; no API reports it. */
const NAV_BAR_TOP_IN_RAIL = 24;

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const rail = useRailInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.ground }}>
      {/* Phones always have a top inset; on Duo it's 0. */}
      <View style={{ paddingTop: insets.top > 0 ? insets.top : NAV_BAR_TOP_IN_RAIL }} />
      <View style={{ paddingLeft: rail.left, paddingRight: rail.right }}>
        <Header />
      </View>
      {/* Margins, not padding: FloatingButton is absolutely positioned in here. */}
      <View style={{ flex: 1, marginLeft: rail.left, marginRight: rail.right }}>
        <List />
        <FloatingButton style={{ position: 'absolute', right: 14, bottom: 14 }} />
      </View>
      {/* The dock runs edge to edge; only its controls move in. */}
      <View style={[styles.dockWithShadow, { paddingBottom: insets.bottom }]}>
        <TransportBar style={{ paddingLeft: 18 + rail.left, paddingRight: 18 + rail.right }} />
      </View>
    </View>
  );
}
```

A control that computes positions from the window (snapping between corners, a draggable track) must use the same box: `useWindowDimensions().width - rail.left - rail.right`.

## Form sheets: pad only beside the rail's controls

A provider inside the sheet measures the sheet's own native safe area, which UIKit computes from where the sheet is (0 for a centred sheet on the inner display). On the outer display UIKit reports the rail over a sheet's whole height, but the rail only has controls (camera, clock, status) in its top ~150 pt; below them it holds the tab bar, which a sheet covers. So apply the inset only when the sheet's detent lifts its top edge into that band.

```tsx
// components/sheet-safe-area.tsx
import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

/** How far down the rail's controls reach on iPhone Duo, in points (about 150 on iOS 27.1). */
const RAIL_CONTROLS_DEPTH = 160;

export function SheetSafeArea({ detents, children }: { detents?: unknown; children: ReactNode }) {
  const { height } = useWindowDimensions();
  // Android sheets are never beside a rail, and their bottom padding may read the window insets.
  if (Platform.OS !== 'ios') return <>{children}</>;
  const tallest = Array.isArray(detents) && detents.length > 0 ? Math.max(...detents) : 1;
  const besideControls = height * (1 - tallest) < RAIL_CONTROLS_DEPTH;
  return (
    // The nested provider reads the sheet's own safe area; the default would read the window's.
    <SafeAreaProvider style={styles.fill}>
      <SafeAreaView edges={besideControls ? ['left', 'right'] : []} style={styles.fill}>
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/** A Stack's `screenLayout`: wraps its form sheets and leaves other screens alone. */
export function sheetScreenLayout({
  options,
  children,
}: {
  options: { presentation?: string; sheetAllowedDetents?: unknown };
  children: ReactNode;
}) {
  if (options.presentation !== 'formSheet') return <>{children}</>;
  return <SheetSafeArea detents={options.sheetAllowedDetents}>{children}</SheetSafeArea>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
```

```tsx
// app/_layout.tsx
<Stack screenLayout={sheetScreenLayout}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="tempo" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.45] }} />
</Stack>
```

Add it to every stack that presents sheets. A sheet's own `contentStyle` would replace a stack's, so don't try to add the rail inset through `contentStyle`.

## Fixed-width content beside the rail

Scale a fixed-width drawing to fit instead of redrawing it, so an exported image (a share card, a screenshot) stays the same artwork. Render it unwrapped when it fits, so phones keep the exact same view tree (wrapper heights can round differently, which shows up as a 1 px shift on Android):

```tsx
const [rowWidth, setRowWidth] = useState(CARD_WIDTH);
const scale = Math.min(1, (rowWidth + CONTENT_PADDING - MIN_EDGE_MARGIN) / CARD_WIDTH);

<ScrollView onLayout={(e) => setRowWidth(e.nativeEvent.layout.width - CONTENT_PADDING * 2)}>
  {scale < 1 ? (
    <View style={{ height: CARD_HEIGHT * scale }}>
      <View style={{ width: CARD_WIDTH, transform: [{ scale }], transformOrigin: 'top left' }}>
        <Card width={CARD_WIDTH} />
      </View>
    </View>
  ) : (
    <Card width={CARD_WIDTH} />
  )}
</ScrollView>
```

## Wide sheets on the inner display

When a sheet's row is wider than any phone's (iPhone Pro Max is 440 pt), centre a column the width of the content instead of pinning content left of full-width buttons. Only wrap when wide, so phones are unchanged:

```tsx
const wide = rowWidth > 440 - CONTENT_PADDING * 2;
{wide ? <View style={{ width: CARD_WIDTH, alignSelf: 'center' }}>{body}</View> : body}
```

## Known gaps

- **The side away from the rail:** UIKit uses a 20 pt margin there on the Duo's outer display; React Native gets no layout-margin value, so a fixed 16 pt margin sits 4 pt off native titles. There is no reliable fix without hard-coding per device.
- **The 24 pt top offset** for custom headers is measured, not read from an API.
