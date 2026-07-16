import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadRecentSearches,
  loadRecentTrips,
  loadSavedStops,
  recordRecentSearch,
  recordRecentTrip,
  saveStop,
  toggleSavedStop,
} from '../src/services/passengerStorage';
import type {
  PassengerSearchResult,
  RecentSearch,
  RecentTrip,
  SavedStop,
} from '../src/types';

const SAVED_STOPS_KEY = '@GamanaLK:saved_stops:v1';
const RECENT_TRIPS_KEY = '@GamanaLK:recent_trips:v1';
const RECENT_SEARCHES_KEY = '@GamanaLK:recent_searches:v1';

const savedStop: SavedStop = {
  id: '138:maharagama',
  routeNumber: '138',
  stopId: 'maharagama',
  name: 'Maharagama Stop',
  savedAt: '2026-07-16T10:00:00.000Z',
};

describe('passenger storage', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty arrays for missing, malformed, and non-array storage', async () => {
    expect(await loadSavedStops()).toEqual([]);

    await AsyncStorage.setItem(SAVED_STOPS_KEY, '{not valid json');
    await AsyncStorage.setItem(
      RECENT_TRIPS_KEY,
      JSON.stringify({ id: 'trip' }),
    );
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, 'null');

    expect(await loadSavedStops()).toEqual([]);
    expect(await loadRecentTrips()).toEqual([]);
    expect(await loadRecentSearches()).toEqual([]);
  });

  it('filters invalid records and preserves valid persisted records', async () => {
    const validTrip: RecentTrip = {
      id: '138:pettah',
      routeNumber: '138',
      destinationName: 'Pettah',
      destinationStopId: 'pettah',
      originName: 'Maharagama',
      viewedAt: '2026-07-16T10:05:00.000Z',
    };
    const validSearch: RecentSearch = {
      id: 'stop:138:maharagama',
      type: 'stop',
      title: 'Maharagama Stop',
      subtitle: 'Route 138 · Kottawa - Pettah',
      routeNumber: '138',
      stopId: 'maharagama',
      searchedAt: '2026-07-16T10:10:00.000Z',
    };

    await AsyncStorage.setItem(
      SAVED_STOPS_KEY,
      JSON.stringify([savedStop, { ...savedStop, stopId: 42 }, null]),
    );
    await AsyncStorage.setItem(
      RECENT_TRIPS_KEY,
      JSON.stringify([validTrip, { ...validTrip, originName: false }, []]),
    );
    await AsyncStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify([
        validSearch,
        { ...validSearch, type: 'place' },
        { ...validSearch, stopId: 42 },
      ]),
    );

    expect(await loadSavedStops()).toEqual([savedStop]);
    expect(await loadRecentTrips()).toEqual([validTrip]);
    expect(await loadRecentSearches()).toEqual([validSearch]);
  });

  it('persists a saved stop once and replaces a duplicate with the newest value', async () => {
    const otherStop: SavedStop = {
      id: '122:homagama',
      routeNumber: '122',
      stopId: 'homagama',
      name: 'Homagama Town',
      savedAt: '2026-07-16T10:01:00.000Z',
    };
    const updatedStop: SavedStop = {
      ...savedStop,
      name: 'Maharagama',
      savedAt: '2026-07-16T10:02:00.000Z',
    };

    await saveStop(savedStop);
    await saveStop(otherStop);
    const result = await saveStop(updatedStop);

    expect(result).toEqual([updatedStop, otherStop]);
    expect(result.filter(stop => stop.id === savedStop.id)).toHaveLength(1);
    expect(JSON.parse((await AsyncStorage.getItem(SAVED_STOPS_KEY))!)).toEqual(
      result,
    );
  });

  it('toggles a stop into and back out of persisted storage', async () => {
    expect(await toggleSavedStop(savedStop)).toEqual([savedStop]);
    expect(await loadSavedStops()).toEqual([savedStop]);

    expect(await toggleSavedStop(savedStop)).toEqual([]);
    expect(await loadSavedStops()).toEqual([]);
  });

  it('deduplicates recent trips, moves the latest to the front, and caps at eight', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));

    for (let index = 0; index < 9; index += 1) {
      await recordRecentTrip({
        routeNumber: String(index),
        destinationName: 'Destination ' + index,
        destinationStopId: 'stop-' + index,
      });
    }

    jest.setSystemTime(new Date('2026-07-16T12:05:00.000Z'));
    const result = await recordRecentTrip({
      routeNumber: '4',
      destinationName: 'Updated Destination',
      destinationStopId: 'stop-4',
      originName: 'Fort',
    });

    expect(result).toHaveLength(8);
    expect(result[0]).toMatchObject({
      id: '4:stop-4',
      destinationName: 'Updated Destination',
      originName: 'Fort',
      viewedAt: '2026-07-16T12:05:00.000Z',
    });
    expect(result.filter(trip => trip.id === '4:stop-4')).toHaveLength(1);
    expect(await loadRecentTrips()).toEqual(result);
  });

  it('deduplicates recent searches, moves the latest to the front, and caps at six', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T13:00:00.000Z'));

    const searches: PassengerSearchResult[] = Array.from(
      { length: 7 },
      (_, index) => ({
        id: 'route:' + index,
        type: 'route',
        title: 'Route ' + index,
        subtitle: 'Route name ' + index,
        routeNumber: String(index),
      }),
    );

    for (const search of searches) {
      await recordRecentSearch(search);
    }

    jest.setSystemTime(new Date('2026-07-16T13:05:00.000Z'));
    const result = await recordRecentSearch({
      ...searches[3],
      subtitle: 'Updated route name',
    });

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({
      ...searches[3],
      subtitle: 'Updated route name',
      searchedAt: '2026-07-16T13:05:00.000Z',
    });
    expect(result.filter(search => search.id === searches[3].id)).toHaveLength(
      1,
    );
    expect(await loadRecentSearches()).toEqual(result);
  });
});
