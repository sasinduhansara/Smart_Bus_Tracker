import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthScreenShell from '../components/AuthScreenShell';

import {
  getDriverOnboardingStatus,
  type DriverOnboardingNextStep,
} from '../services/api';

import { useAuthStore } from '../store/useAuthStore';

import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverAccessGate'>;

function DriverAccessGateScreen({ navigation }: Props) {
  const session = useAuthStore(state => state.session);

  const logout = useAuthStore(state => state.logout);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const requestRunningRef = useRef(false);

  const navigateByNextStep = useCallback(
    async (nextStep: DriverOnboardingNextStep) => {
      const driver = session?.driver;

      if (!driver) {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'Login',
            },
          ],
        });

        return;
      }

      switch (nextStep) {
        case 'READY_FOR_HOME':
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'DriverHome',
                params: {
                  driver,
                },
              },
            ],
          });

          return;

        case 'BUS_REGISTRATION_REQUIRED':
        case 'BUS_REQUEST_PENDING':
        case 'BUS_CORRECTION_REQUIRED':
        case 'BUS_REQUEST_REJECTED':
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'BusOnboarding',
              },
            ],
          });

          return;

        case 'DRIVER_VERIFICATION_PENDING':
        case 'DRIVER_CORRECTION_REQUIRED':
        case 'DRIVER_REJECTED':
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'PendingApproval',
                params: {
                  driver,
                },
              },
            ],
          });

          return;

        case 'ACCOUNT_BLOCKED':
          await logout();

          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'Login',
              },
            ],
          });

          return;

        default:
          throw new Error('Unsupported onboarding state.');
      }
    },
    [logout, navigation, session?.driver],
  );

  const resolveAccess = useCallback(async () => {
    if (requestRunningRef.current) {
      return;
    }

    if (!session) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Login',
          },
        ],
      });

      return;
    }

    requestRunningRef.current = true;

    setLoading(true);
    setError('');

    try {
      const response = await getDriverOnboardingStatus();

      await navigateByNextStep(response.nextStep);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not check your account access.',
      );
    } finally {
      requestRunningRef.current = false;

      setLoading(false);
    }
  }, [navigateByNextStep, navigation, session]);

  useEffect(() => {
    resolveAccess().catch(() => undefined);
  }, [resolveAccess]);

  const handleSignOut = async () => {
    await logout();

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Login',
        },
      ],
    });
  };

  return (
    <AuthScreenShell centered>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>G</Text>
        </View>

        <Text style={styles.title}>Checking Access</Text>

        <Text style={styles.subtitle}>
          Verifying your driver account and registered bus.
        </Text>

        {loading ? <ActivityIndicator size="large" color="#0F172A" /> : null}

        {error ? (
          <>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => resolveAccess().catch(() => undefined)}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleSignOut().catch(() => undefined)}
            >
              <Text style={styles.secondaryButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: 28,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  badge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  badgeText: {
    color: '#F59E0B',
    fontSize: 30,
    fontWeight: '900',
  },

  title: {
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  errorBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 20,
  },

  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  secondaryButton: {
    marginTop: 12,
    padding: 10,
  },

  secondaryButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default DriverAccessGateScreen;
