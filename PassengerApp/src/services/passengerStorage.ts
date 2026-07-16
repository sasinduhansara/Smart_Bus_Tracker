import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  PassengerSearchResult,
  RecentSearch,
  RecentTrip,
  SavedStop,
} from '../types';

const SAVED_STOPS_KEY = '@GamanaLK:saved_stops:v1';
const RECENT_TRIPS_KEY = '@GamanaLK:recent_trips:v1';
const RECENT_SEARCHES_KEY = '@GamanaLK:recent_searches:v1';
const MAX_RECENT_TRIPS = 8;
const MAX_RECENT_SEARCHES = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function loadArray(key: string): Promise<unknown[]> {
  const storedValue = await AsyncStorage.getItem(key);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function isSavedStop(value: unknown): value is SavedStop {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.routeNumber === 'string' &&
    typeof value.stopId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.savedAt === 'string'
  );
}

function isRecentTrip(value: unknown): value is RecentTrip {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.routeNumber === 'string' &&
    typeof value.destinationName === 'string' &&
    typeof value.viewedAt === 'string' &&
    (value.destinationStopId === undefined ||
      typeof value.destinationStopId === 'string') &&
    (value.originName === undefined || typeof value.originName === 'string')
  );
}

function isRecentSearch(value: unknown): value is RecentSearch {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.type === 'route' || value.type === 'stop') &&
    typeof value.title === 'string' &&
    typeof value.subtitle === 'string' &&
    typeof value.routeNumber === 'string' &&
    typeof value.searchedAt === 'string' &&
    (value.stopId === undefined || typeof value.stopId === 'string')
  );
}

export async function loadSavedStops(): Promise<SavedStop[]> {
  return (await loadArray(SAVED_STOPS_KEY)).filter(isSavedStop);
}

export async function saveStop(stop: SavedStop): Promise<SavedStop[]> {
  const currentStops = await loadSavedStops();
  const nextStops = [stop, ...currentStops.filter(item => item.id !== stop.id)];
  await AsyncStorage.setItem(SAVED_STOPS_KEY, JSON.stringify(nextStops));
  return nextStops;
}

export async function removeSavedStop(id: string): Promise<SavedStop[]> {
  const nextStops = (await loadSavedStops()).filter(stop => stop.id !== id);
  await AsyncStorage.setItem(SAVED_STOPS_KEY, JSON.stringify(nextStops));
  return nextStops;
}

export async function toggleSavedStop(stop: SavedStop): Promise<SavedStop[]> {
  const currentStops = await loadSavedStops();

  if (currentStops.some(item => item.id === stop.id)) {
    return removeSavedStop(stop.id);
  }

  return saveStop(stop);
}

export async function loadRecentTrips(): Promise<RecentTrip[]> {
  return (await loadArray(RECENT_TRIPS_KEY)).filter(isRecentTrip);
}

export async function recordRecentTrip(
  trip: Omit<RecentTrip, 'id' | 'viewedAt'>,
): Promise<RecentTrip[]> {
  const timestamp = new Date().toISOString();
  const tripKey = trip.destinationStopId || trip.destinationName;
  const nextTrip: RecentTrip = {
    ...trip,
    id: trip.routeNumber + ':' + tripKey,
    viewedAt: timestamp,
  };
  const currentTrips = await loadRecentTrips();
  const nextTrips = [
    nextTrip,
    ...currentTrips.filter(item => item.id !== nextTrip.id),
  ].slice(0, MAX_RECENT_TRIPS);

  await AsyncStorage.setItem(RECENT_TRIPS_KEY, JSON.stringify(nextTrips));
  return nextTrips;
}

export async function loadRecentSearches(): Promise<RecentSearch[]> {
  return (await loadArray(RECENT_SEARCHES_KEY)).filter(isRecentSearch);
}

export async function recordRecentSearch(
  result: PassengerSearchResult,
): Promise<RecentSearch[]> {
  const nextSearch: RecentSearch = {
    ...result,
    searchedAt: new Date().toISOString(),
  };
  const currentSearches = await loadRecentSearches();
  const nextSearches = [
    nextSearch,
    ...currentSearches.filter(item => item.id !== nextSearch.id),
  ].slice(0, MAX_RECENT_SEARCHES);

  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextSearches));
  return nextSearches;
}
