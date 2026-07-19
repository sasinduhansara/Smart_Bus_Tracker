import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomNav from '../components/BottomNav';
import {
  ConnectionStatusBanner,
  DashboardStats,
  DriverHeader,
  ErrorState,
  IssueReportModal,
  LoadingState,
  QuickActions,
  RecentTrips,
  RouteProgressCard,
  TripControlCard,
  VehicleAssignmentCard,
  type QuickActionItem,
  type RouteStopPreview,
  type TripLifecycleStatus,
} from '../components/driver';
import { useDriverDashboard } from '../hooks/useDriverDashboard';
import {
  type DriverLocationSnapshot,
  toTripLocation,
  useDriverLocationTracking,
} from '../hooks/useDriverLocationTracking';
import { useDriverTabs } from '../navigation/useDriverTabs';
import {
  ApiError,
  checkTripReadiness,
  getAssignedRoute,
  getDriverStatus,
  reportDriverIssue,
} from '../services/api';
import { clearTripLocationQueue } from '../services/secureLocationQueue';
import { useAuthStore } from '../store/useAuthStore';
import { useTripStore } from '../store/useTripStore';
import type {
  IssueCategory,
  IssueSeverity,
  TripReadinessResponse,
  VerificationStatus,
} from '../types';
import type { RootStackParamList } from '../types/navigation';
import {
  executeTripStart,
  formatDistanceMeters,
  presentGpsPreflightError,
  presentTripStartError,
  type TripStartErrorPresentation,
  type TripStartPreflightStatus,
} from '../utils/tripStart';
import {
  driverColors,
  driverRadii,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../theme/tokens';

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

function formatTime(value?: string | Date | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function firstName(fullName?: string): string {
  return fullName?.trim().split(/\s+/)[0] || 'Driver';
}

export default function DriverHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const onTabPress = useDriverTabs();
  const session = useAuthStore(state => state.session);
  const logout = useAuthStore(state => state.logout);
  const updateVerificationStatus = useAuthStore(
    state => state.updateVerificationStatus,
  );
  const driverId = session?.driver.driver_id;
  const dashboard = useDriverDashboard(driverId);

  const trip = useTripStore(state => state.trip);
  const tripPhase = useTripStore(state => state.phase);
  const tripError = useTripStore(state => state.error);
  const restoredFromCache = useTripStore(state => state.restoredFromCache);
  const restoreTrip = useTripStore(state => state.restore);
  const startTrip = useTripStore(state => state.start);
  const pauseTrip = useTripStore(state => state.pause);
  const resumeTrip = useTripStore(state => state.resume);
  const completeTrip = useTripStore(state => state.complete);

  const [issueVisible, setIssueVisible] = useState(false);
  const [issueCategory, setIssueCategory] = useState<IssueCategory>();
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [tripStartStatus, setTripStartStatus] =
    useState<TripStartPreflightStatus>('idle');
  const [tripStartError, setTripStartError] =
    useState<TripStartErrorPresentation | null>(null);
  const [readinessLocation, setReadinessLocation] =
    useState<DriverLocationSnapshot | null>(null);
  const [readiness, setReadiness] =
    useState<TripReadinessResponse | null>(null);
  const [readinessChecking, setReadinessChecking] = useState(false);
  const [routeDeviationWarning, setRouteDeviationWarning] = useState(false);
  const restoreAttemptedRef = useRef(false);
  const approvalSyncInFlightRef = useRef(false);
  const readinessRequestInFlightRef = useRef(false);
  const pendingReadinessLocationRef =
    useRef<DriverLocationSnapshot | null>(null);
  const restoredTrackingTripIdRef = useRef<string | null>(null);

  const handleReadinessLocation = useCallback(
    (snapshot: DriverLocationSnapshot) => {
      setReadinessLocation(snapshot);
    },
    [],
  );

  const handleLocationSent = useCallback(
    (
      response: Awaited<ReturnType<typeof import('../services/api').sendDriverLocation>>,
      snapshot: Parameters<typeof toTripLocation>[0],
    ) => {
      if (trip?.status !== 'active') {
        return;
      }

      setRouteDeviationWarning(Boolean(response.bus.isRouteDeviation));

      dashboard
        .refreshEta(response.bus.bus_id || trip.busId, snapshot)
        .catch(() => undefined);
    },
    [dashboard, trip?.busId, trip?.status],
  );

  const handleTrackingRejected = useCallback(
    (error: ApiError) => {
      dashboard.clearEta('Live tracking stopped after a backend state change.');

      if (error.status !== 401) {
        Alert.alert('Live tracking stopped', error.message);
        if (driverId) {
          restoreTrip(driverId)
            .then(() => dashboard.load(true))
            .catch(() => undefined);
        }
      }
    },
    [dashboard, driverId, restoreTrip],
  );

  const gps = useDriverLocationTracking({
    onLocationSent: handleLocationSent,
    onTrackingRejected: handleTrackingRejected,
    onReadinessLocation: handleReadinessLocation,
  });
  const startGpsReadiness = gps.startReadiness;
  const stopGpsReadiness = gps.stopReadiness;
  const getGpsPreflightFailure = gps.getPreflightFailure;

  useEffect(() => {
    if (restoreAttemptedRef.current) {
      return;
    }

    if (!driverId) {
      return;
    }

    restoreAttemptedRef.current = true;
    restoreTrip(driverId).catch(() => undefined);
  }, [driverId, restoreTrip]);

  useEffect(() => {
    if (
      !dashboard.accessDenied ||
      !driverId ||
      approvalSyncInFlightRef.current
    ) {
      return;
    }

    approvalSyncInFlightRef.current = true;
    getDriverStatus(driverId)
      .then(response => {
        const status = String(
          response.verificationStatus || response.status || 'pending',
        )
          .trim()
          .toLowerCase() as VerificationStatus;
        const supportedStatuses = new Set<VerificationStatus>([
          'pending',
          'approved',
          'verified',
          'blocked',
          'rejected',
          'unverified',
          'under_review',
        ]);

        return updateVerificationStatus(
          supportedStatuses.has(status) ? status : 'pending',
        );
      })
      .catch(() => undefined)
      .finally(() => {
        approvalSyncInFlightRef.current = false;
      });
  }, [dashboard.accessDenied, driverId, updateVerificationStatus]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const driver = dashboard.home?.driver || session?.driver;
  const vehicle = dashboard.home?.vehicle;
  const route = dashboard.route;
  const driverVerificationStatus = String(
    driver?.verificationStatus || '',
  ).trim().toLowerCase();
  const driverApproved =
    driverVerificationStatus === 'approved' ||
    driverVerificationStatus === 'verified';
  const routeStops = useMemo(() => route?.stops || [], [route?.stops]);
  const destination = routeStops[routeStops.length - 1];
  const origin = routeStops[0];

  useEffect(() => {
    if (!readinessLocation || gps.mode !== 'readiness' || trip) {
      return;
    }

    pendingReadinessLocationRef.current = readinessLocation;
    if (readinessRequestInFlightRef.current) {
      return;
    }

    const processReadiness = async () => {
      readinessRequestInFlightRef.current = true;

      try {
        while (pendingReadinessLocationRef.current) {
          const snapshot = pendingReadinessLocationRef.current;
          pendingReadinessLocationRef.current = null;
          setReadinessChecking(true);
          setTripStartStatus('checking_terminal');

          try {
            const response = await checkTripReadiness(
              toTripLocation(snapshot),
            );
            setReadiness(response);

            if (response.canStart) {
              setTripStartStatus('idle');
              setTripStartError(null);
            } else {
              setTripStartStatus('outside_geofence');
              setTripStartError({
                status: 'outside_geofence',
                title: 'Trip cannot start here',
                message: [
                  `Nearest terminal: ${response.nearestTerminal.name}.`,
                  `Distance remaining: ${formatDistanceMeters(
                    response.nearestTerminal.remainingDistanceMeters,
                  )}.`,
                  `Trip start area: within ${formatDistanceMeters(
                    response.nearestTerminal.allowedRadiusMeters,
                  )} of the terminal.`,
                ].join(' '),
                canOpenSettings: false,
              });
            }
          } catch (readinessError) {
            setReadiness(null);
            const presentation = presentTripStartError(readinessError);
            setTripStartStatus(presentation.status);
            setTripStartError(presentation);
          }
        }
      } finally {
        readinessRequestInFlightRef.current = false;
        setReadinessChecking(false);
      }
    };

    processReadiness().catch(() => undefined);
  }, [gps.mode, readinessLocation, trip]);

  useFocusEffect(
    useCallback(() => {
      if (
        !trip &&
        tripPhase !== 'restoring' &&
        restoreAttemptedRef.current &&
        driverApproved &&
        Boolean(vehicle?.number && vehicle?.route)
      ) {
        setReadiness(null);
        setReadinessLocation(null);
        setTripStartError(null);
        setTripStartStatus('checking_location');
        startGpsReadiness().then(started => {
          if (started) {
            return;
          }

          const failure = getGpsPreflightFailure();
          const presentation = presentGpsPreflightError(
            failure.permissionStatus,
            failure.error,
          );
          setTripStartStatus(presentation.status);
          setTripStartError(presentation);
        }).catch(() => undefined);
      }

      return () => {
        stopGpsReadiness();
        pendingReadinessLocationRef.current = null;
      };
    }, [
      driverApproved,
      getGpsPreflightFailure,
      startGpsReadiness,
      stopGpsReadiness,
      trip,
      tripPhase,
      vehicle?.number,
      vehicle?.route,
    ]),
  );

  useEffect(() => {
    if (
      !trip ||
      trip.status !== 'active' ||
      tripStartStatus !== 'idle' ||
      gps.mode !== 'idle' ||
      restoredTrackingTripIdRef.current === trip.id
    ) {
      return;
    }

    restoredTrackingTripIdRef.current = trip.id;
    gps.prepareLocation()
      .then(
        snapshot =>
          snapshot && gps.startTracking(snapshot, { tripId: trip.id }),
      )
      .then(started => {
        if (started === false) {
          restoredTrackingTripIdRef.current = null;
        }
      })
      .catch(() => {
        restoredTrackingTripIdRef.current = null;
      });
  }, [gps, trip, tripStartStatus]);
  const nextStopId = dashboard.eta?.nextStop?.id;
  const nextStopIndex = nextStopId
    ? routeStops.findIndex(stop => stop.id === nextStopId)
    : -1;
  const nextStop =
    nextStopIndex >= 0 ? routeStops[nextStopIndex] : undefined;
  const etaIsStale = dashboard.etaUpdatedAt
    ? clock - dashboard.etaUpdatedAt.getTime() > 60000
    : false;

  const elapsedSeconds = useMemo(() => {
    if (!trip) {
      return 0;
    }

    if (trip.status === 'paused') {
      return trip.activeDurationSeconds || 0;
    }

    const startedAt = new Date(trip.startedAt).getTime();

    if (!Number.isFinite(startedAt)) {
      return trip.activeDurationSeconds || 0;
    }

    return Math.max(
      Math.floor((clock - startedAt) / 1000) -
        (trip.pausedDurationSeconds || 0),
      trip.activeDurationSeconds || 0,
    );
  }, [clock, trip]);

  const gpsFeedLive =
    gps.isTracking && gps.transmissionStatus === 'online';

  const tripControlStatus: TripLifecycleStatus = useMemo(() => {
    if (!trip && readinessChecking) {
      return 'checking_terminal';
    }

    if (!trip && tripStartStatus !== 'idle' && tripPhase !== 'starting') {
      return tripStartStatus;
    }

    switch (tripPhase) {
      case 'starting':
      case 'pausing':
      case 'resuming':
      case 'ending':
        return tripPhase;
      case 'active':
        return gps.isStarting
          ? 'starting'
          : gpsFeedLive
          ? 'active'
          : 'interrupted';
      case 'paused':
        return 'paused';
      case 'failed':
        return trip ? (trip.status === 'active' ? 'interrupted' : 'paused') : 'error';
      default:
        return 'idle';
    }
  }, [
    gps.isStarting,
    gpsFeedLive,
    readinessChecking,
    trip,
    tripPhase,
    tripStartStatus,
  ]);

  const ensureDashboardReady = useCallback(async () => {
    // Approval and assignments can change from the admin console while this
    // screen is open. Always refresh before starting so a cached pending
    // response cannot incorrectly block an already-approved driver.
    return dashboard.load(true);
  }, [dashboard]);

  const handleStartTrip = useCallback(async () => {
    if (
      trip ||
      tripPhase === 'starting' ||
      tripStartStatus === 'checking_location' ||
      tripStartStatus === 'checking_terminal'
    ) {
      Alert.alert('Trip already open', 'Resume or end the unfinished trip first.');
      return;
    }

    if (!readiness?.canStart) {
      Alert.alert(
        'Trip cannot start here',
        tripStartError?.message ||
          'Wait for automatic terminal validation before starting.',
      );
      return;
    }

    setTripStartError(null);
    setTripStartStatus('checking_terminal');

    const currentHome = await ensureDashboardReady();

    if (!currentHome) {
      setTripStartStatus('backend_unavailable');
      setTripStartError({
        status: 'backend_unavailable',
        title: 'Backend unavailable',
        message: 'Reconnect to the backend before starting.',
        canOpenSettings: false,
      });
      Alert.alert('Backend unavailable', 'Reconnect to the backend before starting.');
      return;
    }

    const verificationStatus = String(
      currentHome?.driver.verificationStatus || '',
    )
      .trim()
      .toLowerCase();
    const approved =
      verificationStatus === 'approved' || verificationStatus === 'verified';

    if (!approved) {
      setTripStartStatus('error');
      setTripStartError({
        status: 'error',
        title: 'Approval required',
        message: 'Only an approved driver can start a trip.',
        canOpenSettings: false,
      });
      Alert.alert('Approval required', 'Only an approved driver can start a trip.');
      return;
    }

    if (!currentHome?.vehicle.number) {
      setTripStartStatus('error');
      setTripStartError({
        status: 'error',
        title: 'No bus assigned',
        message: 'Ask operations to assign a vehicle first.',
        canOpenSettings: false,
      });
      Alert.alert('No bus assigned', 'Ask operations to assign a vehicle first.');
      return;
    }

    if (!currentHome.vehicle.route) {
      const presentation = presentTripStartError(
        new ApiError('The assigned route does not exist.', 409, 'ROUTE_NOT_FOUND'),
      );
      setTripStartStatus(presentation.status);
      setTripStartError(presentation);
      Alert.alert(
        'Route unavailable',
        'The assigned route must exist in the backend before this trip can start.',
      );
      return;
    }

    let confirmedRoute = route;

    if (!confirmedRoute) {
      try {
        confirmedRoute = (
          await getAssignedRoute(currentHome.vehicle.route)
        ).route;
      } catch {
        const presentation = presentTripStartError(
          new ApiError('The assigned route does not exist.', 409, 'ROUTE_NOT_FOUND'),
        );
        setTripStartStatus(presentation.status);
        setTripStartError(presentation);
        Alert.alert(
          'Route unavailable',
          'The assigned route must exist in the backend before this trip can start.',
        );
        return;
      }
    }

    if (!confirmedRoute.terminals || confirmedRoute.terminals.length < 2) {
      const presentation = presentTripStartError(
        new ApiError(
          'The assigned route does not have trip-start terminals configured.',
          409,
          'ROUTE_TERMINALS_NOT_CONFIGURED',
        ),
      );
      setTripStartStatus(presentation.status);
      setTripStartError(presentation);
      Alert.alert(presentation.title, presentation.message);
      return;
    }

    try {
      const result = await executeTripStart({
        prepareLocation: gps.prepareLocation,
        mapLocation: toTripLocation,
        startTrip,
        startTracking: gps.startTracking,
        getTripId: startedTrip => startedTrip.id,
        onStage: setTripStartStatus,
      });

      if (result.status === 'location_unavailable') {
        const failure = gps.getPreflightFailure();
        const presentation = presentGpsPreflightError(
          failure.permissionStatus,
          failure.error,
        );
        setTripStartStatus(presentation.status);
        setTripStartError(presentation);
        Alert.alert(presentation.title, presentation.message);
        return;
      }

      const {
        trip: startedTrip,
        snapshot,
        watcherStarted,
      } = result;

      if (!watcherStarted) {
        await pauseTrip();
        dashboard.clearEta('Trip paused because live GPS could not start.');
        Alert.alert(
          'Trip safely paused',
          'The trip record was created, but GPS tracking failed. Fix GPS and resume.',
        );
        return;
      }

      setTripStartStatus('idle');
      setTripStartError(null);
      setReadiness(null);
      setReadinessLocation(null);
      dashboard.refreshEta(startedTrip.busId, snapshot, true).catch(() => undefined);
      dashboard.load(true).catch(() => undefined);
      Alert.alert('Trip started', 'Live location is now shared with passengers.');
    } catch (error) {
      const presentation = presentTripStartError(error);
      setTripStartStatus(presentation.status);
      setTripStartError(presentation);
      Alert.alert(presentation.title, presentation.message);
    }
  }, [
    dashboard,
    ensureDashboardReady,
    gps,
    pauseTrip,
    route,
    readiness?.canStart,
    startTrip,
    trip,
    tripStartError?.message,
    tripPhase,
    tripStartStatus,
  ]);

  const handleRetryLocation = useCallback(() => {
    setReadiness(null);
    setReadinessLocation(null);
    setTripStartError(null);
    setTripStartStatus('checking_location');
    gps.stopReadiness();
    gps.startReadiness().catch(() => undefined);
  }, [gps]);

  const handleOpenLocationSettings = useCallback(() => {
    Linking.openSettings().catch(() => {
      Alert.alert(
        'Settings unavailable',
        'Open device settings manually and enable precise location for Gamana.lk Driver.',
      );
    });
  }, []);

  const handlePauseTrip = useCallback(async () => {
    try {
      await gps.flushLatestLocation();
      await pauseTrip();
      gps.stopTracking();
      dashboard.clearEta('ETA paused until live tracking resumes.');
      dashboard.load(true).catch(() => undefined);
    } catch (error) {
      Alert.alert(
        'Could not pause trip',
        error instanceof Error ? error.message : 'Please retry.',
      );
    }
  }, [dashboard, gps, pauseTrip]);

  const handleResumeTrip = useCallback(async () => {
    if (!trip) {
      return;
    }

    let currentTrip = trip;

    if (restoredFromCache) {
      if (!driverId) {
        Alert.alert('Session unavailable', 'Sign in again before resuming this trip.');
        return;
      }

      const restoredTrip = await restoreTrip(driverId);
      const restoredState = useTripStore.getState();

      if (restoredState.restoredFromCache) {
        Alert.alert(
          'Backend verification required',
          'Reconnect before resuming GPS for this cached unfinished trip.',
        );
        return;
      }

      if (!restoredTrip) {
        Alert.alert(
          'Trip already closed',
          'The backend no longer has an unfinished trip for this driver.',
        );
        dashboard.clearEta();
        return;
      }

      currentTrip = restoredTrip;
    }

    const snapshot = await gps.prepareLocation();

    if (!snapshot) {
      Alert.alert('GPS not ready', gps.error || 'A reliable GPS fix is required.');
      return;
    }

    try {
      if (currentTrip.status === 'paused') {
        await resumeTrip();
      }

      const watcherStarted = await gps.startTracking(snapshot, {
        tripId: currentTrip.id,
      });

      if (!watcherStarted) {
        let safelyPaused = false;
        if (useTripStore.getState().trip?.status === 'active') {
          try {
            await pauseTrip();
            safelyPaused = true;
          } catch {
            safelyPaused = false;
          }
        }
        Alert.alert(
          safelyPaused ? 'Trip safely paused' : 'Tracking not resumed',
          safelyPaused
            ? 'GPS could not start, so the backend trip was paused. Check GPS and retry.'
            : 'GPS could not start and the trip could not be paused. Keep this screen open and retry or end the trip.',
        );
        return;
      }

      dashboard
        .refreshEta(currentTrip.busId, snapshot, true)
        .catch(() => undefined);
      dashboard.load(true).catch(() => undefined);
    } catch (error) {
      Alert.alert(
        'Could not resume trip',
        error instanceof Error ? error.message : 'Please retry.',
      );
    }
  }, [
    dashboard,
    driverId,
    gps,
    pauseTrip,
    restoreTrip,
    restoredFromCache,
    resumeTrip,
    trip,
  ]);

  const endTrip = useCallback(async () => {
    try {
      if (gps.isTracking) {
        await gps.flushLatestLocation();
      }

      const completed = await completeTrip();
      gps.stopTracking();
      await clearTripLocationQueue(completed.id);
      restoredTrackingTripIdRef.current = null;
      setRouteDeviationWarning(false);
      dashboard.clearEta();
      dashboard.load(true).catch(() => undefined);
      Alert.alert(
        'Trip completed',
        `Recorded active time: ${formatDuration(completed.activeDurationSeconds)}.`,
      );
    } catch (error) {
      Alert.alert(
        'Could not end trip',
        error instanceof Error
          ? error.message
          : 'The trip is still open. Please retry.',
      );
    }
  }, [completeTrip, dashboard, gps]);

  const handleEndTrip = useCallback(() => {
    Alert.alert(
      'End this trip?',
      'Passengers will immediately see this bus as offline. This cannot be undone.',
      [
        { text: 'Keep trip', style: 'cancel' },
        {
          text: 'End trip',
          style: 'destructive',
          onPress: () => endTrip().catch(() => undefined),
        },
      ],
    );
  }, [endTrip]);

  const handleLogout = useCallback(async () => {
    if (trip) {
      Alert.alert(
        'Trip still open',
        'End the active or paused trip before signing out so passengers receive the correct status.',
      );
      return;
    }

    gps.stopTracking();
    await clearTripLocationQueue();
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [gps, logout, navigation, trip]);

  const showDriverMenu = useCallback(() => {
    Alert.alert('Driver menu', 'Choose an account action.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Profile', onPress: () => navigation.navigate('Profile') },
      { text: 'Sign out', style: 'destructive', onPress: () => handleLogout().catch(() => undefined) },
    ]);
  }, [handleLogout, navigation]);

  const openIssue = useCallback((category?: IssueCategory) => {
    setIssueCategory(category);
    setIssueVisible(true);
  }, []);

  const submitIssue = useCallback(
    async (data: {
      category: IssueCategory;
      severity: IssueSeverity;
      message?: string;
    }) => {
      setSubmittingIssue(true);

      try {
        await reportDriverIssue({
          ...data,
          location: gps.lastLocation
            ? toTripLocation(gps.lastLocation)
            : undefined,
        });
        setIssueVisible(false);
        Alert.alert('Report submitted', 'Operations can now review this issue.');
      } catch (error) {
        Alert.alert(
          'Report not submitted',
          error instanceof Error ? error.message : 'Please retry.',
        );
        throw error;
      } finally {
        setSubmittingIssue(false);
      }
    },
    [gps.lastLocation],
  );

  const quickActions = useMemo<QuickActionItem[]>(
    () => [
      {
        key: 'route',
        label: 'Route details',
        icon: 'map-outline',
        onPress: () => navigation.navigate('RouteDetails'),
        disabled: !vehicle?.route,
        tone: 'primary',
      },
      {
        key: 'history',
        label: 'Trip history',
        icon: 'time-outline',
        onPress: () => navigation.navigate('Trips'),
      },
      {
        key: 'issue',
        label: 'Report issue',
        icon: 'warning-outline',
        onPress: () => openIssue(),
        tone: 'attention',
      },
      {
        key: 'emergency',
        label: 'Passenger emergency',
        icon: 'medkit-outline',
        onPress: () => openIssue('passenger_emergency'),
        tone: 'danger',
      },
    ],
    [navigation, openIssue, vehicle?.route],
  );

  const routeStopPreviews = useMemo<RouteStopPreview[]>(() => {
    if (!routeStops.length) {
      return [];
    }

    const previewStartIndex = nextStopIndex > 1 ? nextStopIndex - 1 : 0;

    return routeStops
      .slice(previewStartIndex, previewStartIndex + 5)
      .map((stop, previewIndex) => {
        const routeIndex = previewStartIndex + previewIndex;

        return {
          id: stop.id,
          label: stop.name,
          status:
            nextStopIndex < 0 || routeIndex > nextStopIndex
              ? 'upcoming'
              : routeIndex === nextStopIndex
              ? 'current'
              : 'completed',
          etaLabel:
            stop.id === nextStop?.id && dashboard.eta && !etaIsStale
              ? `${Math.ceil(dashboard.eta.etaMinutes)} min`
              : undefined,
        };
      });
  }, [dashboard.eta, etaIsStale, nextStop?.id, nextStopIndex, routeStops]);

  const headerStatus = trip
    ? trip.status === 'paused'
      ? { label: 'Trip paused', tone: 'attention' as const }
      : gpsFeedLive
      ? { label: 'Live trip', tone: 'ready' as const }
      : gps.transmissionStatus === 'sending' ||
        gps.transmissionStatus === 'retrying'
      ? { label: 'Connecting GPS', tone: 'attention' as const }
      : { label: 'GPS interrupted — action needed', tone: 'danger' as const }
    : readiness?.canStart
    ? { label: 'Ready to start', tone: 'ready' as const }
    : vehicle?.number && vehicle?.route
    ? tripStartStatus === 'outside_geofence'
      ? { label: 'Move closer to terminal', tone: 'attention' as const }
      : { label: 'Checking trip readiness', tone: 'attention' as const }
    : { label: 'Assignment needed', tone: 'attention' as const };

  const connectionStatus =
    trip?.status !== 'active'
      ? dashboard.connectionStatus
      : gps.transmissionStatus === 'online'
      ? 'online'
      : gps.transmissionStatus === 'sending' ||
        gps.transmissionStatus === 'retrying'
      ? 'connecting'
      : gps.transmissionStatus === 'rejected'
      ? 'error'
      : 'offline';
  const connectionMessage =
    restoredFromCache && trip
      ? 'Showing a securely cached trip until the backend reconnects.'
      : trip?.status === 'active' && gps.transmissionStatus === 'online'
      ? 'Live GPS has reached the backend and is available to passengers.'
      : trip?.status === 'active' && gps.transmissionStatus === 'sending'
      ? 'Sending the first live GPS update to the backend.'
      : trip?.status === 'active' && gps.transmissionStatus === 'retrying'
      ? gps.error || 'The GPS upload is retrying; passengers may see stale data.'
      : trip?.status === 'active'
      ? gps.error || 'The trip is active, but this phone is not transmitting location.'
      : dashboard.error ||
        (connectionStatus === 'online'
          ? 'Backend reachable. Trip state is synchronized.'
          : 'Reconnect before changing the trip state.');

  const contentBottomPadding =
    driverSizes.bottomNavHeight + Math.max(insets.bottom, driverSpacing.md) + 40;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={driverColors.navy900} />
      <DriverHeader
        driverName={driver?.fullName}
        notificationCount={dashboard.home?.stats.notifications}
        onMenuPress={showDriverMenu}
        onNotificationsPress={() => navigation.navigate('Notifications')}
        statusLabel={headerStatus.label}
        statusTone={headerStatus.tone}
        subtitle={vehicle?.route ? `Assigned route ${vehicle.route}` : 'Operations dashboard'}
        title={`Welcome, ${firstName(driver?.fullName)}`}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.refreshing}
            tintColor={driverColors.teal700}
            onRefresh={() => dashboard.refresh().catch(() => undefined)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ConnectionStatusBanner
          lastUpdatedLabel={
            gps.lastSentAt
              ? `Last GPS upload ${formatTime(gps.lastSentAt)}`
              : dashboard.home?.tracking.lastUpdatedAt
              ? `Last backend GPS ${formatTime(dashboard.home.tracking.lastUpdatedAt)}`
              : undefined
          }
          message={connectionMessage}
          onRetry={() => dashboard.refresh().catch(() => undefined)}
          retrying={dashboard.refreshing}
          status={connectionStatus}
        />

        {dashboard.loading && !dashboard.home ? (
          <LoadingState
            message="Restoring assignment, route, and active trip state"
            title="Preparing Driver Dashboard"
          />
        ) : dashboard.error && !dashboard.home ? (
          <ErrorState
            actionLabel="Retry dashboard"
            busy={dashboard.refreshing}
            message={dashboard.error}
            onAction={() => dashboard.refresh().catch(() => undefined)}
            title="Backend data unavailable"
          />
        ) : (
          <>
            <VehicleAssignmentCard
              conductorName={driver?.conductorName}
              onPress={vehicle?.route ? () => navigation.navigate('RouteDetails') : undefined}
              operatorLabel={vehicle?.depotOperator || driver?.depotOperator}
              routeLabel={
                route?.name
                  ? `${route.routeNumber} · ${route.name}`
                  : vehicle?.route || 'No route assigned'
              }
              serviceStatus={vehicle?.serviceStatus || 'Assignment unavailable'}
              statusTone={vehicle?.number && vehicle?.route ? 'ready' : 'attention'}
              vehicleNumber={vehicle?.number || driver?.vehicleRegistrationNumber}
            />

            <TripControlCard
              disabled={
                dashboard.connectionStatus !== 'online' ||
                (tripPhase === 'restoring' && !trip)
              }
              distanceLabel={
                dashboard.eta && !etaIsStale
                  ? `${dashboard.eta.remainingDistanceKm.toFixed(1)} km to next stop`
                  : undefined
              }
              elapsedLabel={trip ? formatDuration(elapsedSeconds) : undefined}
              gpsAccuracyLabel={
                gps.lastLocation?.accuracy
                  ? `±${Math.round(gps.lastLocation.accuracy)} m`
                  : gps.permissionStatus === 'blocked'
                  ? 'Blocked'
                  : 'Waiting'
              }
              onEnd={handleEndTrip}
              onPause={handlePauseTrip}
              onRetryLocation={handleRetryLocation}
              onResume={handleResumeTrip}
              onSecondaryAction={
                tripStartError?.canOpenSettings
                  ? handleOpenLocationSettings
                  : undefined
              }
              onStart={readiness?.canStart ? handleStartTrip : undefined}
              secondaryActionLabel={
                tripStartError?.canOpenSettings
                  ? 'Open location settings'
                  : undefined
              }
              status={tripControlStatus}
              statusMessage={
                trip
                  ? `${trip.origin || origin?.name || 'Route start'} → ${
                      trip.destination || destination?.name || 'Route destination'
                    }`
                  : readiness?.canStart && readiness.direction
                  ? `Ready near ${readiness.nearestTerminal.name}. ${readiness.direction.origin} → ${readiness.direction.destination}.`
                  : tripStartStatus === 'checking_location'
                  ? 'Getting a fresh, precise GPS fix from this device…'
                  : tripStartStatus === 'checking_terminal'
                  ? 'Verifying this location against the assigned route terminals…'
                  : tripStartError?.message ||
                    'Preflight checks approval, assignment, route, backend, permission, and GPS.'
              }
              tripLabel={trip ? `Trip ${trip.id.slice(-8).toUpperCase()}` : undefined}
              warningMessage={
                tripError ||
                (routeDeviationWarning
                  ? 'You appear to be outside the assigned route.'
                  : undefined) ||
                (!tripStartError ? gps.error : undefined) ||
                (restoredFromCache
                  ? 'Trip state is cached and must be confirmed with the backend.'
                  : undefined)
              }
            />

            {route ? (
              <RouteProgressCard
                completedStops={Math.max(nextStopIndex, 0)}
                currentStopLabel={
                  nextStop ? `Approaching ${nextStop.name}` : undefined
                }
                destinationLabel={destination?.name}
                nextStop={
                  nextStop
                    ? {
                        stopName: nextStop.name,
                        etaLabel:
                          dashboard.eta && !etaIsStale
                            ? `${Math.ceil(dashboard.eta.etaMinutes)} min`
                            : etaIsStale
                            ? 'ETA stale'
                            : 'Calculating',
                        distanceLabel:
                          dashboard.eta && !etaIsStale
                            ? `${dashboard.eta.remainingDistanceKm.toFixed(1)} km`
                            : undefined,
                        sequenceLabel: `Stop ${nextStop.sequence} of ${routeStops.length}`,
                        isFinalStop: nextStop.id === destination?.id,
                      }
                    : undefined
                }
                onOpenRoute={() => navigation.navigate('RouteDetails')}
                originLabel={origin?.name}
                progress={
                  routeStops.length > 1 && nextStopIndex >= 0
                    ? nextStopIndex / (routeStops.length - 1)
                    : 0
                }
                routeLabel={`${route.routeNumber} · ${route.name}`}
                stops={routeStopPreviews}
                totalStops={routeStops.length}
              />
            ) : (
              <View style={styles.inlineNotice}>
                <Text style={styles.inlineNoticeTitle}>Route details unavailable</Text>
                <Text style={styles.inlineNoticeText}>
                  {dashboard.routeError || 'No real route is assigned.'}
                </Text>
              </View>
            )}

            {dashboard.etaError && trip?.status === 'active' ? (
              <View style={styles.inlineNotice}>
                <Text style={styles.inlineNoticeTitle}>ETA unavailable</Text>
                <Text style={styles.inlineNoticeText}>{dashboard.etaError}</Text>
              </View>
            ) : null}

            <QuickActions actions={quickActions} />
            <DashboardStats
              activeLabel={dashboard.home?.stats.activeHoursLabel || '0m'}
              distanceKm={dashboard.home?.stats.totalDistanceKm || 0}
              totalTrips={dashboard.home?.stats.totalTrips || 0}
            />
            <RecentTrips
              onViewAll={() => navigation.navigate('Trips')}
              trips={dashboard.home?.recentTrips || []}
            />
          </>
        )}
      </ScrollView>

      <BottomNav activeTab="home" onTabPress={onTabPress} />
      <IssueReportModal
        key={issueCategory || 'general'}
        initialCategory={issueCategory}
        onClose={() => setIssueVisible(false)}
        onSubmit={submitIssue}
        submitting={submittingIssue}
        visible={issueVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: driverColors.navy900 },
  content: {
    width: '100%',
    maxWidth: driverSizes.contentMaxWidth,
    alignSelf: 'center',
    gap: driverSpacing.md,
    padding: driverSpacing.md,
    backgroundColor: driverColors.background,
  },
  inlineNotice: {
    padding: driverSpacing.md,
    borderRadius: driverRadii.card,
    borderWidth: 1,
    borderColor: driverColors.border,
    backgroundColor: driverColors.surface,
  },
  inlineNoticeTitle: {
    color: driverColors.text,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
  },
  inlineNoticeText: {
    color: driverColors.textMuted,
    fontSize: driverTypography.label,
    lineHeight: 19,
    marginTop: driverSpacing.xxs,
  },
});
