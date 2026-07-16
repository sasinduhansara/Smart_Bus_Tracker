import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SymbolIcon from '../components/common/SymbolIcon';
import type { PassengerNavigate } from '../navigation/types';
import {
  loadSavedStops,
  recordRecentTrip,
  removeSavedStop,
} from '../services/passengerStorage';
import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../theme/tokens';
import type { SavedStop } from '../types';
import { formatRelativeTime } from '../utils/passengerHome';

interface SavedStopsScreenProps {
  navigate: PassengerNavigate;
}

function SavedStopsScreen({
  navigate,
}: SavedStopsScreenProps): React.JSX.Element {
  const [stops, setStops] = useState<SavedStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStops = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      setStops(await loadSavedStops());
    } catch {
      setError('Saved stops are unavailable on this device.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStops();
  }, [loadStops]);

  const openStop = useCallback(
    (stop: SavedStop) => {
      recordRecentTrip({
        routeNumber: stop.routeNumber,
        destinationName: stop.name,
        destinationStopId: stop.stopId,
      }).catch(() => undefined);
      navigate({
        tab: 'map',
        routeNumber: stop.routeNumber,
        stopId: stop.stopId,
      });
    },
    [navigate],
  );

  const removeStop = useCallback(async (stop: SavedStop) => {
    try {
      setStops(await removeSavedStop(stop.id));
      setError(null);
    } catch {
      setError('This stop could not be removed.');
    }
  }, []);

  const renderStop = useCallback(
    ({ item }: ListRenderItemInfo<SavedStop>) => (
      <View style={styles.stopCard}>
        <TouchableOpacity
          style={styles.stopMain}
          onPress={() => openStop(item)}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={
            item.name +
            ', route ' +
            item.routeNumber +
            ', see arriving buses on live map'
          }
        >
          <View style={styles.stopIcon}>
            <SymbolIcon
              name="location"
              size={22}
              color={passengerColors.primary}
            />
          </View>
          <View style={styles.stopCopy}>
            <Text style={styles.stopName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.routeText}>Route {item.routeNumber}</Text>
            <Text style={styles.savedTime}>
              Saved {formatRelativeTime(item.savedAt).replace('Updated ', '')}
            </Text>
          </View>
          <View style={styles.arrivalsAction}>
            <Text style={styles.arrivalsText}>Arrivals</Text>
            <SymbolIcon
              name="arrow"
              size={17}
              color={passengerColors.primary}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeStop(item)}
          accessibilityRole="button"
          accessibilityLabel={'Remove ' + item.name + ' from saved stops'}
        >
          <SymbolIcon
            name="savedFilled"
            size={20}
            color={passengerColors.secondary}
          />
        </TouchableOpacity>
      </View>
    ),
    [openStop, removeStop],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={passengerColors.background}
      />
      <FlatList
        data={loading ? [] : stops}
        keyExtractor={item => item.id}
        renderItem={renderStop}
        contentContainerStyle={[
          styles.content,
          !loading && stops.length === 0 && styles.emptyContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadStops(true)}
            tintColor={passengerColors.primary}
            colors={[passengerColors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR REGULAR PLACES</Text>
            <Text style={styles.title}>Saved stops</Text>
            <Text style={styles.subtitle}>
              Open a stop to see live buses and select a model-backed arrival
              prediction on the map.
            </Text>
            {error && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => loadStops(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading saved stops"
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={passengerColors.primary} />
              <Text style={styles.loadingText}>Loading saved stops</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <SymbolIcon
                  name="saved"
                  size={27}
                  color={passengerColors.secondary}
                />
              </View>
              <Text style={styles.emptyTitle}>No saved stops yet</Text>
              <Text style={styles.emptyText}>
                Find a real stop in the route directory and tap its bookmark.
              </Text>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => navigate({ tab: 'routes', routeMode: 'search' })}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Search routes and stops"
              >
                <SymbolIcon
                  name="search"
                  size={18}
                  color={passengerColors.surface}
                />
                <Text style={styles.searchButtonText}>Find a stop</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: passengerColors.background,
  },
  content: {
    paddingHorizontal: passengerSpacing.lg,
    paddingBottom: passengerSpacing.xxl,
  },
  emptyContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: passengerSpacing.lg,
    paddingBottom: passengerSpacing.xl,
  },
  eyebrow: {
    color: passengerColors.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: passengerColors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: passengerSpacing.xxs,
  },
  subtitle: {
    color: passengerColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: passengerSpacing.xs,
    maxWidth: 360,
  },
  errorBanner: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.control,
    backgroundColor: passengerColors.secondarySoft,
    paddingHorizontal: passengerSpacing.sm,
    marginTop: passengerSpacing.md,
  },
  errorText: {
    flex: 1,
    color: passengerColors.error,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  retryButton: {
    minWidth: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: passengerColors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  stopCard: {
    minHeight: 106,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
    paddingLeft: passengerSpacing.sm,
    marginBottom: passengerSpacing.sm,
    ...passengerShadows.card,
  },
  stopMain: {
    flex: 1,
    minHeight: 102,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primarySoft,
  },
  stopCopy: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: passengerSpacing.sm,
  },
  stopName: {
    color: passengerColors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  routeText: {
    color: passengerColors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  savedTime: {
    color: passengerColors.textSubtle,
    fontSize: 9,
    marginTop: 3,
  },
  arrivalsAction: {
    alignItems: 'center',
  },
  arrivalsText: {
    color: passengerColors.primary,
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 2,
  },
  removeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: passengerSpacing.xxs,
  },
  loadingState: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: passengerColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: passengerSpacing.sm,
  },
  emptyState: {
    flex: 1,
    minHeight: 330,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.feature,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.xl,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.secondarySoft,
  },
  emptyTitle: {
    color: passengerColors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: passengerSpacing.md,
  },
  emptyText: {
    color: passengerColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: passengerSpacing.xs,
    maxWidth: 280,
  },
  searchButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.pill,
    backgroundColor: passengerColors.primary,
    paddingHorizontal: passengerSpacing.lg,
    marginTop: passengerSpacing.lg,
  },
  searchButtonText: {
    color: passengerColors.surface,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: passengerSpacing.xs,
  },
});

export default SavedStopsScreen;
