import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav';
import { getDriverHome } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useDriverLocationTracking } from '../hooks/useDriverLocationTracking';
import type {
  Driver,
  DriverHomeResponse,
  DriverHomeStats,
  DriverHomeTracking,
  DriverHomeTrip,
  VerificationStatus,
} from '../types';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
const { width } = Dimensions.get('window');

// ─── Color Constants ─────────────────────────────────────────────
const COLORS = {
  primary: '#0F172A',
  primaryDark: '#07111F',
  accentAmber: '#F59E0B',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  red: '#DC2626',
  blueBg: '#FEF3C7',
  white: '#FFFFFF',
  bgLight: '#F8FAFC',
  bgCard: '#07111F',
  textDark: '#0F172A',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#CBD5E1',
  textGray: '#64748B',
  textLight: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  onlineGreen: '#16A34A',
};

// ─── Driver Data Type ────────────────────────────────────────────
type DriverData = Partial<Driver> & {
  employeeId?: string;
  phone?: string;
  busNumber?: string;
  accessToken?: string;
  tokenType?: 'Bearer';
  expiresInSeconds?: number;
  status?: string;
};

const EMPTY_STATS: DriverHomeStats = {
  totalTrips: 0,
  totalDistanceKm: 0,
  activeSeconds: 0,
  activeHoursLabel: '0m',
  notifications: 0,
};

const getDriverRecordId = (driverData?: DriverData | null) =>
  driverData?.driver_id || driverData?._id;

const getVerificationStatus = (
  driverData?: DriverData | null,
): VerificationStatus => {
  const status = (driverData?.verificationStatus ?? driverData?.status ?? '')
    .trim()
    .toLowerCase();

  switch (status) {
    case 'approved':
    case 'verified':
    case 'pending':
    case 'blocked':
    case 'rejected':
    case 'unverified':
    case 'under_review':
      return status;

    default:
      return 'pending';
  }
};

const formatDriverId = (driverData?: DriverData | null) => {
  const driverId = driverData?.employeeId || getDriverRecordId(driverData);
  if (!driverId) return 'Driver ID unavailable';
  if (driverId.startsWith('#') || driverId.startsWith('EMP-')) return driverId;
  return `#DRV-${driverId.slice(-6).toUpperCase()}`;
};

const getVehicleNumber = (
  homeData?: DriverHomeResponse | null,
  driverData?: DriverData | null,
) =>
  homeData?.vehicle?.number ||
  driverData?.vehicleRegistrationNumber ||
  driverData?.busNumber ||
  'No vehicle assigned';

const getRouteLabel = (
  homeData?: DriverHomeResponse | null,
  driverData?: DriverData | null,
) => {
  const routeNumber = homeData?.vehicle?.route || driverData?.busRouteNumber;
  const depotOperator =
    homeData?.vehicle?.depotOperator || driverData?.depotOperator;

  if (!routeNumber) return 'No route assigned';

  return depotOperator ? `${routeNumber} • ${depotOperator}` : routeNumber;
};

const getTrackingState = (tracking?: DriverHomeTracking | null) =>
  tracking?.status || 'waiting';

const formatBackendTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DriverDashboard() {
  const navigation: any = useNavigation();
  const route: any = useRoute();
  const routeDriver = route.params?.driver as DriverData | undefined;
  const session = useAuthStore(state => state.session);
  const establishSession = useAuthStore(state => state.establishSession);
  const logout = useAuthStore(state => state.logout);
  const sessionDriver = session?.driver as DriverData | undefined;
  const initialDriver = sessionDriver ?? routeDriver;
  const routeDriverId = getDriverRecordId(initialDriver);
  const [driver, setDriver] = useState<DriverData | null>(
    initialDriver ?? null,
  );
  const [homeData, setHomeData] = useState<DriverHomeResponse | null>(null);
  const [loadingHome, setLoadingHome] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const stats = homeData?.stats ?? EMPTY_STATS;
  const recentTrips = homeData?.recentTrips ?? [];
  const tracking = homeData?.tracking;
  const backendTrackingStatus = getTrackingState(tracking);

  const {
    isTracking: gpsTrackingActive,
    isStarting: gpsStarting,
    isSending: gpsSending,
    lastSentAt: gpsLastSentAt,
    lastLocation: gpsLastLocation,
    error: gpsError,
    startTracking,
    stopTracking,
  } = useDriverLocationTracking();

  const trackingStatus = gpsTrackingActive ? 'live' : backendTrackingStatus;

  const loadDriverHome = useCallback(
    async (showAlert = false) => {
      if (!routeDriverId) {
        if (routeDriver) setDriver(routeDriver);
        setLoadError('Driver id is missing from login response.');
        return;
      }

      setLoadingHome(true);
      setLoadError('');

      try {
        if (!session && routeDriver?.accessToken) {
          await establishSession({
            accessToken: routeDriver.accessToken,
            tokenType: routeDriver.tokenType || 'Bearer',
            expiresInSeconds: routeDriver.expiresInSeconds,
            driver_id: routeDriverId,
            fullName: routeDriver.fullName || 'Driver',
            mobile: routeDriver.mobile || '',
            verificationStatus: getVerificationStatus(routeDriver),
            status: routeDriver.status || 'Login successful',
          });
        }

        const driverHome = await getDriverHome(routeDriverId);
        setHomeData(driverHome);
        setDriver(driverHome.driver);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to load driver home';
        setLoadError(message);
        console.error('Error loading driver home:', error);
        if (initialDriver) {
          setDriver(currentDriver => currentDriver ?? initialDriver);
        }
        if (showAlert) {
          Alert.alert('Backend Error', message);
        }
      } finally {
        setLoadingHome(false);
      }
    },
    [establishSession, initialDriver, routeDriver, routeDriverId, session],
  );

  // ─── Load Driver Data & Check Location ──────────────────────
  useEffect(() => {
    loadDriverHome();
  }, [loadDriverHome]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDriverHome();
    setRefreshing(false);
  }, [loadDriverHome]);

  // ─── Live Trip Handler ──────────────────────────────────────
  const handleToggleLiveTrip = async () => {
    if (gpsTrackingActive) {
      Alert.alert(
        'Stop Live Trip',
        'Passengers will stop receiving new live location updates.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Stop Trip',
            style: 'destructive',
            onPress: () => {
              stopTracking();

              Alert.alert(
                'Trip Stopped',
                'Live GPS updates have been stopped.',
              );
            },
          },
        ],
      );

      return;
    }

    try {
      const started = await startTracking();

      if (started) {
        Alert.alert(
          'Live Trip Started',
          'Your bus location is now being shared with passengers.',
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not start live trip.';

      Alert.alert('Live Trip Failed', message);
    }
  };

  // ─── Logout Handler ─────────────────────────────────────────
  const handleLogout = async () => {
    try {
      stopTracking();
      await logout();

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // ─── Navigation Handler ────────────────────────────────────
  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'trip':
        navigation.navigate('Trips');
        break;
      case 'profile':
        navigation.navigate('Profile');
        break;
      default:
        break;
    }
  };

  // ─── Get Driver Initials ────────────────────────────────────
  const getInitials = (name?: string) => {
    if (!name) return 'D';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // ─── Trip Status Badge ──────────────────────────────────────
  const renderStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    const isPositive =
      normalizedStatus.includes('complete') ||
      normalizedStatus.includes('on-time') ||
      normalizedStatus.includes('on time');

    return (
      <View
        style={[
          styles.statusBadge,
          isPositive ? styles.statusBadgeSuccess : styles.statusBadgeWarning,
        ]}
      >
        <Text
          style={[
            styles.statusBadgeText,
            isPositive
              ? styles.statusBadgeTextSuccess
              : styles.statusBadgeTextWarning,
          ]}
        >
          {status}
        </Text>
      </View>
    );
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgCard} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ══════════════════════════════════════════════════════
            TOP STATUS HEADER
            ══════════════════════════════════════════════════════ */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.menuBtn} onPress={handleLogout}>
            <Ionicons name="menu-outline" size={24} color={COLORS.white} />
          </TouchableOpacity>

          <Text style={styles.appName}>DriveAssist</Text>

          <TouchableOpacity
            style={[
              styles.onlineStatus,
              trackingStatus === 'live'
                ? styles.onlineStatusLive
                : trackingStatus === 'unavailable'
                ? styles.onlineStatusUnavailable
                : styles.onlineStatusWaiting,
            ]}
            onPress={() => loadDriverHome(true)}
            activeOpacity={0.7}
          >
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>
              {gpsTrackingActive
                ? 'LIVE'
                : tracking?.label ||
                  (trackingStatus === 'live'
                    ? 'LIVE'
                    : trackingStatus === 'unavailable'
                    ? 'NO GPS'
                    : 'WAITING')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════════════════
            WELCOME SECTION
            ══════════════════════════════════════════════════════ */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            Welcome, {driver?.fullName?.split(' ')[0] || 'Driver'}
          </Text>
          <Text style={styles.welcomeSub}>
            {homeData?.shift?.summary || 'Shift not started'}
          </Text>

          <View
            style={[
              styles.onDutyBadge,
              homeData?.shift?.status === 'on_duty'
                ? styles.onDutyBadgeActive
                : styles.onDutyBadgeInactive,
            ]}
          >
            <View style={styles.onDutyDot} />
            <Text style={styles.onDutyText}>
              {homeData?.shift?.label || 'Off Duty'}
            </Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            ASSIGNED VEHICLE CARD
            ══════════════════════════════════════════════════════ */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleHeader}>
            <View>
              <Text style={styles.sectionLabel}>ASSIGNED VEHICLE</Text>
              <Text style={styles.vehicleNumber}>
                {getVehicleNumber(homeData, driver)}
              </Text>
            </View>
            <View
              style={[
                styles.inServiceBadge,
                homeData?.vehicle?.serviceStatus === 'In Service'
                  ? styles.inServiceBadgeActive
                  : styles.inServiceBadgePending,
              ]}
            >
              <Text style={styles.inServiceText}>
                {homeData?.vehicle?.serviceStatus || 'Unavailable'}
              </Text>
            </View>
          </View>

          <View style={styles.routeSection}>
            <Text style={styles.sectionLabel}>CURRENT ROUTE</Text>
            <Text style={styles.routeText}>
              {getRouteLabel(homeData, driver)}
            </Text>
          </View>

          {/* Bus Icon Watermark */}
          <View style={styles.busWatermark}>
            <MaterialCommunityIcons
              name="bus"
              size={42}
              color={COLORS.primary}
              style={styles.busWatermarkIcon}
            />
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            LIVE LOCATION STATUS CARD
            ══════════════════════════════════════════════════════ */}
        <TouchableOpacity
          style={styles.locationCard}
          onPress={() => loadDriverHome(true)}
          activeOpacity={0.8}
        >
          <View style={styles.locationCardLeft}>
            <View
              style={[
                styles.locationIconCircle,
                trackingStatus === 'live'
                  ? styles.locationIconCircleLive
                  : trackingStatus === 'unavailable'
                  ? styles.locationIconCircleUnavailable
                  : styles.locationIconCircleWaiting,
              ]}
            >
              <Ionicons
                name={
                  trackingStatus === 'live'
                    ? 'location'
                    : trackingStatus === 'unavailable'
                    ? 'location-outline'
                    : 'location-outline'
                }
                size={20}
                color={
                  trackingStatus === 'live'
                    ? COLORS.green
                    : trackingStatus === 'unavailable'
                    ? COLORS.red
                    : COLORS.textGray
                }
              />
            </View>
            <View style={styles.locationCardContent}>
              <Text style={styles.locationCardTitle}>Live Tracking</Text>
              <Text style={styles.locationCardSub}>
                {gpsTrackingActive
                  ? gpsSending
                    ? 'Sending current GPS location...'
                    : gpsLastSentAt
                    ? `Location sent at ${gpsLastSentAt.toLocaleTimeString(
                        'en-US',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        },
                      )}`
                    : 'Waiting for the first GPS location...'
                  : trackingStatus === 'live'
                  ? `${tracking?.message || 'GPS Active'}${
                      tracking?.lastUpdatedAt
                        ? ` • Last update ${formatBackendTime(
                            tracking.lastUpdatedAt,
                          )}`
                        : ''
                    }`
                  : tracking?.message ||
                    'Start a trip to share the live bus location'}
              </Text>

              {gpsLastLocation && gpsTrackingActive && (
                <Text style={styles.gpsCoordinateText}>
                  {gpsLastLocation.latitude.toFixed(5)},{' '}
                  {gpsLastLocation.longitude.toFixed(5)}
                  {' • '}
                  {gpsLastLocation.speedKmh.toFixed(1)} km/h
                </Text>
              )}
            </View>
          </View>
          {trackingStatus === 'live' && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </TouchableOpacity>

        {!!loadError && (
          <View style={styles.backendErrorCard}>
            <Text style={styles.backendErrorText}>{loadError}</Text>
          </View>
        )}

        {!!gpsError && (
          <View style={styles.backendErrorCard}>
            <Text style={styles.backendErrorText}>GPS: {gpsError}</Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            DRIVER PROFILE BADGE
            ══════════════════════════════════════════════════════ */}
        <View style={styles.profileBadge}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {getInitials(driver?.fullName)}
              </Text>
            </View>
          </View>
          <Text style={styles.employeeLabel}>EMPLOYEE ID</Text>
          <Text style={styles.employeeId}>{formatDriverId(driver)}</Text>
        </View>

        {/* ══════════════════════════════════════════════════════
            QUICK ACTIONS
            ══════════════════════════════════════════════════════ */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: gpsTrackingActive
                  ? COLORS.red
                  : COLORS.accentAmber,
              },
              gpsStarting && styles.actionBtnDisabled,
            ]}
            onPress={handleToggleLiveTrip}
            disabled={gpsStarting}
            activeOpacity={0.85}
          >
            {gpsStarting ? (
              <ActivityIndicator
                size="small"
                color={COLORS.white}
                style={styles.actionIcon}
              />
            ) : (
              <Ionicons
                name={gpsTrackingActive ? 'stop-circle' : 'play-circle'}
                size={22}
                color={COLORS.white}
                style={styles.actionIcon}
              />
            )}

            <Text style={styles.actionBtnTextWhite}>
              {gpsStarting
                ? 'Starting GPS...'
                : gpsTrackingActive
                ? 'Stop Live Trip'
                : 'Start Live Trip'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.border }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="map-legend"
              size={22}
              color={COLORS.textDark}
              style={styles.actionIcon}
            />
            <Text style={styles.actionBtnTextDark}>View My Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.border }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={22}
              color={COLORS.textDark}
              style={styles.actionIcon}
            />
            <Text style={styles.actionBtnTextDark}>Report Incident</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.border }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={22}
              color={COLORS.textDark}
              style={styles.actionIcon}
            />
            <Text style={styles.actionBtnTextDark}>View Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════════════════
            STATS MICRO CARDS
            ══════════════════════════════════════════════════════ */}
        <View style={styles.statsGrid}>
          <View style={styles.microCard}>
            <Text style={styles.microValue}>{stats.totalTrips}</Text>
            <Text style={styles.microLabel}>Total Trips</Text>
          </View>

          <View style={styles.microCard}>
            <Text style={styles.microValue}>{stats.totalDistanceKm}</Text>
            <Text style={styles.microLabel}>Distance (km)</Text>
          </View>

          <View style={styles.microCard}>
            <Text style={styles.microValue}>{stats.activeHoursLabel}</Text>
            <Text style={styles.microLabel}>Hours Active</Text>
          </View>

          <View style={styles.microCard}>
            <Text style={styles.microValue}>{stats.notifications}</Text>
            <Text style={styles.microLabel}>Notifications</Text>
            {stats.notifications > 0 && <View style={styles.notifDot} />}
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            RECENT TRIPS
            ══════════════════════════════════════════════════════ */}
        <View style={styles.recentTripsSection}>
          <View style={styles.recentTripsHeader}>
            <Text style={styles.recentTripsTitle}>Recent Trips</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {loadingHome && recentTrips.length === 0 ? (
            <View style={styles.emptyTripsCard}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.emptyTripsText}>
                Loading backend trips...
              </Text>
            </View>
          ) : recentTrips.length === 0 ? (
            <View style={styles.emptyTripsCard}>
              <Ionicons
                name="file-tray-outline"
                size={26}
                color={COLORS.textLight}
              />
              <Text style={styles.emptyTripsText}>No trips recorded yet</Text>
            </View>
          ) : (
            recentTrips.map((trip: DriverHomeTrip) => (
              <View key={trip.id} style={styles.tripRow}>
                <View style={styles.tripLeft}>
                  <View style={styles.tripCheckCircle}>
                    <Ionicons name="checkmark" size={14} color={COLORS.green} />
                  </View>
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripRoute}>
                      {trip.from && trip.to
                        ? `${trip.from} → ${trip.to}`
                        : 'Route not recorded'}
                    </Text>
                    <Text style={styles.tripMeta}>
                      {trip.status} • {trip.time || 'Time not recorded'} •{' '}
                      {trip.distance}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripRight}>
                  <Text style={styles.tripPassengers}>
                    {trip.passengers} Pax
                  </Text>
                  {renderStatusBadge(trip.status)}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Bottom Spacer for Nav Bar */}
        <View style={styles.bottomNavSpacer} />
      </ScrollView>

      {/* ════════════════════════════════════════════════════════
          BOTTOM NAVIGATION BAR
          ════════════════════════════════════════════════════════ */}
      <BottomNav activeTab={activeTab} onTabPress={handleNavigation} />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  bottomNavSpacer: {
    height: 112,
  },

  // ─── Top Header ─────────────────────────────────────────────
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
    backgroundColor: COLORS.bgCard,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  appName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textOnDark,
    letterSpacing: 0.3,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onlineStatusLive: {
    backgroundColor: COLORS.onlineGreen,
  },
  onlineStatusUnavailable: {
    backgroundColor: COLORS.red,
  },
  onlineStatusWaiting: {
    backgroundColor: COLORS.textGray,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.white,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
  },

  // ─── Welcome Section ────────────────────────────────────────
  welcomeSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textOnDark,
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textOnDarkMuted,
  },
  onDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  onDutyBadgeActive: {
    backgroundColor: COLORS.onlineGreen,
  },
  onDutyBadgeInactive: {
    backgroundColor: COLORS.textGray,
  },
  onDutyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.white,
  },
  onDutyText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ─── Vehicle Card ───────────────────────────────────────────
  vehicleCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 8,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  vehicleNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  inServiceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inServiceBadgeActive: {
    backgroundColor: COLORS.blueBg,
  },
  inServiceBadgePending: {
    backgroundColor: COLORS.borderLight,
  },
  inServiceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  routeSection: {
    marginBottom: 4,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  busWatermark: {
    position: 'absolute',
    right: 20,
    bottom: 15,
  },
  busWatermarkIcon: {
    opacity: 0.08,
  },

  // ─── Live Location Card ───────────────────────────────────
  locationCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
  locationCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  locationCardContent: {
    flex: 1,
  },
  locationIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationIconCircleLive: {
    backgroundColor: COLORS.greenBg,
  },
  locationIconCircleUnavailable: {
    backgroundColor: '#FEE2E2',
  },
  locationIconCircleWaiting: {
    backgroundColor: COLORS.borderLight,
  },
  locationCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  locationCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textGray,
    marginTop: 2,
  },
  gpsCoordinateText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.green,
  },
  backendErrorCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  backendErrorText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: '700',
  },

  // ─── Driver Profile Badge ──────────────────────────────────
  profileBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 10,
  },
  avatarContainer: {
    marginBottom: 10,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentAmber,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  employeeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  employeeId: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    opacity: 0.95,
  },

  // ─── Quick Actions ─────────────────────────────────────────
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textOnDarkMuted,
    letterSpacing: 0.6,
    paddingLeft: 20,
    marginBottom: 10,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  actionBtn: {
    width: (width - 54) / 2,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionIcon: {
    marginBottom: 4,
  },
  actionBtnTextWhite: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.white,
    textAlign: 'center',
  },
  actionBtnTextDark: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.textDark,
    textAlign: 'center',
  },

  // ─── Stats Grid ────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  microCard: {
    width: (width - 52) / 2,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  microValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  microLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textGray,
    marginTop: 4,
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.red,
  },

  // ─── Recent Trips ──────────────────────────────────────────
  recentTripsSection: {
    backgroundColor: COLORS.bgLight,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    flex: 1,
  },
  recentTripsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentTripsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyTripsCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  emptyTripsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textGray,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tripLeft: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flex: 1,
  },
  tripCheckCircle: {
    backgroundColor: COLORS.greenBg,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripInfo: {
    flex: 1,
  },
  tripRoute: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  tripMeta: {
    fontSize: 11,
    color: COLORS.textGray,
    marginTop: 2,
  },
  tripRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tripPassengers: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeSuccess: {
    backgroundColor: COLORS.greenBg,
  },
  statusBadgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextSuccess: {
    color: COLORS.green,
  },
  statusBadgeTextWarning: {
    color: '#D97706',
  },
});
