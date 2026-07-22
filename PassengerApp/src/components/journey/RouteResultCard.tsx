import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../../theme/tokens';
import type {
  PassengerRouteSearchItem,
  PassengerServiceType,
} from '../../types';
import SymbolIcon from '../common/SymbolIcon';

interface RouteResultCardProps {
  route: PassengerRouteSearchItem;
  onPress: () => void;
}

function serviceLabel(type: PassengerServiceType): string {
  switch (type) {
    case 'sltb':
      return 'SLTB';
    case 'private':
      return 'Private';
    default:
      return 'AC';
  }
}

function RouteResultCard({
  route,
  onPress,
}: RouteResultCardProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Route ${route.routeNumber}, ${route.name}`}
    >
      <View style={styles.topRow}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeLabel}>ROUTE</Text>
          <Text style={styles.routeNumber}>{route.routeNumber}</Text>
        </View>
        <View style={styles.routeCopy}>
          <Text style={styles.routeName} numberOfLines={1}>
            {route.name}
          </Text>
          <Text style={styles.direction} numberOfLines={1}>
            {route.direction} · {route.selectedStopCount} stops on this journey
          </Text>
        </View>
        <SymbolIcon
          name="arrow"
          size={18}
          color={passengerColors.textSubtle}
        />
      </View>

      <View style={styles.journeyRow}>
        <View style={styles.stopMarker} />
        <Text style={styles.stopName} numberOfLines={1}>
          {route.fromStop.name}
        </Text>
        <View style={styles.journeyLine} />
        <SymbolIcon
          name="location"
          size={17}
          color={passengerColors.secondary}
        />
        <Text style={styles.stopName} numberOfLines={1}>
          {route.toStop.name}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.serviceBadges}>
          {route.availableServiceTypes.map(type => (
            <View key={type} style={styles.serviceBadge}>
              <Text style={styles.serviceBadgeText}>{serviceLabel(type)}</Text>
            </View>
          ))}
          {!route.availableServiceTypes.length && (
            <Text style={styles.noServiceLabel}>No service type published</Text>
          )}
        </View>
        <View
          style={[
            styles.countBadge,
            !route.hasScheduledServices && styles.countBadgeMuted,
          ]}
        >
          <Text
            style={[
              styles.countText,
              !route.hasScheduledServices && styles.countTextMuted,
            ]}
          >
            {route.hasScheduledServices
              ? `${route.scheduledServiceCount} bus${
                  route.scheduledServiceCount === 1 ? '' : 'es'
                }`
              : 'No buses'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.md,
    marginBottom: passengerSpacing.sm,
    ...passengerShadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeBadge: {
    width: 58,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: passengerColors.primary,
  },
  routeBadgeLabel: {
    color: '#CDE1D8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  routeNumber: {
    color: passengerColors.white,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: passengerSpacing.sm,
  },
  routeName: {
    color: passengerColors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  direction: {
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: passengerSpacing.md,
  },
  stopMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: passengerColors.primary,
  },
  stopName: {
    flexShrink: 1,
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: passengerSpacing.xs,
  },
  journeyLine: {
    flex: 1,
    minWidth: 18,
    height: 1,
    backgroundColor: passengerColors.border,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: passengerSpacing.md,
  },
  serviceBadges: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: passengerSpacing.xxs,
  },
  serviceBadge: {
    borderRadius: passengerRadii.pill,
    backgroundColor: passengerColors.primarySoft,
    paddingHorizontal: passengerSpacing.xs,
    paddingVertical: 5,
  },
  serviceBadgeText: {
    color: passengerColors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
  },
  noServiceLabel: {
    color: passengerColors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
  },
  countBadge: {
    borderRadius: passengerRadii.pill,
    backgroundColor: '#E3F2EA',
    paddingHorizontal: passengerSpacing.sm,
    paddingVertical: 6,
    marginLeft: passengerSpacing.xs,
  },
  countBadgeMuted: {
    backgroundColor: passengerColors.surfaceMuted,
  },
  countText: {
    color: passengerColors.success,
    fontSize: 10,
    fontWeight: '900',
  },
  countTextMuted: {
    color: passengerColors.textMuted,
  },
});

export default React.memo(RouteResultCard);
