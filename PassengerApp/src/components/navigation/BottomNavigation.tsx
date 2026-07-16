import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PassengerTab } from '../../navigation/types';
import {
  passengerColors,
  passengerRadii,
  passengerSpacing,
  passengerTypography,
} from '../../theme/tokens';
import SymbolIcon, { type SymbolIconName } from '../common/SymbolIcon';

export interface BottomNavigationProps {
  activeTab: PassengerTab;
  onTabPress: (tab: PassengerTab) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface TabDefinition {
  key: PassengerTab;
  label: string;
  icon: SymbolIconName;
}

const TABS: readonly TabDefinition[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'map', label: 'Map', icon: 'map' },
  { key: 'routes', label: 'Routes', icon: 'routes' },
  { key: 'saved', label: 'Saved', icon: 'saved' },
];

export function BottomNavigation({
  activeTab,
  onTabPress,
  style,
  testID = 'passenger-bottom-navigation',
}: BottomNavigationProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const safeAreaStyle = {
    paddingBottom: Math.max(insets.bottom, passengerSpacing.xs),
  };

  return (
    <View style={[styles.container, safeAreaStyle, style]} testID={testID}>
      <View style={styles.tabRow}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
              onPress={() => onTabPress(tab.key)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              android_ripple={{ color: passengerColors.primarySoft }}
              hitSlop={2}
              testID={`${testID}-${tab.key}`}
            >
              {isActive ? <View style={styles.activeMarker} /> : null}
              <View
                style={[
                  styles.iconContainer,
                  isActive && styles.activeIconContainer,
                ]}
              >
                <SymbolIcon
                  name={
                    isActive && tab.key === 'saved' ? 'savedFilled' : tab.icon
                  }
                  size={21}
                  color={
                    isActive ? passengerColors.white : passengerColors.textMuted
                  }
                />
              </View>
              <Text
                style={[styles.label, isActive && styles.activeLabel]}
                maxFontSizeMultiplier={1.35}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: passengerColors.surfaceRaised,
    borderTopColor: passengerColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: passengerColors.primaryDark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  tabRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: passengerSpacing.xs,
    paddingTop: passengerSpacing.xs,
  },
  tab: {
    alignItems: 'center',
    borderRadius: passengerRadii.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 44,
    overflow: 'hidden',
    paddingHorizontal: passengerSpacing.xxs,
    paddingVertical: passengerSpacing.xxs,
    position: 'relative',
  },
  tabPressed: {
    opacity: 0.72,
  },
  activeMarker: {
    backgroundColor: passengerColors.secondary,
    borderRadius: passengerRadii.pill,
    height: 3,
    position: 'absolute',
    top: 0,
    width: 20,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: passengerRadii.pill,
    height: 32,
    justifyContent: 'center',
    width: 38,
  },
  activeIconContainer: {
    backgroundColor: passengerColors.primary,
  },
  label: {
    color: passengerColors.textMuted,
    fontSize: passengerTypography.caption,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 2,
    textAlign: 'center',
  },
  activeLabel: {
    color: passengerColors.primaryDark,
    fontWeight: '800',
  },
});

export default BottomNavigation;
