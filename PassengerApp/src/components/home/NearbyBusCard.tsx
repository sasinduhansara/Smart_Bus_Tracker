import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../../theme/tokens';
import type { NearbyBus } from '../../types';
import { formatRelativeTime } from '../../utils/passengerHome';
import SymbolIcon from '../common/SymbolIcon';

interface NearbyBusCardProps {
  item: NearbyBus;
  now: number;
  onPress: (item: NearbyBus) => void;
}

function formatDistance(distanceKm?: number): string | null {
  if (typeof distanceKm !== 'number') {
    return null;
  }

  if (distanceKm < 1) {
    return Math.round(distanceKm * 1000) + ' m away';
  }

  return distanceKm.toFixed(1) + ' km away';
}

function statusDetails(status: NearbyBus['status']): {
  label: string;
  color: string;
} {
  switch (status) {
    case 'live':
      return { label: 'Live', color: passengerColors.success };
    case 'stale':
      return { label: 'Signal delayed', color: passengerColors.warning };
    default:
      return { label: 'Bus offline', color: passengerColors.error };
  }
}

function NearbyBusCard({
  item,
  now,
  onPress,
}: NearbyBusCardProps): React.JSX.Element {
  const status = statusDetails(item.status);
  const distance = formatDistance(item.distanceKm);
  const routeLabel = item.bus.routeNumber
    ? 'Route ' + item.bus.routeNumber
    : 'Route not assigned';
  const etaLabel = item.eta
    ? item.eta.etaMinutes < 1
      ? 'Due'
      : Math.ceil(item.eta.etaMinutes) + ' min'
    : item.status === 'offline'
    ? 'Offline'
    : 'Unavailable';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={
        routeLabel +
        ', ' +
        (item.routeName || 'route name unavailable') +
        ', ' +
        status.label +
        ', ETA ' +
        etaLabel
      }
    >
      <View style={styles.topRow}>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeCaption}>ROUTE</Text>
          <Text
            style={styles.routeNumber}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {item.bus.routeNumber || '—'}
          </Text>
        </View>

        <View style={styles.routeCopy}>
          <Text style={styles.routeName} numberOfLines={2}>
            {item.routeName || routeLabel}
          </Text>
          {item.destinationName && (
            <Text style={styles.destination} numberOfLines={1}>
              Towards {item.destinationName}
            </Text>
          )}
          <View style={styles.statusRow}>
            <View
              style={[styles.statusDot, { backgroundColor: status.color }]}
            />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
            <Text style={styles.updatedText} numberOfLines={1}>
              · {formatRelativeTime(item.bus.updatedAt, now)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.detailRow}>
        <View style={styles.stopBlock}>
          <View style={styles.stopIcon}>
            <SymbolIcon
              name="location"
              size={17}
              color={passengerColors.primary}
            />
          </View>
          <View style={styles.stopCopy}>
            <Text style={styles.detailLabel}>NEXT STOP</Text>
            <Text style={styles.stopName} numberOfLines={2}>
              {item.nextStop?.name || 'Stop information unavailable'}
            </Text>
            {distance && <Text style={styles.distance}>{distance}</Text>}
          </View>
        </View>

        <View
          style={styles.etaBlock}
          accessible
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.detailLabel}>PREDICTED ETA</Text>
          {item.etaLoading ? (
            <ActivityIndicator
              size="small"
              color={passengerColors.secondary}
              style={styles.etaLoader}
              accessibilityLabel="Updating ETA"
            />
          ) : (
            <Text
              style={[styles.etaValue, !item.eta && styles.etaValueUnavailable]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {etaLabel}
            </Text>
          )}
          {item.eta && (
            <Text style={styles.etaDistance} numberOfLines={1}>
              {item.eta.remainingDistanceKm.toFixed(1)} km to stop
            </Text>
          )}
        </View>
      </View>

      <View style={styles.openRow}>
        {typeof item.bus.speed === 'number' ? (
          <Text style={styles.speedText}>
            Current speed {item.bus.speed.toFixed(0)} km/h
          </Text>
        ) : (
          <Text style={styles.speedText}>Speed unavailable</Text>
        )}
        <View style={styles.openAction}>
          <Text style={styles.openText}>Track bus</Text>
          <SymbolIcon name="arrow" size={17} color={passengerColors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: passengerSpacing.lg,
    marginBottom: passengerSpacing.sm,
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
    padding: passengerSpacing.md,
    ...passengerShadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeBadge: {
    width: 66,
    minHeight: 68,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.secondary,
    paddingHorizontal: passengerSpacing.xs,
  },
  routeBadgeCaption: {
    color: '#FCECE7',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  routeNumber: {
    color: passengerColors.white,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 1,
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: passengerSpacing.sm,
  },
  routeName: {
    color: passengerColors.text,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  destination: {
    color: passengerColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  statusRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: passengerSpacing.xxs,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  updatedText: {
    flex: 1,
    color: passengerColors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: passengerSpacing.xs,
    marginTop: passengerSpacing.md,
  },
  stopBlock: {
    flex: 1.25,
    minHeight: 82,
    flexDirection: 'row',
    borderRadius: passengerRadii.control,
    backgroundColor: passengerColors.primarySoft,
    padding: passengerSpacing.sm,
  },
  stopIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.surface,
  },
  stopCopy: {
    flex: 1,
    marginLeft: passengerSpacing.xs,
  },
  detailLabel: {
    color: passengerColors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  stopName: {
    color: passengerColors.primaryDark,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 3,
  },
  distance: {
    color: passengerColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  etaBlock: {
    flex: 0.85,
    minWidth: 92,
    minHeight: 82,
    justifyContent: 'center',
    borderRadius: passengerRadii.control,
    backgroundColor: passengerColors.secondarySoft,
    padding: passengerSpacing.sm,
  },
  etaValue: {
    color: passengerColors.secondaryDark,
    fontSize: 22,
    fontWeight: '900',
    marginTop: passengerSpacing.xxs,
  },
  etaValueUnavailable: {
    fontSize: 13,
    lineHeight: 17,
  },
  etaDistance: {
    color: passengerColors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  etaLoader: {
    alignSelf: 'flex-start',
    marginTop: passengerSpacing.xs,
  },
  openRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: passengerSpacing.sm,
    marginTop: passengerSpacing.xs,
  },
  speedText: {
    flex: 1,
    color: passengerColors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
  },
  openAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openText: {
    color: passengerColors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginRight: passengerSpacing.xxs,
  },
});

export default React.memo(NearbyBusCard);
