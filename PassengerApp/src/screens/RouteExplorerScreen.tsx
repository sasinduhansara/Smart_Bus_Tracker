import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SymbolIcon from '../components/common/SymbolIcon';
import type {
  PassengerNavigate,
  RouteDirectoryMode,
} from '../navigation/types';
import { getRoutes, searchPassengerDirectory } from '../services/api';
import {
  loadSavedStops,
  recordRecentSearch,
  recordRecentTrip,
  toggleSavedStop,
} from '../services/passengerStorage';
import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../theme/tokens';
import type { PassengerSearchResult, RouteSummary, SavedStop } from '../types';
import { getSavedStopId, searchRoutesAndStops } from '../utils/passengerHome';

interface RouteExplorerScreenProps {
  mode?: RouteDirectoryMode;
  navigate: PassengerNavigate;
}

function RouteExplorerScreen({
  mode = 'search',
  navigate,
}: RouteExplorerScreenProps): React.JSX.Element {
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [savedStops, setSavedStops] = useState<SavedStop[]>([]);
  const [query, setQuery] = useState('');
  const searchRequestIdRef = useRef(0);
  const [searchResults, setSearchResults] = useState<PassengerSearchResult[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [routeResponse, storedStops] = await Promise.all([
        getRoutes(),
        loadSavedStops(),
      ]);
      setRoutes(routeResponse.routes);
      setSavedStops(storedStops);
    } catch (loadError) {
      setError(
        loadError instanceof Error && loadError.message.trim()
          ? loadError.message
          : 'The route directory is temporarily unavailable.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (!query.trim()) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const controller = new AbortController();
    setIsSearching(true);
    setSearchResults([]);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const response = await searchPassengerDirectory(
          query,
          25,
          controller.signal,
        );

        if (searchRequestIdRef.current === requestId) {
          setSearchResults(response.results);
          setError(null);
        }
      } catch (searchError) {
        if (
          !controller.signal.aborted &&
          searchRequestIdRef.current === requestId
        ) {
          setSearchResults(searchRoutesAndStops(query, routes, {}));
          setError(
            searchError instanceof Error && searchError.message.trim()
              ? searchError.message
              : 'Route search is temporarily unavailable.',
          );
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, routes]);

  const savedIds = useMemo(
    () => new Set(savedStops.map(stop => stop.id)),
    [savedStops],
  );

  const results = useMemo<PassengerSearchResult[]>(() => {
    if (query.trim()) {
      return searchResults;
    }

    return routes.map(route => ({
      id: 'route:' + route.routeNumber,
      type: 'route',
      title: 'Route ' + route.routeNumber,
      subtitle: route.name,
      routeNumber: route.routeNumber,
    }));
  }, [query, routes, searchResults]);

  const openResult = useCallback(
    (result: PassengerSearchResult) => {
      recordRecentSearch(result).catch(() => undefined);

      if (result.type === 'stop') {
        recordRecentTrip({
          routeNumber: result.routeNumber,
          destinationName: result.title,
          destinationStopId: result.stopId,
        }).catch(() => undefined);
      }

      navigate({
        tab: 'map',
        routeNumber: result.routeNumber,
        stopId: result.stopId,
      });
    },
    [navigate],
  );

  const toggleResult = useCallback(async (result: PassengerSearchResult) => {
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
    } catch {
      setError('This stop could not be saved on your device.');
    }
  }, []);

  const renderResult = useCallback(
    ({ item }: ListRenderItemInfo<PassengerSearchResult>) => {
      const savedId =
        item.stopId && getSavedStopId(item.routeNumber, item.stopId);
      const isSaved = Boolean(savedId && savedIds.has(savedId));
      const route = routes.find(
        candidate => candidate.routeNumber === item.routeNumber,
      );

      return (
        <View style={styles.resultCard}>
          <TouchableOpacity
            style={styles.resultMain}
            onPress={() => openResult(item)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={item.title + ', ' + item.subtitle}
          >
            <View
              style={[
                styles.resultIcon,
                item.type === 'stop' && styles.stopResultIcon,
              ]}
            >
              <SymbolIcon
                name={item.type === 'stop' ? 'location' : 'route'}
                size={21}
                color={
                  item.type === 'stop'
                    ? passengerColors.secondary
                    : passengerColors.primary
                }
              />
            </View>
            <View style={styles.resultCopy}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.resultSubtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
              {item.type === 'route' && route && (
                <Text style={styles.resultMeta}>
                  {route.stopCount} stops · {route.direction}
                </Text>
              )}
            </View>
            <SymbolIcon
              name="arrow"
              size={18}
              color={passengerColors.textSubtle}
            />
          </TouchableOpacity>

          {item.type === 'stop' && (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => toggleResult(item)}
              accessibilityRole="button"
              accessibilityLabel={
                isSaved
                  ? 'Remove ' + item.title + ' from saved stops'
                  : 'Save ' + item.title
              }
            >
              <SymbolIcon
                name={isSaved ? 'savedFilled' : 'saved'}
                size={20}
                color={
                  isSaved
                    ? passengerColors.secondary
                    : passengerColors.textMuted
                }
              />
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [openResult, routes, savedIds, toggleResult],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={passengerColors.background}
      />
      <FlatList
        data={loading ? [] : results}
        keyExtractor={item => item.id}
        renderItem={renderResult}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDirectory(true)}
            tintColor={passengerColors.primary}
            colors={[passengerColors.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>
                {mode === 'timetables'
                  ? 'ROUTE INFORMATION'
                  : 'EXPLORE THE NETWORK'}
              </Text>
              <Text style={styles.title}>
                {mode === 'timetables' ? 'Timetables' : 'Find your route'}
              </Text>
              <Text style={styles.subtitle}>
                Search the live route directory by number, destination, town, or
                stop.
              </Text>
            </View>

            {mode === 'timetables' && (
              <View style={styles.notice}>
                <SymbolIcon
                  name="calendar"
                  size={20}
                  color={passengerColors.warning}
                />
                <Text style={styles.noticeText}>
                  Published departure times are not available from the backend
                  yet. Verified routes and stops are shown below.
                </Text>
              </View>
            )}

            <View style={styles.searchField}>
              <SymbolIcon
                name="search"
                size={21}
                color={passengerColors.primary}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Route number, stop, or town"
                placeholderTextColor={passengerColors.textSubtle}
                style={styles.input}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search route directory"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear route search"
                >
                  <SymbolIcon
                    name="close"
                    size={18}
                    color={passengerColors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {error && (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => loadDirectory(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry route directory"
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.listHeading}>
              <Text style={styles.listTitle}>
                {query.trim() ? 'Search results' : 'Available routes'}
              </Text>
              <Text style={styles.countText}>
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading || isSearching ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={passengerColors.primary} />
              <Text style={styles.loadingText}>
                {isSearching
                  ? 'Searching routes and stops'
                  : 'Loading route directory'}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <SymbolIcon
                name="route"
                size={28}
                color={passengerColors.textSubtle}
              />
              <Text style={styles.emptyTitle}>
                {query.trim()
                  ? 'No matching routes or stops'
                  : 'No routes are available'}
              </Text>
              <Text style={styles.emptyText}>
                {query.trim()
                  ? 'The backend did not return a match for this search.'
                  : 'The backend has not published any route data yet.'}
              </Text>
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
  header: {
    paddingTop: passengerSpacing.lg,
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
  notice: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: '#E8D0AA',
    backgroundColor: '#FAEEDC',
    padding: passengerSpacing.sm,
    marginTop: passengerSpacing.lg,
  },
  noticeText: {
    flex: 1,
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
    marginLeft: passengerSpacing.sm,
  },
  searchField: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
    paddingHorizontal: passengerSpacing.md,
    marginTop: passengerSpacing.lg,
    ...passengerShadows.card,
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: passengerColors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: passengerSpacing.sm,
    paddingVertical: 0,
  },
  clearButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.control,
    backgroundColor: passengerColors.secondarySoft,
    padding: passengerSpacing.sm,
    marginTop: passengerSpacing.sm,
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
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: passengerSpacing.xl,
    marginBottom: passengerSpacing.sm,
  },
  listTitle: {
    color: passengerColors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  countText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  resultCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    marginBottom: passengerSpacing.sm,
    paddingHorizontal: passengerSpacing.sm,
  },
  resultMain: {
    flex: 1,
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primarySoft,
  },
  stopResultIcon: {
    backgroundColor: passengerColors.secondarySoft,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: passengerSpacing.sm,
  },
  resultTitle: {
    color: passengerColors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  resultSubtitle: {
    color: passengerColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  resultMeta: {
    color: passengerColors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  saveButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    minHeight: 230,
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
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: passengerColors.border,
    padding: passengerSpacing.lg,
  },
  emptyTitle: {
    color: passengerColors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: passengerSpacing.sm,
  },
  emptyText: {
    color: passengerColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: passengerSpacing.xxs,
  },
});

export default RouteExplorerScreen;
