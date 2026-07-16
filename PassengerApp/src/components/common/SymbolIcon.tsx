import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { passengerColors } from '../../theme/tokens';

export type SymbolIconName =
  | 'alert'
  | 'arrow'
  | 'arrow-right'
  | 'bell'
  | 'bookmark'
  | 'bus'
  | 'calendar'
  | 'chevron-right'
  | 'clock'
  | 'close'
  | 'history'
  | 'home'
  | 'location'
  | 'map'
  | 'map-pin'
  | 'menu'
  | 'notification'
  | 'profile'
  | 'refresh'
  | 'route'
  | 'routes'
  | 'saved'
  | 'savedFilled'
  | 'search';

export interface SymbolIconProps {
  name: SymbolIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

interface PrimitiveProps {
  color: string;
  style: StyleProp<ViewStyle>;
}

interface GlyphProps {
  color: string;
}

function Stroke({ color, style }: PrimitiveProps): React.JSX.Element {
  return <View style={[styles.stroke, { backgroundColor: color }, style]} />;
}

function Outline({ color, style }: PrimitiveProps): React.JSX.Element {
  return <View style={[styles.outline, { borderColor: color }, style]} />;
}

function HomeGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Stroke color={color} style={styles.homeRoofLeft} />
      <Stroke color={color} style={styles.homeRoofRight} />
      <Outline color={color} style={styles.homeBody} />
      <Outline color={color} style={styles.homeDoor} />
    </>
  );
}

function MapGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.mapFrame} />
      <Stroke color={color} style={styles.mapFoldLeft} />
      <Stroke color={color} style={styles.mapFoldRight} />
      <Stroke color={color} style={styles.mapRouteLeft} />
      <Stroke color={color} style={styles.mapRouteRight} />
    </>
  );
}

function RouteGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.routeStart} />
      <Outline color={color} style={styles.routeEnd} />
      <Stroke color={color} style={styles.routeStemTop} />
      <Stroke color={color} style={styles.routeMiddle} />
      <Stroke color={color} style={styles.routeStemBottom} />
    </>
  );
}

function SavedGlyph({
  color,
  filled = false,
}: GlyphProps & { filled?: boolean }): React.JSX.Element {
  if (filled) {
    return (
      <>
        <View style={[styles.savedFillBody, { backgroundColor: color }]} />
        <View style={[styles.savedFillPoint, { borderTopColor: color }]} />
      </>
    );
  }

  return (
    <>
      <Stroke color={color} style={styles.savedTop} />
      <Stroke color={color} style={styles.savedLeft} />
      <Stroke color={color} style={styles.savedRight} />
      <Stroke color={color} style={styles.savedTailLeft} />
      <Stroke color={color} style={styles.savedTailRight} />
    </>
  );
}

function MenuGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Stroke color={color} style={styles.menuTop} />
      <Stroke color={color} style={styles.menuMiddle} />
      <Stroke color={color} style={styles.menuBottom} />
    </>
  );
}

function BellGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.bellBody} />
      <Stroke color={color} style={styles.bellBase} />
      <Stroke color={color} style={styles.bellClapper} />
      <Stroke color={color} style={styles.bellCrown} />
    </>
  );
}

function SearchGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.searchLens} />
      <Stroke color={color} style={styles.searchHandle} />
    </>
  );
}

function CloseGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Stroke color={color} style={styles.closeForward} />
      <Stroke color={color} style={styles.closeBackward} />
    </>
  );
}

function BusGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.busBody} />
      <Stroke color={color} style={styles.busWindowDivider} />
      <Outline color={color} style={styles.busLightLeft} />
      <Outline color={color} style={styles.busLightRight} />
      <Stroke color={color} style={styles.busWheelLeft} />
      <Stroke color={color} style={styles.busWheelRight} />
    </>
  );
}

function CalendarGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.calendarBody} />
      <Stroke color={color} style={styles.calendarHeader} />
      <Stroke color={color} style={styles.calendarRingLeft} />
      <Stroke color={color} style={styles.calendarRingRight} />
      <Stroke color={color} style={styles.calendarDotOne} />
      <Stroke color={color} style={styles.calendarDotTwo} />
      <Stroke color={color} style={styles.calendarDotThree} />
      <Stroke color={color} style={styles.calendarDotFour} />
    </>
  );
}

function LocationGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.locationHead} />
      <Outline color={color} style={styles.locationCenter} />
      <Stroke color={color} style={styles.locationTailLeft} />
      <Stroke color={color} style={styles.locationTailRight} />
    </>
  );
}

function ClockGlyph({
  color,
  history = false,
}: GlyphProps & { history?: boolean }): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.clockFace} />
      <Stroke color={color} style={styles.clockHour} />
      <Stroke color={color} style={styles.clockMinute} />
      {history ? (
        <>
          <Stroke color={color} style={styles.historyArrowTop} />
          <Stroke color={color} style={styles.historyArrowBottom} />
        </>
      ) : null}
    </>
  );
}

function ArrowGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Stroke color={color} style={styles.arrowShaft} />
      <Stroke color={color} style={styles.arrowTop} />
      <Stroke color={color} style={styles.arrowBottom} />
    </>
  );
}

function RefreshGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.refreshRing} />
      <Stroke color={color} style={styles.refreshMask} />
      <Stroke color={color} style={styles.refreshArrowTop} />
      <Stroke color={color} style={styles.refreshArrowBottom} />
    </>
  );
}

function AlertGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Stroke color={color} style={styles.alertLeft} />
      <Stroke color={color} style={styles.alertRight} />
      <Stroke color={color} style={styles.alertBase} />
      <Stroke color={color} style={styles.alertMark} />
      <Stroke color={color} style={styles.alertDot} />
    </>
  );
}

function ProfileGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <>
      <Outline color={color} style={styles.profileHead} />
      <Outline color={color} style={styles.profileBody} />
    </>
  );
}

function Glyph({
  name,
  color,
}: Pick<SymbolIconProps, 'name'> & GlyphProps): React.JSX.Element {
  switch (name) {
    case 'home':
      return <HomeGlyph color={color} />;
    case 'map':
      return <MapGlyph color={color} />;
    case 'route':
    case 'routes':
      return <RouteGlyph color={color} />;
    case 'bookmark':
    case 'saved':
      return <SavedGlyph color={color} />;
    case 'savedFilled':
      return <SavedGlyph color={color} filled />;
    case 'menu':
      return <MenuGlyph color={color} />;
    case 'bell':
    case 'notification':
      return <BellGlyph color={color} />;
    case 'search':
      return <SearchGlyph color={color} />;
    case 'close':
      return <CloseGlyph color={color} />;
    case 'bus':
      return <BusGlyph color={color} />;
    case 'calendar':
      return <CalendarGlyph color={color} />;
    case 'location':
    case 'map-pin':
      return <LocationGlyph color={color} />;
    case 'history':
      return <ClockGlyph color={color} history />;
    case 'clock':
      return <ClockGlyph color={color} />;
    case 'arrow':
    case 'arrow-right':
    case 'chevron-right':
      return <ArrowGlyph color={color} />;
    case 'refresh':
      return <RefreshGlyph color={color} />;
    case 'alert':
      return <AlertGlyph color={color} />;
    case 'profile':
      return <ProfileGlyph color={color} />;
  }
}

