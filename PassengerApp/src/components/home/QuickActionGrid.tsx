import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PassengerNavigate } from '../../navigation/types';
import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../../theme/tokens';
import SymbolIcon, { type SymbolIconName } from '../common/SymbolIcon';

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: SymbolIconName;
  accent: 'primary' | 'secondary' | 'neutral';
  onPress: () => void;
}

interface QuickActionGridProps {
  navigate: PassengerNavigate;
}

function QuickActionGrid({
  navigate,
}: QuickActionGridProps): React.JSX.Element {
  const actions: QuickAction[] = [
    {
      id: 'map',
      title: 'Live bus map',
      subtitle: 'Follow buses as they move',
      icon: 'map',
      accent: 'primary',
      onPress: () => navigate({ tab: 'map' }),
    },
    {
      id: 'timetables',
      title: 'Timetables',
      subtitle: 'Check available route information',
      icon: 'calendar',
      accent: 'neutral',
      onPress: () => navigate({ tab: 'routes', routeMode: 'timetables' }),
    },
    {
      id: 'saved',
      title: 'Saved stops',
      subtitle: 'Your regular boarding points',
      icon: 'saved',
      accent: 'secondary',
      onPress: () => navigate({ tab: 'saved' }),
    },
    {
      id: 'routes',
      title: 'Find a route',
      subtitle: 'Search by number, stop, or town',
      icon: 'route',
      accent: 'neutral',
      onPress: () => navigate({ tab: 'routes', routeMode: 'search' }),
    },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.eyebrow}>GET MOVING</Text>
        <Text style={styles.sectionTitle}>Plan your journey</Text>
      </View>

      <View style={styles.grid}>
        {actions.map((action, index) => {
          const primary = action.accent === 'primary';
          const secondary = action.accent === 'secondary';

          return (
            <TouchableOpacity
              key={action.id}
              style={[
                styles.actionCard,
                index === 0 && styles.featureCard,
                primary && styles.primaryCard,
                secondary && styles.secondaryCard,
              ]}
              onPress={action.onPress}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={action.title + '. ' + action.subtitle}
            >
              <View
                style={[
                  styles.iconWell,
                  primary && styles.iconWellOnColor,
                  secondary && styles.iconWellSecondary,
                ]}
              >
                <SymbolIcon
                  name={action.icon}
                  size={index === 0 ? 27 : 23}
                  color={
                    primary
                      ? passengerColors.surface
                      : secondary
                      ? passengerColors.secondaryDark
                      : passengerColors.primary
                  }
                />
              </View>
              <View style={styles.actionCopy}>
                <Text
                  style={[
                    styles.actionTitle,
                    primary && styles.actionTitleOnColor,
                  ]}
                  numberOfLines={2}
                >
                  {action.title}
                </Text>
                <Text
                  style={[
                    styles.actionSubtitle,
                    primary && styles.actionSubtitleOnColor,
                  ]}
                  numberOfLines={2}
                >
                  {action.subtitle}
                </Text>
              </View>
              {index === 0 && (
                <View style={styles.featureArrow}>
                  <SymbolIcon
                    name="arrow"
                    size={20}
                    color={passengerColors.primaryDark}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: passengerSpacing.xl,
    paddingHorizontal: passengerSpacing.lg,
  },
  sectionHeading: {
    marginBottom: passengerSpacing.sm,
  },
  eyebrow: {
    color: passengerColors.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: passengerColors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: passengerSpacing.sm,
  },
  actionCard: {
    minHeight: 138,
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.md,
    ...passengerShadows.card,
  },
  featureCard: {
    minHeight: 126,
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryCard: {
    backgroundColor: passengerColors.primaryDark,
    borderColor: passengerColors.primaryDark,
  },
  secondaryCard: {
    backgroundColor: passengerColors.secondarySoft,
    borderColor: '#EBC9BF',
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primarySoft,
  },
  iconWellOnColor: {
    backgroundColor: 'rgba(255, 252, 247, 0.15)',
  },
  iconWellSecondary: {
    backgroundColor: 'rgba(185, 87, 63, 0.12)',
  },
  actionCopy: {
    flex: 1,
    marginTop: passengerSpacing.sm,
  },
  actionTitle: {
    color: passengerColors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  actionTitleOnColor: {
    color: passengerColors.surface,
    fontSize: 18,
  },
  actionSubtitle: {
    color: passengerColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: passengerSpacing.xxs,
  },
  actionSubtitleOnColor: {
    color: '#C8D9D2',
  },
  featureArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.surface,
    marginLeft: passengerSpacing.sm,
  },
});

export default React.memo(QuickActionGrid);
