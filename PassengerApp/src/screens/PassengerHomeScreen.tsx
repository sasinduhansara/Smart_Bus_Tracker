import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DestinationSearch from '../components/home/DestinationSearch';
import {
  HomeErrorBanner,
  HomeLoadingSkeleton,
  NearbyEmptyState,
} from '../components/home/HomeStateViews';
import LiveMapPreviewCard from '../components/home/LiveMapPreviewCard';
import NearbyBusCard from '../components/home/NearbyBusCard';
import PassengerHomeHeader from '../components/home/PassengerHomeHeader';
import QuickActionGrid from '../components/home/QuickActionGrid';
import RecentTripsSection from '../components/home/RecentTripsSection';
import SavedStopsSection from '../components/home/SavedStopsSection';
import SymbolIcon from '../components/common/SymbolIcon';
import { usePassengerHomeData } from '../hooks/usePassengerHomeData';
import { usePassengerLocation } from '../hooks/usePassengerLocation';
import type { PassengerNavigate } from '../navigation/types';
import { searchPassengerDirectory } from '../services/api';
import {
  loadRecentSearches,
  loadRecentTrips,
  loadSavedStops,
  recordRecentSearch,
  recordRecentTrip,
  removeSavedStop,
  toggleSavedStop,
} from '../services/passengerStorage';
import { passengerColors, passengerSpacing } from '../theme/tokens';
import type {
  NearbyBus,
  PassengerSearchResult,
  RecentSearch,
  RecentTrip,
  SavedStop,
} from '../types';
import { getSavedStopId, searchRoutesAndStops } from '../utils/passengerHome';

const SEARCH_DEBOUNCE_MS = 280;
const HOME_BUS_LIMIT = 4;

interface PassengerHomeScreenProps {
  navigate: PassengerNavigate;
}

