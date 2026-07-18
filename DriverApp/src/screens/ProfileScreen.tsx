import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import BottomNav from '../components/BottomNav';
import { DriverHeader, ErrorState, LoadingState } from '../components/driver';
import { useDriverTabs } from '../navigation/useDriverTabs';
import { getDriverProfile } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useTripStore } from '../store/useTripStore';
import type { Driver } from '../types';
import type { RootStackParamList } from '../types/navigation';
import {
  driverColors,
  driverRadii,
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../theme/tokens';

function initials(name?: string): string {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'D'
  );
}

function formatDate(value?: string): string {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const onTabPress = useDriverTabs();
  const session = useAuthStore(state => state.session);
  const logout = useAuthStore(state => state.logout);
  const activeTrip = useTripStore(state => state.trip);
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const [profile, setProfile] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (refresh = false) => {
      const sequence = ++requestSequenceRef.current;
      const driverId = session?.driver.driver_id;

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
        const response = await getDriverProfile(driverId);

        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setProfile(response);
        }
      } catch (loadError) {
        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Driver profile could not be loaded.',
          );
        }
      } finally {
        if (mountedRef.current && sequence === requestSequenceRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [session?.driver.driver_id],
  );

  useEffect(() => {
    mountedRef.current = true;
    loadProfile().catch(() => undefined);

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, [loadProfile]);

  const documentsUploaded = useMemo(
    () =>
      profile?.documents
        ? Object.values(profile.documents).filter(Boolean).length
        : 0,
    [profile?.documents],
  );

  const signOut = useCallback(async () => {
    if (activeTrip) {
      Alert.alert(
        'Trip still open',
        'Return to Home and end the active or paused trip before signing out.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to trip controls',
            onPress: () =>
              session && navigation.navigate('DriverHome', { driver: session.driver }),
          },
        ],
      );
      return;
    }

    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [activeTrip, logout, navigation, session]);

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      'Sign out?',
      'Your secure session will be removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => signOut().catch(() => undefined),
        },
      ],
    );
  }, [signOut]);

  const bottomPadding =
    driverSizes.bottomNavHeight + Math.max(insets.bottom, driverSpacing.md) + 40;
  const verificationStatus =
    profile?.verificationStatus || session?.driver.verificationStatus || 'pending';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={driverColors.navy900} />
      <DriverHeader
        statusLabel={verificationStatus}
        statusTone={
          verificationStatus === 'approved' || verificationStatus === 'verified'
            ? 'ready'
            : verificationStatus === 'blocked' || verificationStatus === 'rejected'
            ? 'danger'
            : 'attention'
        }
        subtitle="Driver-visible identity and assignment"
        title="Driver profile"
      />

      {loading && !profile ? (
        <LoadingState message="Loading protected profile data" style={styles.state} />
      ) : error && !profile ? (
        <ErrorState
          message={error}
          onAction={() => loadProfile().catch(() => undefined)}
          style={styles.state}
          title="Profile unavailable"
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomPadding },
          ]}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadProfile(true).catch(() => undefined)}
              refreshing={refreshing}
              tintColor={driverColors.teal700}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.identityCard}>
            <View accessibilityElementsHidden style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(profile?.fullName)}</Text>
            </View>
            <Text accessibilityRole="header" style={styles.name}>
              {profile?.fullName || session?.driver.fullName || 'Driver'}
            </Text>
            <Text style={styles.driverId}>
              Driver #{(profile?.driver_id || session?.driver.driver_id || '').slice(-8).toUpperCase()}
            </Text>
          </View>

          <ProfileSection title="Contact">
            <ProfileRow icon="call-outline" label="Mobile" value={profile?.mobile || 'Not recorded'} />
            <ProfileRow icon="mail-outline" label="Email" value={profile?.email || 'Not recorded'} />
          </ProfileSection>

          <ProfileSection title="Operations assignment">
            <ProfileRow icon="bus-outline" label="Vehicle" value={profile?.vehicleRegistrationNumber || 'No vehicle assigned'} />
            <ProfileRow icon="map-outline" label="Route" value={profile?.busRouteNumber || 'No route assigned'} />
            <ProfileRow icon="business-outline" label="Depot / operator" value={profile?.depotOperator || 'Not assigned'} />
            <ProfileRow icon="people-outline" label="Conductor" value={profile?.conductorName || 'Not assigned'} />
          </ProfileSection>

          <ProfileSection title="Driver credentials">
            <ProfileRow icon="card-outline" label="Driver NTC registration" value={profile?.driverNtcRegistrationNumber || 'Not recorded'} />
            <ProfileRow icon="document-text-outline" label="Bus NTC permit" value={profile?.busNtcPermitNumber || 'Not recorded'} />
            <ProfileRow icon="id-card-outline" label="Driving licence" value={profile?.drivingLicenseNumber || 'Not recorded'} />
            <ProfileRow icon="calendar-outline" label="Licence expiry" value={formatDate(profile?.drivingLicenseExpiry)} />
          </ProfileSection>

          <ProfileSection title="Verification">
            <ProfileRow icon="shield-checkmark-outline" label="Account approval" value={verificationStatus.replace('_', ' ')} />
            <ProfileRow icon="images-outline" label="KYC status" value={(profile?.kycStatus || 'NOT_SUBMITTED').replace('_', ' ')} />
            <ProfileRow icon="documents-outline" label="Documents uploaded" value={`${documentsUploaded} of 4`} />
          </ProfileSection>

          <View style={styles.protectedNotice}>
            <Icon name="lock-closed-outline" size={driverSizes.iconSmall} color={driverColors.info} />
            <Text style={styles.protectedText}>
              Vehicle, route, approval, and protected identity fields can only be changed by authorized operations staff.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out securely"
            onPress={confirmSignOut}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="log-out-outline" size={driverSizes.iconMedium} color={driverColors.error} />
            <Text style={styles.logoutText}>Sign out securely</Text>
          </Pressable>
        </ScrollView>
      )}

      <BottomNav activeTab="profile" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ProfileRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={driverSizes.iconSmall} color={driverColors.teal700} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: driverColors.background },
  state: { flex: 1, margin: driverSpacing.md },
  content: {
    width: '100%',
    maxWidth: driverSizes.contentMaxWidth,
    alignSelf: 'center',
    gap: driverSpacing.md,
    padding: driverSpacing.md,
  },
  errorBanner: { padding: driverSpacing.sm, borderRadius: driverRadii.control, backgroundColor: driverColors.errorSoft },
  errorText: { color: driverColors.error, fontSize: driverTypography.label },
  identityCard: {
    alignItems: 'center',
    padding: driverSpacing.xl,
    borderRadius: driverRadii.feature,
    backgroundColor: driverColors.navy900,
    ...driverShadows.raised,
  },
  avatar: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    borderWidth: 3,
    borderColor: driverColors.teal100,
    backgroundColor: driverColors.teal700,
  },
  avatarText: { color: driverColors.textOnDark, fontSize: driverTypography.pageTitle, fontWeight: driverTypography.weights.heavy },
  name: { color: driverColors.textOnDark, fontSize: driverTypography.sectionTitle, fontWeight: driverTypography.weights.heavy, marginTop: driverSpacing.sm, textAlign: 'center' },
  driverId: { color: driverColors.border, fontSize: driverTypography.label, marginTop: driverSpacing.xxs },
  section: { borderRadius: driverRadii.card, borderWidth: 1, borderColor: driverColors.border, backgroundColor: driverColors.surface, overflow: 'hidden' },
  sectionTitle: { color: driverColors.text, fontSize: driverTypography.cardTitle, fontWeight: driverTypography.weights.heavy, padding: driverSpacing.md, backgroundColor: driverColors.surfaceMuted },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: driverSpacing.sm, paddingHorizontal: driverSpacing.md, borderTopWidth: 1, borderTopColor: driverColors.border },
  rowIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: driverRadii.small, backgroundColor: driverColors.teal100 },
  rowLabel: { flex: 1, color: driverColors.textMuted, fontSize: driverTypography.label },
  rowValue: { flex: 1.2, color: driverColors.text, fontSize: driverTypography.label, fontWeight: driverTypography.weights.semibold, textAlign: 'right', textTransform: 'capitalize' },
  protectedNotice: { flexDirection: 'row', gap: driverSpacing.xs, padding: driverSpacing.sm, borderRadius: driverRadii.control, backgroundColor: driverColors.infoSoft },
  protectedText: { flex: 1, color: driverColors.textMuted, fontSize: driverTypography.caption, lineHeight: 18 },
  logoutButton: { minHeight: driverSizes.primaryControlHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: driverSpacing.xs, borderRadius: driverRadii.control, borderWidth: 1, borderColor: driverColors.error, backgroundColor: driverColors.surface },
  logoutText: { color: driverColors.error, fontSize: driverTypography.body, fontWeight: driverTypography.weights.bold },
  pressed: { opacity: 0.72 },
});
