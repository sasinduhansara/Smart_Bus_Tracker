import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import BottomNav from '../components/BottomNav';
import { DriverHeader, EmptyState, ErrorState, LoadingState } from '../components/driver';
import { useDriverTabs } from '../navigation/useDriverTabs';
import { getTripHistory } from '../services/api';
import type { DriverTrip, ServerTripStatus } from '../types';
import {
  driverColors,
  driverRadii,
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../theme/tokens';

type TripFilter = 'all' | ServerTripStatus;

const FILTERS: Array<{ key: TripFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
];

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(Math.floor(seconds || 0), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const onTabPress = useDriverTabs();
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [filter, setFilter] = useState<TripFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async (refresh = false) => {
    const sequence = ++requestSequenceRef.current;

    if (mountedRef.current) {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);
    }

    try {
      const response = await getTripHistory(50);

      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setTrips(response.trips);
      }
    } catch (loadError) {
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Trip history could not be loaded.',
        );
      }
    } finally {
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadTrips().catch(() => undefined);

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, [loadTrips]);

  const visibleTrips = useMemo(
    () =>
      filter === 'all'
        ? trips
        : trips.filter(trip => trip.status === filter),
    [filter, trips],
  );
  const bottomPadding =
    driverSizes.bottomNavHeight + Math.max(insets.bottom, driverSpacing.md) + 32;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={driverColors.navy900} />
      <DriverHeader
        statusLabel={`${trips.length} recorded`}
        statusTone="neutral"
        subtitle="Authoritative backend records"
        title="Trip history"
      />

      {loading && trips.length === 0 ? (
        <LoadingState
          message="Loading your trip records"
          style={styles.state}
          title="Loading history"
        />
      ) : error && trips.length === 0 ? (
        <ErrorState
          message={error}
          onAction={() => loadTrips().catch(() => undefined)}
          style={styles.state}
          title="History unavailable"
        />
      ) : (
        <FlatList
          ListEmptyComponent={
            <EmptyState
              icon="bus-outline"
              message={
                filter === 'all'
                  ? 'Completed and unfinished trips will appear here.'
                  : `No ${filter} trips match this filter.`
              }
              title="No trips found"
            />
          }
          ListHeaderComponent={
            <>
              {error ? (
                <View accessibilityRole="alert" style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => loadTrips(true).catch(() => undefined)}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              <View accessibilityRole="tablist" style={styles.filters}>
                {FILTERS.map(item => {
                  const selected = filter === item.key;

                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      onPress={() => setFilter(item.key)}
                      style={[
                        styles.filter,
                        selected && styles.filterSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          selected && styles.filterTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomPadding },
          ]}
          data={visibleTrips}
          keyExtractor={trip => trip.id}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadTrips(true).catch(() => undefined)}
              refreshing={refreshing}
              tintColor={driverColors.teal700}
            />
          }
          renderItem={({ item }) => <TripHistoryCard trip={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNav activeTab="trip" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function TripHistoryCard({ trip }: { trip: DriverTrip }) {
  const statusStyle =
    trip.status === 'completed'
      ? styles.statusCompleted
      : trip.status === 'active'
      ? styles.statusActive
      : styles.statusPaused;

  return (
    <View
      accessibilityLabel={`${trip.origin} to ${trip.destination}. ${trip.status}. Started ${formatDate(
        trip.startedAt,
      )}. Active ${formatDuration(trip.activeDurationSeconds)}`}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <View style={styles.busIcon}>
          <Icon name="bus" size={driverSizes.iconMedium} color={driverColors.teal700} />
        </View>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.routeNumber}>Route {trip.routeNumber || 'unavailable'}</Text>
          <Text style={styles.vehicle}>{trip.vehicleRegistrationNumber || 'No vehicle recorded'}</Text>
        </View>
        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={styles.statusText}>{trip.status}</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routeDot} />
        <View style={styles.routeLine} />
        <View style={[styles.routeDot, styles.destinationDot]} />
        <View style={styles.routeCopy}>
          <Text style={styles.routePlace}>{trip.origin || 'Origin not recorded'}</Text>
          <Text style={styles.routePlace}>{trip.destination || 'Destination not recorded'}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <HistoryMetric icon="calendar-outline" label={formatDate(trip.startedAt)} />
        <HistoryMetric icon="time-outline" label={formatDuration(trip.activeDurationSeconds)} />
        <HistoryMetric
          icon="navigate-outline"
          label={`${Math.max(trip.distanceKm || 0, 0).toFixed(1)} km`}
        />
      </View>
    </View>
  );
}

function HistoryMetric({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Icon name={icon} size={driverSizes.iconSmall} color={driverColors.textMuted} />
      <Text style={styles.metricText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: driverColors.background },
  state: { flex: 1, margin: driverSpacing.md },
  listContent: {
    width: '100%',
    maxWidth: driverSizes.contentMaxWidth,
    alignSelf: 'center',
    gap: driverSpacing.sm,
    padding: driverSpacing.md,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: driverSpacing.xs, marginBottom: driverSpacing.sm },
  filter: {
    minHeight: driverSizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: driverSpacing.md,
    borderRadius: driverRadii.pill,
    borderWidth: 1,
    borderColor: driverColors.border,
    backgroundColor: driverColors.surface,
  },
  filterSelected: { borderColor: driverColors.teal700, backgroundColor: driverColors.teal100 },
  filterText: { color: driverColors.textMuted, fontSize: driverTypography.label, fontWeight: driverTypography.weights.bold },
  filterTextSelected: { color: driverColors.teal700 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.sm,
    padding: driverSpacing.sm,
    marginBottom: driverSpacing.sm,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.errorSoft,
  },
  errorText: { flex: 1, color: driverColors.error, fontSize: driverTypography.label },
  retryButton: { minHeight: driverSizes.minimumTouchTarget, justifyContent: 'center', paddingHorizontal: driverSpacing.sm },
  retryText: { color: driverColors.error, fontWeight: driverTypography.weights.bold },
  card: {
    padding: driverSpacing.md,
    borderRadius: driverRadii.card,
    borderWidth: 1,
    borderColor: driverColors.border,
    backgroundColor: driverColors.surface,
    ...driverShadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: driverSpacing.sm },
  busIcon: {
    width: driverSizes.compactTouchTarget,
    height: driverSizes.compactTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.teal100,
  },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  routeNumber: { color: driverColors.text, fontSize: driverTypography.bodyLarge, fontWeight: driverTypography.weights.heavy },
  vehicle: { color: driverColors.textMuted, fontSize: driverTypography.caption, marginTop: driverSpacing.xxs },
  statusBadge: { paddingHorizontal: driverSpacing.sm, paddingVertical: driverSpacing.xs, borderRadius: driverRadii.pill },
  statusCompleted: { backgroundColor: driverColors.successSoft },
  statusActive: { backgroundColor: driverColors.teal100 },
  statusPaused: { backgroundColor: driverColors.warningSoft },
  statusText: { color: driverColors.text, fontSize: driverTypography.caption, fontWeight: driverTypography.weights.bold, textTransform: 'capitalize' },
  routeRow: { minHeight: 76, marginTop: driverSpacing.md, paddingLeft: 7, position: 'relative' },
  routeDot: { position: 'absolute', left: 2, top: 5, width: 11, height: 11, borderRadius: 6, backgroundColor: driverColors.teal700 },
  destinationDot: { top: 57, backgroundColor: driverColors.amber600 },
  routeLine: { position: 'absolute', left: 6, top: 16, width: 3, height: 41, backgroundColor: driverColors.border },
  routeCopy: { flex: 1, justifyContent: 'space-between', marginLeft: driverSpacing.lg, minHeight: 72 },
  routePlace: { color: driverColors.text, fontSize: driverTypography.body, fontWeight: driverTypography.weights.semibold },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: driverSpacing.md, paddingTop: driverSpacing.sm, borderTopWidth: 1, borderTopColor: driverColors.border },
  metric: { flexDirection: 'row', alignItems: 'center', gap: driverSpacing.xxs },
  metricText: { color: driverColors.textMuted, fontSize: driverTypography.caption },
});