function PassengerHomeScreen({
  navigate,
}: PassengerHomeScreenProps): React.JSX.Element {
  const locationState = usePassengerLocation();
  const homeData = usePassengerHomeData(locationState.location);
  const [query, setQuery] = useState('');
  const searchRequestIdRef = useRef(0);
  const [searchResults, setSearchResults] = useState<PassengerSearchResult[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [savedStops, setSavedStops] = useState<SavedStop[]>([]);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);

  const loadStoredData = useCallback(async () => {
    try {
      const [nextStops, nextTrips, nextSearches] = await Promise.all([
        loadSavedStops(),
        loadRecentTrips(),
        loadRecentSearches(),
      ]);
      setSavedStops(nextStops);
      setRecentTrips(nextTrips);
      setRecentSearches(nextSearches);
      setStorageError(null);
    } catch {
      setStorageError('Saved stops and recent journeys are unavailable.');
    }
  }, []);

  useEffect(() => {
    loadStoredData();
  }, [loadStoredData]);

  useEffect(() => {
    if (!query.trim()) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const controller = new AbortController();
    setIsSearching(true);
    setSearchResults([]);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const response = await searchPassengerDirectory(
          query,
          12,
          controller.signal,
        );

        if (searchRequestIdRef.current === requestId) {
          setSearchResults(response.results);
        }
      } catch (searchRequestError) {
        if (controller.signal.aborted) {
          return;
        }

        if (searchRequestIdRef.current === requestId) {
          const fallbackResults = searchRoutesAndStops(
            query,
            homeData.routes,
            homeData.routeDetails,
          );
          setSearchResults(fallbackResults);
          setSearchError(
            fallbackResults.length
              ? null
              : searchRequestError instanceof Error &&
                searchRequestError.message.trim()
              ? searchRequestError.message
              : 'Please check your connection and try again.',
          );
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [homeData.routeDetails, homeData.routes, query]);

  const savedStopIds = useMemo(
    () => new Set(savedStops.map(stop => stop.id)),
    [savedStops],
  );

  const openSearchResult = useCallback(
    async (result: PassengerSearchResult) => {
      try {
        setRecentSearches(await recordRecentSearch(result));

        if (result.type === 'stop') {
          setRecentTrips(
            await recordRecentTrip({
              routeNumber: result.routeNumber,
              destinationName: result.title,
              destinationStopId: result.stopId,
            }),
          );
        }
      } catch {
        setStorageError('This journey could not be added to your history.');
      }

      setQuery('');
      navigate({
        tab: 'map',
        routeNumber: result.routeNumber,
        stopId: result.stopId,
      });
    },
    [navigate],
  );

  const handleToggleSaved = useCallback(
    async (result: PassengerSearchResult) => {
      if (result.type !== 'stop' || !result.stopId) {
        return;
      }

      try {
        const stop: SavedStop = {
          id: getSavedStopId(result.routeNumber, result.stopId),
          routeNumber: result.routeNumber,
          stopId: result.stopId,
          name: result.title,
          savedAt: new Date().toISOString(),
        };
        setSavedStops(await toggleSavedStop(stop));
        setStorageError(null);
      } catch {
        setStorageError('This stop could not be saved on your device.');
      }
    },
    [],
  );

  const handleOpenBus = useCallback(
    (item: NearbyBus) => {
      if (item.bus.routeNumber && item.nextStop) {
        recordRecentTrip({
          routeNumber: item.bus.routeNumber,
          destinationName: item.nextStop.name,
          destinationStopId: item.nextStop.id,
        })
          .then(setRecentTrips)
          .catch(() => {
            setStorageError('This journey could not be added to your history.');
          });
      }

      navigate({
        tab: 'map',
        busId: item.bus.bus_id,
        routeNumber: item.bus.routeNumber,
        stopId: item.nextStop?.id,
      });
    },
    [navigate],
  );

  const handleRemoveSavedStop = useCallback(async (stop: SavedStop) => {
    try {
      setSavedStops(await removeSavedStop(stop.id));
      setStorageError(null);
    } catch {
      setStorageError('This saved stop could not be removed.');
    }
  }, []);

  const openSavedStop = useCallback(
    (stop: SavedStop) => {
      recordRecentTrip({
        routeNumber: stop.routeNumber,
        destinationName: stop.name,
        destinationStopId: stop.stopId,
      })
        .then(setRecentTrips)
        .catch(() => {
          setStorageError('This journey could not be added to your history.');
        });
      navigate({
        tab: 'map',
        routeNumber: stop.routeNumber,
        stopId: stop.stopId,
      });
    },
    [navigate],
  );

  const repeatTrip = useCallback(
    (trip: RecentTrip) => {
      recordRecentTrip({
        routeNumber: trip.routeNumber,
        destinationName: trip.destinationName,
        destinationStopId: trip.destinationStopId,
        originName: trip.originName,
      })
        .then(setRecentTrips)
        .catch(() => {
          setStorageError('This journey could not be updated.');
        });
      navigate({
        tab: 'map',
        routeNumber: trip.routeNumber,
        stopId: trip.destinationStopId,
      });
    },
    [navigate],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([homeData.refresh(), loadStoredData()]);
  }, [homeData, loadStoredData]);

  const visibleBuses = useMemo(
    () => homeData.nearbyBuses.slice(0, HOME_BUS_LIMIT),
    [homeData.nearbyBuses],
  );

  const renderBus = useCallback(
    ({ item }: ListRenderItemInfo<NearbyBus>) => (
      <NearbyBusCard item={item} now={homeData.now} onPress={handleOpenBus} />
    ),
    [handleOpenBus, homeData.now],
  );

  const listHeader = (
    <>
      <PassengerHomeHeader
        liveBusCount={homeData.liveBusCount}
        socketStatus={homeData.socketStatus}
        locationMessage={locationState.message}
        canRetryLocation={
          locationState.status !== 'granted' &&
          locationState.status !== 'requesting'
        }
        onRetryLocation={locationState.retry}
        onOpenSaved={() => navigate({ tab: 'saved' })}
      />
      <DestinationSearch
        query={query}
        results={searchResults}
        recentSearches={recentSearches}
        savedStopIds={savedStopIds}
        isSearching={isSearching}
        searchError={searchError}
        onChangeQuery={setQuery}
        onSelectResult={openSearchResult}
        onToggleSaved={handleToggleSaved}
      />
      <QuickActionGrid navigate={navigate} />

      <View style={styles.nearbyHeading}>
        <View style={styles.nearbyCopy}>
          <Text style={styles.nearbyEyebrow}>
            {locationState.status === 'granted'
              ? 'SORTED BY DISTANCE'
              : 'SORTED BY LIVE STATUS'}
          </Text>
          <Text style={styles.nearbyTitle}>
            {locationState.status === 'granted'
              ? 'Buses near you'
              : 'Live buses right now'}
          </Text>
          <Text style={styles.nearbySubtitle} numberOfLines={2}>
            {locationState.status === 'granted'
              ? 'Real locations, next stops, and available ETA predictions'
              : 'Location is optional. Live operator updates remain visible.'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => navigate({ tab: 'map' })}
          accessibilityRole="button"
          accessibilityLabel="View all buses on live map"
        >
          <Text style={styles.viewAllText}>View map</Text>
          <SymbolIcon name="arrow" size={16} color={passengerColors.primary} />
        </TouchableOpacity>
      </View>

      {homeData.error && (
        <HomeErrorBanner message={homeData.error} onRetry={homeData.refresh} />
      )}
      {homeData.loading && <HomeLoadingSkeleton />}
    </>
  );

  const listFooter = (
    <>
      <LiveMapPreviewCard
        liveBusCount={homeData.liveBusCount}
        totalBusCount={homeData.buses.length}
        connectionStatus={homeData.socketStatus}
        onOpenMap={() => navigate({ tab: 'map' })}
      />
      <SavedStopsSection
        stops={savedStops}
        onViewAll={() => navigate({ tab: 'saved' })}
        onOpenStop={openSavedStop}
        onRemoveStop={handleRemoveSavedStop}
      />
      <RecentTripsSection trips={recentTrips} onRepeatTrip={repeatTrip} />
      {storageError && (
        <Text style={styles.storageError} accessibilityRole="alert">
          {storageError}
        </Text>
      )}
      <View style={styles.footer}>
        <View style={styles.footerLine} />
        <Text style={styles.footerText}>
          Live information depends on operator GPS updates.
        </Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={passengerColors.background}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={homeData.loading ? [] : visibleBuses}
          keyExtractor={item => item.bus.bus_id}
          renderItem={renderBus}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            homeData.loading ? null : (
              <NearbyEmptyState
                locationAvailable={Boolean(locationState.location)}
                onOpenMap={() => navigate({ tab: 'map' })}
              />
            )
          }
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={homeData.refreshing}
              onRefresh={handleRefresh}
              tintColor={passengerColors.primary}
              colors={[passengerColors.primary, passengerColors.secondary]}
              progressBackgroundColor={passengerColors.surface}
              accessibilityLabel="Refresh passenger home data"
            />
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: passengerColors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: passengerSpacing.xxl,
  },
  nearbyHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: passengerSpacing.sm,
    paddingHorizontal: passengerSpacing.lg,
    marginTop: passengerSpacing.xxl,
    marginBottom: passengerSpacing.sm,
  },
  nearbyCopy: {
    flex: 1,
  },
  nearbyEyebrow: {
    color: passengerColors.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  nearbyTitle: {
    color: passengerColors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  nearbySubtitle: {
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: passengerSpacing.xxs,
  },
  viewAllButton: {
    minWidth: 82,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  viewAllText: {
    color: passengerColors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginRight: 2,
  },
  storageError: {
    color: passengerColors.error,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginHorizontal: passengerSpacing.xl,
    marginTop: passengerSpacing.lg,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: passengerSpacing.xl,
    paddingTop: passengerSpacing.xxl,
  },
  footerLine: {
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor: passengerColors.border,
  },
  footerText: {
    color: passengerColors.textSubtle,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: passengerSpacing.sm,
  },
});

export default PassengerHomeScreen;
