import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

const COLORS = {
  navActive: '#F59E0B',
  navInactive: '#CBD5E1',
  white: '#FFFFFF',
  borderLight: 'rgba(255, 255, 255, 0.14)',
  primaryDark: '#07111F',
  navSurface: '#0F172A',
};

export interface TabConfig {
  key: string;
  label: string;
  icon: string;
  activeIcon?: string;
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

interface BottomNavProps {
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
          <TouchableOpacity
            key={tab.key}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.85}
          >
            <Icon
              name={isActive ? tab.activeIcon || tab.icon : tab.icon}
              size={22}
              color={isActive ? COLORS.white : COLORS.navInactive}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
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
    minHeight: 72,
    backgroundColor: COLORS.navSurface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 24,
  },
  navItemActive: {
    backgroundColor: COLORS.navActive,
    shadowColor: COLORS.navActive,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.navInactive,
  },
  navLabelActive: {
    color: COLORS.white,
  },
});

export default BottomNav;
