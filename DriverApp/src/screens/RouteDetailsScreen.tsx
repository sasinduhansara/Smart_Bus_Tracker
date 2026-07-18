import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
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
import { getAssignedRoute, getDriverProfile } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import type { DriverRouteDetails, DriverRouteStop } from '../types';
import {
  driverColors,
  driverRadii,
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../theme/tokens';

export default function RouteDetailsScreen() {
  const insets = useSafeAreaInsets();
  const onTabPress = useDriverTabs();
  const driverId = useAuthStore(state => state.session?.driver.driver_id);
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const [route, setRoute] = useState<DriverRouteDetails | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [operator, setOperator] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoute = useCallback(
    async (refresh = false) => {
      const sequence = ++requestSequenceRef.current;

      if (!driverId) {
        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setError('The authenticated driver ID is unavailable.');
          setLoading(false);
        }
        return;
      }

      if (mountedRef.current) {
        refresh ? setRefreshing(true) : setLoading(true);
        setError(null);
      }

      try {
        const profile = await getDriverProfile(driverId);

        if (!mountedRef.current || sequence !== requestSequenceRef.current) {
          return;
        }

        setVehicleNumber(profile.vehicleRegistrationNumber || '');
        setOperator(profile.depotOperator || '');

        if (!profile.busRouteNumber) {
          setRoute(null);
          setError('No route is currently assigned to this driver.');
          return;
        }

        const response = await getAssignedRoute(profile.busRouteNumber, refresh);

        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setRoute(response.route);
        }
      } catch (loadError) {
        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Assigned route could not be loaded.',
          );
        }
      } finally {
        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [driverId],
  );

  useEffect(() => {
    mountedRef.current = true;
    loadRoute().catch(() => undefined);

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, [loadRoute]);

  const origin = route?.stops[0];
  const destination = route?.stops[route.stops.length - 1];
  const bottomPadding =
    driverSizes.bottomNavHeight + Math.max(insets.bottom, driverSpacing.md) + 32;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={driverColors.navy900} />
      <DriverHeader
        statusLabel={route ? `${route.stops.length} stops` : 'Route unavailable'}
        statusTone={route ? 'ready' : 'attention'}
        subtitle={vehicleNumber ? `Vehicle ${vehicleNumber}` : 'Assigned route only'}
        title="Route details"
      />

      {loading && !route ? (
        <LoadingState message="Loading the backend route and stop sequence" style={styles.state} />
      ) : error && !route ? (
        <ErrorState
          message={error}
          onAction={() => loadRoute().catch(() => undefined)}
          style={styles.state}
          title="Route unavailable"
        />
      ) : (
        <FlatList
          ListEmptyComponent={
            <EmptyState
              icon="map-outline"
              message="This route has no valid stops in the backend."
              title="No stops available"
            />
          }
          ListHeaderComponent={
            <>
              {error ? (
                <View accessibilityRole="alert" style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <View style={styles.summaryCard}>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeLabel}>ROUTE</Text>
                  <Text style={styles.routeBadgeNumber}>{route?.routeNumber}</Text>
                </View>
                <View style={styles.summaryCopy}>
                  <Text accessibilityRole="header" style={styles.routeName}>
                    {route?.name || 'Assigned route'}
                  </Text>
                  <Text style={styles.direction}>
                    {route?.direction || 'Direction unavailable'}
                  </Text>
                  {operator ? <Text style={styles.operator}>{operator}</Text> : null}
                </View>
              </View>
              <View style={styles.endpointsCard}>
                <Endpoint icon="radio-button-on" label="Origin" value={origin?.name || 'Not recorded'} />
                <View style={styles.endpointLine} />
                <Endpoint icon="flag" label="Destination" value={destination?.name || 'Not recorded'} />
              </View>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Stop sequence</Text>
            </>
          }
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomPadding },
          ]}
          data={route?.stops || []}
          ItemSeparatorComponent={StopSeparator}
          keyExtractor={stop => stop.id}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadRoute(true).catch(() => undefined)}
              refreshing={refreshing}
              tintColor={driverColors.teal700}
            />
          }
          renderItem={({ item, index }) => (
            <StopRow
              finalStop={index === (route?.stops.length || 0) - 1}
              firstStop={index === 0}
              stop={item}
              totalStops={route?.stops.length || 0}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomNav activeTab="route" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function Endpoint({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.endpoint}>
      <Icon name={icon} size={driverSizes.iconMedium} color={label === 'Origin' ? driverColors.teal700 : driverColors.amber600} />
      <View style={styles.endpointCopy}>
        <Text style={styles.endpointLabel}>{label}</Text>
        <Text style={styles.endpointValue}>{value}</Text>
      </View>
    </View>
  );
}

function StopSeparator() {
  return <View style={styles.separator} />;
}

function StopRow({
  stop,
  firstStop,
  finalStop,
  totalStops,
}: {
  stop: DriverRouteStop;
  firstStop: boolean;
  finalStop: boolean;
  totalStops: number;
}) {
  return (
    <View
      accessibilityLabel={`Stop ${stop.sequence} of ${totalStops}: ${stop.name}`}
      style={styles.stopRow}
    >
      <View style={[
        styles.stopSequence,
        firstStop && styles.stopSequenceOrigin,
        finalStop && styles.stopSequenceDestination,
      ]}>
        <Text style={styles.stopSequenceText}>{stop.sequence}</Text>
      </View>
      <View style={styles.stopCopy}>
        <Text style={styles.stopName}>{stop.name}</Text>
        <Text style={styles.stopMeta}>
          {firstStop ? 'Route origin' : finalStop ? 'Final destination' : 'Scheduled stop'}
        </Text>
      </View>
      <Icon name={finalStop ? 'flag-outline' : 'ellipsis-vertical'} size={driverSizes.iconSmall} color={driverColors.textSubtle} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: driverColors.background },
  state: { flex: 1, margin: driverSpacing.md },
  content: { width: '100%', maxWidth: driverSizes.contentMaxWidth, alignSelf: 'center', padding: driverSpacing.md },
  errorBanner: { padding: driverSpacing.sm, marginBottom: driverSpacing.sm, borderRadius: driverRadii.control, backgroundColor: driverColors.errorSoft },
  errorText: { color: driverColors.error, fontSize: driverTypography.label },
  summaryCard: { flexDirection: 'row', gap: driverSpacing.md, padding: driverSpacing.lg, borderRadius: driverRadii.feature, backgroundColor: driverColors.navy900, ...driverShadows.raised },
  routeBadge: { minWidth: 78, alignItems: 'center', justifyContent: 'center', padding: driverSpacing.sm, borderRadius: driverRadii.card, backgroundColor: driverColors.amber500 },
  routeBadgeLabel: { color: driverColors.navy950, fontSize: driverTypography.caption, fontWeight: driverTypography.weights.bold },
  routeBadgeNumber: { color: driverColors.navy950, fontSize: driverTypography.pageTitle, fontWeight: driverTypography.weights.heavy },
  summaryCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  routeName: { color: driverColors.textOnDark, fontSize: driverTypography.cardTitle, fontWeight: driverTypography.weights.heavy },
  direction: { color: driverColors.teal100, fontSize: driverTypography.label, textTransform: 'capitalize', marginTop: driverSpacing.xxs },
  operator: { color: driverColors.border, fontSize: driverTypography.caption, marginTop: driverSpacing.xs },
  endpointsCard: { marginTop: driverSpacing.md, padding: driverSpacing.md, borderRadius: driverRadii.card, borderWidth: 1, borderColor: driverColors.border, backgroundColor: driverColors.surface },
  endpoint: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: driverSpacing.sm },
  endpointCopy: { flex: 1 },
  endpointLabel: { color: driverColors.textMuted, fontSize: driverTypography.caption, fontWeight: driverTypography.weights.bold, textTransform: 'uppercase' },
  endpointValue: { color: driverColors.text, fontSize: driverTypography.body, fontWeight: driverTypography.weights.bold, marginTop: driverSpacing.xxs },
  endpointLine: { width: 2, height: 22, marginLeft: 10, backgroundColor: driverColors.border },
  sectionTitle: { color: driverColors.text, fontSize: driverTypography.cardTitle, fontWeight: driverTypography.weights.heavy, marginTop: driverSpacing.lg, marginBottom: driverSpacing.sm },
  stopRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: driverSpacing.sm, padding: driverSpacing.sm, backgroundColor: driverColors.surface },
  stopSequence: { width: driverSizes.minimumTouchTarget, height: driverSizes.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: driverRadii.pill, backgroundColor: driverColors.surfaceMuted },
  stopSequenceOrigin: { backgroundColor: driverColors.teal100 },
  stopSequenceDestination: { backgroundColor: driverColors.warningSoft },
  stopSequenceText: { color: driverColors.text, fontSize: driverTypography.label, fontWeight: driverTypography.weights.heavy },
  stopCopy: { flex: 1, minWidth: 0 },
  stopName: { color: driverColors.text, fontSize: driverTypography.body, fontWeight: driverTypography.weights.bold },
  stopMeta: { color: driverColors.textMuted, fontSize: driverTypography.caption, marginTop: driverSpacing.xxs },
  separator: { height: 1, marginHorizontal: driverSpacing.sm, backgroundColor: driverColors.border },
});
