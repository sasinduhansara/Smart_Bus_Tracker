import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  driverColors,
  driverRadii,
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../theme/tokens';

export interface TabConfig {
  key: string;
  label: string;
  icon: string;
  activeIcon?: string;
  accessibilityLabel?: string;
}

export const DEFAULT_TABS: TabConfig[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { key: 'trip', label: 'Trip', icon: 'bus-outline', activeIcon: 'bus' },
  { key: 'route', label: 'Route', icon: 'map-outline', activeIcon: 'map' },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
  },
];

export interface BottomNavProps {
  tabs?: TabConfig[];
  activeTab: string;
  onTabPress: (tabKey: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({
  tabs = DEFAULT_TABS,
  activeTab,
  onTabPress,
}) => {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 12);
  const containerStyle = StyleSheet.compose(styles.container, {
    bottom: bottomOffset,
  });

  return (
    <View style={containerStyle}>
      {tabs.map(tab => {
        const isActive = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.accessibilityLabel || `${tab.label} tab`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onTabPress(tab.key)}
            style={({ pressed }) => [
              styles.navItem,
              isActive && styles.navItemActive,
              pressed && styles.navItemPressed,
            ]}
          >
            <Icon
              name={isActive ? tab.activeIcon || tab.icon : tab.icon}
              size={driverSizes.iconMedium}
              color={isActive ? driverColors.navy950 : driverColors.border}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: driverSizes.bottomNavHeight,
    backgroundColor: driverColors.navy900,
    borderWidth: 1,
    borderColor: driverColors.navy700,
    borderRadius: driverRadii.feature,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: driverSpacing.xs,
    paddingVertical: driverSpacing.xs,
    ...driverShadows.floating,
  },
  navItem: {
    flex: 1,
    minWidth: driverSizes.minimumTouchTarget,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: driverSpacing.xxs,
    borderRadius: driverRadii.card,
  },
  navItemActive: {
    backgroundColor: driverColors.amber500,
    shadowColor: driverColors.amber500,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  navItemPressed: {
    opacity: 0.72,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: driverTypography.weights.bold,
    color: driverColors.border,
  },
  navLabelActive: {
    color: driverColors.navy950,
  },
});

export default BottomNav;
