/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import Geolocation from 'react-native-geolocation-service';
import { RefreshControl } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';
import {
  HomeErrorBanner,
  NearbyEmptyState,
} from '../src/components/home/HomeStateViews';
import PassengerHomeScreen from '../src/screens/PassengerHomeScreen';
import LiveMapScreen from '../src/screens/LiveMapScreen';
import OnboardingScreen from '../src/screens/OnboardingScreen';
import {
  getBuses,
  getRouteDetails,
  getRoutes,
  getRouteStops,
  predictEta,
} from '../src/services/api';
import { ONBOARDING_COMPLETE_KEY } from '../src/services/onboardingStorage';
import { passengerSocket } from '../src/services/socket';

jest.mock('../src/services/api', () => ({
  ...jest.requireActual('../src/services/api'),
  getBuses: jest.fn(),
  getRouteDetails: jest.fn(),
  getRoutes: jest.fn(),
  getRouteStops: jest.fn(),
  predictEta: jest.fn(),
}));

jest.mock('../src/services/socket', () => ({
  passengerSocket: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    onBusLocationUpdate: jest.fn(),
    onStatusChange: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };

  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    SafeAreaView: ({
      children,
      ...props
    }: { children?: React.ReactNode } & Record<string, unknown>) =>
      ReactModule.createElement(View, props, children),
    useSafeAreaInsets: () => insets,
  };
});

type TestRenderer = ReturnType<typeof ReactTestRenderer.create>;

const mockedGetBuses = jest.mocked(getBuses);
const mockedGetRouteDetails = jest.mocked(getRouteDetails);
const mockedGetRoutes = jest.mocked(getRoutes);
const mockedGetRouteStops = jest.mocked(getRouteStops);
const mockedPredictEta = jest.mocked(predictEta);
const mockedGetCurrentPosition = jest.mocked(Geolocation.getCurrentPosition);
const mockedPassengerSocket = jest.mocked(passengerSocket);

let renderer: TestRenderer | null = null;
let removeBusListener: jest.Mock;
let removeStatusListener: jest.Mock;
let requestAnimationFrameSpy: jest.SpyInstance;

async function renderApp(): Promise<TestRenderer> {
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
  });

  if (!renderer) {
    throw new Error('App renderer was not created.');
  }

  return renderer;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();

  removeBusListener = jest.fn();
  removeStatusListener = jest.fn();
  requestAnimationFrameSpy = jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation(() => 0);

  mockedGetBuses.mockResolvedValue([]);
  mockedGetRoutes.mockResolvedValue({ status: 'success', routes: [] });
  mockedGetRouteDetails.mockResolvedValue({
    status: 'success',
    route: {
      routeNumber: '138',
      name: 'Kottawa - Pettah',
      direction: 'inbound',
      polyline: [],
      stops: [],
    },
  });
  mockedGetRouteStops.mockResolvedValue({
    status: 'success',
    routeNumber: '138',
    stops: [],
  });
  mockedPredictEta.mockResolvedValue({
    status: 'success',
    busId: 'bus-138',
    routeNumber: '138',
    destinationStop: { id: 'pettah', name: 'Pettah' },
    nextStop: null,
    etaMinutes: 8,
    estimatedArrivalAt: '2026-07-16T17:38:00.000Z',
    remainingDistanceKm: 3.2,
    modelVersion: 'test',
  });

  mockedPassengerSocket.onBusLocationUpdate.mockReturnValue(removeBusListener);
  mockedPassengerSocket.onStatusChange.mockImplementation(listener => {
    listener('connected');
    return removeStatusListener;
  });
  mockedGetCurrentPosition.mockImplementation(success => {
    success({
      coords: {
        latitude: 6.9271,
        longitude: 79.8612,
        accuracy: 5,
        altitude: null,
        heading: null,
        speed: null,
      },
      timestamp: 1_752_688_680_000,
    });
  });
});

afterEach(async () => {
  const activeRenderer = renderer;
  renderer = null;

  if (activeRenderer) {
    await ReactTestRenderer.act(async () => {
      activeRenderer.unmount();
    });
  }

  requestAnimationFrameSpy.mockRestore();
  await AsyncStorage.clear();
});

