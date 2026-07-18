import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DriverHomeTrip } from '../../types';
import {
  driverColors,
  driverRadii,
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../../theme/tokens';

export function DashboardStats({
  totalTrips,
  distanceKm,
  activeLabel,
}: {
  totalTrips: number;
  distanceKm: number;
  activeLabel: string;
}) {
  const values = [
    { label: 'Completed trips', value: String(totalTrips) },
    { label: 'Recorded distance', value: `${distanceKm.toFixed(1)} km` },
    { label: 'Active time', value: activeLabel },
  ];

  return (
    <View style={styles.statsRow}>
      {values.map(item => (
        <View
          key={item.label}
          accessibilityLabel={`${item.label}: ${item.value}`}
          style={styles.statCard}
        >
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function RecentTrips({
  trips,
  onViewAll,
}: {
  trips: DriverHomeTrip[];
  onViewAll: () => void;
}) {
  return (
    <View style={styles.recentCard}>
      <View style={styles.recentHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Recent trips
        </Text>
        <Text accessibilityRole="link" onPress={onViewAll} style={styles.link}>
          View all
        </Text>
      </View>
      {trips.length === 0 ? (
        <Text style={styles.emptyText}>No completed trips are recorded yet.</Text>
      ) : (
        trips.slice(0, 3).map(trip => <RecentTripRow key={trip.id} trip={trip} />)
      )}
    </View>
  );
}

function RecentTripRow({ trip }: { trip: DriverHomeTrip }) {
  return (
    <View
      accessibilityLabel={`${trip.from} to ${trip.to}, ${trip.status}, ${trip.distance}`}
      style={styles.tripRow}
    >
      <View style={styles.tripCopy}>
        <Text style={styles.tripRoute} numberOfLines={1}>
          {trip.from && trip.to ? `${trip.from} → ${trip.to}` : 'Route not recorded'}
        </Text>
        <Text style={styles.tripMeta}>
          {trip.time || 'Time unavailable'} · {trip.distance}
        </Text>
      </View>
      <Text style={styles.tripStatus}>{trip.status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: driverSpacing.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '29%',
    minWidth: 100,
    padding: driverSpacing.md,
    borderRadius: driverRadii.card,
    borderWidth: 1,
    borderColor: driverColors.border,
    backgroundColor: driverColors.surface,
    ...driverShadows.card,
  },
  statValue: {
    color: driverColors.teal700,
    fontSize: driverTypography.cardTitle,
    fontWeight: driverTypography.weights.heavy,
  },
  statLabel: {
    color: driverColors.textMuted,
    fontSize: driverTypography.caption,
    lineHeight: 16,
    marginTop: driverSpacing.xxs,
  },
  recentCard: {
    padding: driverSpacing.md,
    borderRadius: driverRadii.card,
    borderWidth: 1,
    borderColor: driverColors.border,
    backgroundColor: driverColors.surface,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: driverSpacing.md,
    marginBottom: driverSpacing.sm,
  },
  sectionTitle: {
    color: driverColors.text,
    fontSize: driverTypography.cardTitle,
    fontWeight: driverTypography.weights.heavy,
  },
  link: {
    minHeight: driverSizes.minimumTouchTarget,
    color: driverColors.teal700,
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.bold,
    textAlignVertical: 'center',
    paddingVertical: driverSpacing.sm,
  },
  emptyText: {
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    lineHeight: 21,
    paddingVertical: driverSpacing.md,
  },
  tripRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: driverColors.border,
    paddingVertical: driverSpacing.sm,
  },
  tripCopy: { flex: 1, minWidth: 0 },
  tripRoute: {
    color: driverColors.text,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
  },
  tripMeta: {
    color: driverColors.textMuted,
    fontSize: driverTypography.caption,
    marginTop: driverSpacing.xxs,
  },
  tripStatus: {
    maxWidth: 100,
    color: driverColors.success,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.bold,
    textAlign: 'right',
  },
});