export function SymbolIcon({
  name,
  size = 24,
  color = passengerColors.text,
  style,
  accessibilityLabel,
  testID,
}: SymbolIconProps): React.JSX.Element {
  const safeSize = Math.max(1, size);

  return (
    <View
      style={[styles.container, { width: safeSize, height: safeSize }, style]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      testID={testID}
      pointerEvents="none"
    >
      <View style={[styles.canvas, { transform: [{ scale: safeSize / 24 }] }]}>
        <Glyph name={name} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    height: 24,
    position: 'absolute',
    width: 24,
  },
  stroke: {
    borderRadius: 999,
    height: 2,
    position: 'absolute',
  },
  outline: {
    borderWidth: 2,
    position: 'absolute',
  },
  homeRoofLeft: {
    left: 3.5,
    top: 7.5,
    transform: [{ rotate: '-40deg' }],
    width: 10.5,
  },
  homeRoofRight: {
    right: 3.5,
    top: 7.5,
    transform: [{ rotate: '40deg' }],
    width: 10.5,
  },
  homeBody: {
    borderRadius: 2,
    borderTopWidth: 0,
    height: 11,
    left: 5.5,
    top: 9,
    width: 13,
  },
  homeDoor: {
    borderBottomWidth: 0,
    borderRadius: 1,
    height: 7,
    left: 10,
    top: 13,
    width: 4,
  },
  mapFrame: {
    borderRadius: 2,
    height: 17,
    left: 3,
    top: 3.5,
    width: 18,
  },
  mapFoldLeft: {
    height: 16,
    left: 8,
    top: 4,
    width: 2,
  },
  mapFoldRight: {
    height: 16,
    left: 14,
    top: 4,
    width: 2,
  },
  mapRouteLeft: {
    left: 4.5,
    top: 11,
    transform: [{ rotate: '-28deg' }],
    width: 5,
  },
  mapRouteRight: {
    right: 4.5,
    top: 11,
    transform: [{ rotate: '28deg' }],
    width: 5,
  },
  routeStart: {
    borderRadius: 4,
    height: 7,
    left: 2.5,
    top: 14.5,
    width: 7,
  },
  routeEnd: {
    borderRadius: 4,
    height: 7,
    left: 14.5,
    top: 2.5,
    width: 7,
  },
  routeStemTop: {
    height: 6,
    left: 11,
    top: 5.5,
    width: 2,
  },
  routeMiddle: {
    left: 8,
    top: 11,
    width: 8,
  },
  routeStemBottom: {
    height: 6,
    left: 11,
    top: 12.5,
    width: 2,
  },
  savedTop: {
    left: 6,
    top: 3,
    width: 12,
  },
  savedLeft: {
    height: 16,
    left: 5,
    top: 3,
    width: 2,
  },
  savedRight: {
    height: 16,
    left: 17,
    top: 3,
    width: 2,
  },
  savedTailLeft: {
    left: 5.5,
    top: 17.5,
    transform: [{ rotate: '35deg' }],
    width: 7.5,
  },
  savedTailRight: {
    left: 11,
    top: 17.5,
    transform: [{ rotate: '-35deg' }],
    width: 7.5,
  },
  savedFillBody: {
    borderRadius: 2,
    height: 13,
    left: 5,
    position: 'absolute',
    top: 3,
    width: 14,
  },
  savedFillPoint: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 7,
    borderRightColor: 'transparent',
    borderRightWidth: 7,
    borderTopWidth: 7,
    height: 0,
    left: 5,
    position: 'absolute',
    top: 16,
    width: 0,
  },
  menuTop: {
    left: 3,
    top: 5,
    width: 18,
  },
  menuMiddle: {
    left: 3,
    top: 11,
    width: 14,
  },
  menuBottom: {
    left: 3,
    top: 17,
    width: 18,
  },
  bellBody: {
    borderBottomWidth: 0,
    borderRadius: 8,
    height: 13,
    left: 6,
    top: 5,
    width: 12,
  },
  bellBase: {
    left: 4.5,
    top: 17,
    width: 15,
  },
  bellClapper: {
    height: 3,
    left: 11,
    top: 19,
    width: 2,
  },
  bellCrown: {
    left: 10,
    top: 2.5,
    width: 4,
  },
  searchLens: {
    borderRadius: 7,
    height: 13,
    left: 3,
    top: 3,
    width: 13,
  },
  searchHandle: {
    left: 14,
    top: 16.5,
    transform: [{ rotate: '45deg' }],
    width: 8,
  },
  closeForward: {
    left: 3.5,
    top: 11,
    transform: [{ rotate: '45deg' }],
    width: 17,
  },
  closeBackward: {
    left: 3.5,
    top: 11,
    transform: [{ rotate: '-45deg' }],
    width: 17,
  },
  busBody: {
    borderRadius: 4,
    height: 16,
    left: 4,
    top: 3,
    width: 16,
  },
  busWindowDivider: {
    left: 5,
    top: 11,
    width: 14,
  },
  busLightLeft: {
    borderRadius: 2,
    height: 4,
    left: 6.5,
    top: 13,
    width: 4,
  },
  busLightRight: {
    borderRadius: 2,
    height: 4,
    right: 6.5,
    top: 13,
    width: 4,
  },
  busWheelLeft: {
    height: 3,
    left: 6.5,
    top: 19,
    width: 3,
  },
  busWheelRight: {
    height: 3,
    right: 6.5,
    top: 19,
    width: 3,
  },
  calendarBody: {
    borderRadius: 3,
    height: 17,
    left: 3,
    top: 4,
    width: 18,
  },
  calendarHeader: {
    left: 4,
    top: 9,
    width: 16,
  },
  calendarRingLeft: {
    height: 5,
    left: 7,
    top: 2,
    width: 2,
  },
  calendarRingRight: {
    height: 5,
    right: 7,
    top: 2,
    width: 2,
  },
  calendarDotOne: {
    height: 2.5,
    left: 7,
    top: 12,
    width: 2.5,
  },
  calendarDotTwo: {
    height: 2.5,
    right: 7,
    top: 12,
    width: 2.5,
  },
  calendarDotThree: {
    height: 2.5,
    left: 7,
    top: 16,
    width: 2.5,
  },
  calendarDotFour: {
    height: 2.5,
    right: 7,
    top: 16,
    width: 2.5,
  },
  locationHead: {
    borderRadius: 7,
    height: 14,
    left: 5,
    top: 2,
    width: 14,
  },
  locationCenter: {
    borderRadius: 3,
    height: 6,
    left: 9,
    top: 6,
    width: 6,
  },
  locationTailLeft: {
    left: 6.5,
    top: 16,
    transform: [{ rotate: '49deg' }],
    width: 8,
  },
  locationTailRight: {
    right: 6.5,
    top: 16,
    transform: [{ rotate: '-49deg' }],
    width: 8,
  },
  clockFace: {
    borderRadius: 10,
    height: 20,
    left: 2,
    top: 2,
    width: 20,
  },
  clockHour: {
    height: 6,
    left: 11,
    top: 6,
    width: 2,
  },
  clockMinute: {
    left: 11,
    top: 12,
    transform: [{ rotate: '28deg' }],
    transformOrigin: 'left',
    width: 6,
  },
  historyArrowTop: {
    left: 1,
    top: 3,
    transform: [{ rotate: '-20deg' }],
    width: 6,
  },
  historyArrowBottom: {
    height: 6,
    left: 2,
    top: 3,
    width: 2,
  },
  arrowShaft: {
    left: 4,
    top: 11,
    width: 15,
  },
  arrowTop: {
    left: 14,
    top: 7,
    transform: [{ rotate: '45deg' }],
    width: 7,
  },
  arrowBottom: {
    left: 14,
    top: 15,
    transform: [{ rotate: '-45deg' }],
    width: 7,
  },
  refreshRing: {
    borderRadius: 9,
    height: 18,
    left: 3,
    top: 3,
    width: 18,
  },
  refreshMask: {
    height: 8,
    left: 2,
    top: 2,
    width: 5,
  },
  refreshArrowTop: {
    left: 2,
    top: 3,
    transform: [{ rotate: '42deg' }],
    width: 6,
  },
  refreshArrowBottom: {
    height: 6,
    left: 2,
    top: 3,
    width: 2,
  },
  alertLeft: {
    left: 3,
    top: 11,
    transform: [{ rotate: '-62deg' }],
    width: 19,
  },
  alertRight: {
    right: 3,
    top: 11,
    transform: [{ rotate: '62deg' }],
    width: 19,
  },
  alertBase: {
    left: 3,
    top: 20,
    width: 18,
  },
  alertMark: {
    height: 7,
    left: 11,
    top: 8,
    width: 2,
  },
  alertDot: {
    height: 2.5,
    left: 10.75,
    top: 17,
    width: 2.5,
  },
  profileHead: {
    borderRadius: 5,
    height: 10,
    left: 7,
    top: 2,
    width: 10,
  },
  profileBody: {
    borderBottomWidth: 0,
    borderRadius: 9,
    height: 9,
    left: 3,
    top: 14,
    width: 18,
  },
});

export default SymbolIcon;