describe('App', () => {
  test('renders onboarding when completion is not stored', async () => {
    const app = await renderApp();

    expect(app.root.findAllByType(OnboardingScreen)).toHaveLength(1);
    expect(
      app.root.findAllByProps({ accessibilityLabel: 'Skip onboarding' }),
    ).not.toHaveLength(0);
    expect(mockedGetBuses).not.toHaveBeenCalled();
    expect(mockedPassengerSocket.connect).not.toHaveBeenCalled();
  });

  test('renders the passenger home after onboarding is complete', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');

    const app = await renderApp();

    expect(app.root.findAllByType(PassengerHomeScreen)).toHaveLength(1);
    expect(app.root.findAllByType(OnboardingScreen)).toHaveLength(0);
    expect(mockedGetBuses).toHaveBeenCalledTimes(1);
    expect(mockedGetRoutes).toHaveBeenCalledTimes(1);
    expect(mockedGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(mockedPassengerSocket.connect).toHaveBeenCalledTimes(1);
    expect(app.root.findAllByType(NearbyEmptyState)).toHaveLength(1);

    const refreshControl = app.root.findByType(RefreshControl);
    await ReactTestRenderer.act(async () => {
      await refreshControl.props.onRefresh?.();
    });

    expect(mockedGetBuses).toHaveBeenCalledTimes(2);
    expect(mockedGetRoutes).toHaveBeenCalledTimes(2);
  });

  test('keeps home useful when location permission is denied', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    mockedGetCurrentPosition.mockImplementation((_success, failure) => {
      failure?.({
        code: 1,
        message: 'Permission denied',
      });
    });

    const app = await renderApp();
    const deniedMessages = app.root.findAll(
      instance => instance.props.children === 'Location permission was denied',
    );

    expect(app.root.findAllByType(PassengerHomeScreen)).toHaveLength(1);
    expect(deniedMessages).not.toHaveLength(0);
    expect(app.root.findAllByType(NearbyEmptyState)).toHaveLength(1);
  });

  test('shows retryable feedback when live bus loading fails', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    mockedGetBuses.mockRejectedValue(new Error('Network unavailable'));

    const app = await renderApp();

    expect(app.root.findAllByType(PassengerHomeScreen)).toHaveLength(1);
    expect(app.root.findAllByType(HomeErrorBanner)).toHaveLength(1);
  });

  test('renders a valid Socket.IO bus update on home', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    const app = await renderApp();
    const listener =
      mockedPassengerSocket.onBusLocationUpdate.mock.calls[0]?.[0];

    await ReactTestRenderer.act(async () => {
      listener?.({
        bus_id: 'bus-live',
        routeNumber: '177',
        lat: 6.9271,
        lng: 79.8612,
        updatedAt: new Date().toISOString(),
      });
      await Promise.resolve();
    });

    expect(app.root.findAllByType(NearbyEmptyState)).toHaveLength(0);
    expect(
      app.root.findAll(instance => instance.props.children === '177'),
    ).not.toHaveLength(0);
  });

  test('merges a status-only pause event into the last bus location', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    const locationUpdatedAt = new Date().toISOString();
    mockedGetBuses.mockResolvedValue([
      {
        bus_id: 'bus-paused',
        routeNumber: '138',
        lat: 6.9271,
        lng: 79.8612,
        updatedAt: locationUpdatedAt,
        operationalStatus: 'active',
        isActive: true,
      },
    ]);

    const app = await renderApp();
    const listener =
      mockedPassengerSocket.onBusLocationUpdate.mock.calls[0]?.[0];

    await ReactTestRenderer.act(async () => {
      listener?.({
        bus_id: 'bus-paused',
        operationalStatus: 'paused',
        isActive: false,
        statusUpdatedAt: new Date(Date.now() + 1000).toISOString(),
      });
      await Promise.resolve();
    });

    expect(
      app.root.findAll(instance => instance.props.children === 'Trip paused'),
    ).not.toHaveLength(0);
  });

  test('requests and announces a model-backed ETA for a live bus', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    mockedGetBuses.mockResolvedValue([
      {
        bus_id: 'bus-138',
        routeNumber: '138',
        lat: 6.9271,
        lng: 79.8612,
        updatedAt: new Date().toISOString(),
      },
    ]);
    mockedGetRoutes.mockResolvedValue({
      status: 'success',
      routes: [
        {
          routeNumber: '138',
          name: 'Kottawa - Pettah',
          direction: 'inbound',
          stopCount: 2,
        },
      ],
    });
    mockedGetRouteDetails.mockResolvedValue({
      status: 'success',
      route: {
        routeNumber: '138',
        name: 'Kottawa - Pettah',
        direction: 'inbound',
        polyline: [
          { latitude: 6.9271, longitude: 79.8612 },
          { latitude: 6.93, longitude: 79.87 },
        ],
        stops: [
          {
            id: 'fort',
            name: 'Fort',
            sequence: 1,
            latitude: 6.9271,
            longitude: 79.8612,
          },
          {
            id: 'pettah',
            name: 'Pettah',
            sequence: 2,
            latitude: 6.93,
            longitude: 79.87,
          },
        ],
      },
    });

    const app = await renderApp();
    await ReactTestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedPredictEta).toHaveBeenCalledWith({
      busId: 'bus-138',
      routeNumber: '138',
      destinationStopId: 'pettah',
    });
    expect(
      app.root.findAll(instance => instance.props.children === '8 min'),
    ).not.toHaveLength(0);
  });

  test('opens the existing live map from the Map tab and unmounts cleanly', async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');

    const app = await renderApp();
    const mapTab = app.root
      .findAllByProps({ testID: 'passenger-bottom-navigation-map' })
      .find(instance => typeof instance.props.onPress === 'function');

    expect(mapTab).toBeDefined();

    await ReactTestRenderer.act(async () => {
      mapTab?.props.onPress();
      await Promise.resolve();
    });

    expect(app.root.findAllByType(PassengerHomeScreen)).toHaveLength(0);
    expect(app.root.findAllByType(LiveMapScreen)).toHaveLength(1);
    expect(mockedGetBuses).toHaveBeenCalledTimes(2);
    expect(mockedGetRoutes).toHaveBeenCalledTimes(2);

    await ReactTestRenderer.act(async () => {
      app.unmount();
    });
    renderer = null;

    expect(removeBusListener).toHaveBeenCalledTimes(2);
    expect(removeStatusListener).toHaveBeenCalledTimes(2);
    expect(mockedPassengerSocket.disconnect).toHaveBeenCalledTimes(2);
  });
});
