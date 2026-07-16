import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthScreenShell from '../components/AuthScreenShell';
import DocumentUploader, {
  type DocumentInfo,
} from '../components/DocumentUploader';
import { getDriverStatus, type DriverStatusResponse } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import type { RootStackParamList } from '../types/navigation';
import type { RegistrationDocumentKey } from '../types/registration';

type PendingApprovalScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PendingApproval'
>;

type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'verified'
  | 'blocked'
  | 'rejected'
  | 'unverified'
  | 'under_review'
  | 'unknown';

function PendingApprovalScreen({
  route,
  navigation,
}: PendingApprovalScreenProps) {
  const { driver } = route.params;

  const driverId = driver?.driver_id || driver?._id;
  const logout = useAuthStore(state => state.logout);
  const updateVerificationStatus = useAuthStore(
    state => state.updateVerificationStatus,
  );

  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] =
    useState<VerificationStatus>('pending');
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Waiting for administrator approval.',
  );

  const isCheckingRef = useRef(false);

  const normalizeStatus = (
    response: DriverStatusResponse,
  ): VerificationStatus => {
    const status = (response.verificationStatus ?? response.status ?? '')
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
        return 'unknown';
    }
  };

  const navigateToLogin = useCallback(async () => {
    await logout();

    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [logout, navigation]);

  const handleStatusResult = useCallback(
    (response: DriverStatusResponse) => {
      const normalizedStatus = normalizeStatus(response);

      setCurrentStatus(normalizedStatus);
      setLastCheckedAt(new Date());

      switch (normalizedStatus) {
        case 'approved':
        case 'verified':
          setStatusMessage('Your account has been approved.');
          void updateVerificationStatus('approved');

          Alert.alert(
            'Account Approved',
            'Your driver account has been approved. You can now access driver features.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [
                      {
                        name: 'DriverHome',
                        params: {
                          driver: {
                            ...driver,
                            ...response,
                            verificationStatus: 'approved',
                          },
                        },
                      },
                    ],
                  });
                },
              },
            ],
          );
          return;

        case 'pending':
        case 'unverified':
        case 'under_review':
          setStatusMessage('Your account is still under verification.');
          return;

        case 'blocked':
          setStatusMessage('Your account has been blocked.');

          Alert.alert(
            'Account Blocked',
            'Your account has been blocked. Please contact the administrator.',
            [
              {
                text: 'Back to Login',
                onPress: navigateToLogin,
              },
            ],
          );
          return;

        case 'rejected':
          setStatusMessage('Your registration has been rejected.');

          Alert.alert(
            'Registration Rejected',
            'Your registration has been rejected. Please contact the administrator for more information.',
            [
              {
                text: 'Back to Login',
                onPress: navigateToLogin,
              },
            ],
          );
          return;

        default:
          setStatusMessage(
            'The current verification status could not be identified.',
          );
      }
    },
    [driver, navigateToLogin, navigation, updateVerificationStatus],
  );

  const checkApprovalStatus = useCallback(
    async (silent = false) => {
      if (!driverId || isCheckingRef.current) {
        return;
      }

      isCheckingRef.current = true;

      if (!silent) {
        setCheckingStatus(true);
      }

      try {
        const response = await getDriverStatus(driverId);

        handleStatusResult(response);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not check your account status.';

        if (!silent) {
          Alert.alert('Status Check Failed', message);
        }
      } finally {
        isCheckingRef.current = false;

        if (!silent) {
          setCheckingStatus(false);
        }
      }
    },
    [driverId, handleStatusResult],
  );

  useEffect(() => {
    checkApprovalStatus(true);

    const intervalId = setInterval(() => {
      checkApprovalStatus(true);
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [checkApprovalStatus]);

  const handleDocumentUploaded = (
    docType: RegistrationDocumentKey,
    url: string,
  ) => {
    setDocuments(previousDocuments => {
      const remainingDocuments = previousDocuments.filter(
        document => document.docType !== docType,
      );

      return [
        ...remainingDocuments,
        {
          docType,
          label: docType
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, character => character.toUpperCase()),
          uploadedUrl: url,
        },
      ];
    });
  };

  const getStatusLabel = (): string => {
    switch (currentStatus) {
      case 'approved':
      case 'verified':
        return 'Approved';

      case 'blocked':
        return 'Blocked';

      case 'rejected':
        return 'Rejected';

      case 'under_review':
        return 'Under Review';

      case 'unverified':
        return 'Unverified';

      case 'pending':
        return 'Pending Verification';

      default:
        return 'Unknown';
    }
  };

  const getStatusStyle = () => {
    switch (currentStatus) {
      case 'approved':
      case 'verified':
        return styles.approved;

      case 'blocked':
      case 'rejected':
        return styles.rejected;

      default:
        return styles.pending;
    }
  };

  const formattedLastCheckedTime = lastCheckedAt
    ? lastCheckedAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <AuthScreenShell scroll contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>Pending Approval</Text>
        </View>

        <Text style={styles.title}>Registration Pending</Text>

        <Text style={styles.subtitle}>
          Thank you for registering, {driver?.fullName || 'Driver'}!
        </Text>

        <Text style={styles.message}>
          Your account is currently being verified. GPS tracking and other
          restricted driver features will become available after your account is
          approved.
        </Text>
      </View>

      <View style={styles.contentCard}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Mobile Number</Text>
          <Text style={styles.infoValue}>{driver?.mobile || 'Not available'}</Text>

          <Text style={styles.infoLabel}>Verification Status</Text>

          <Text style={[styles.infoValue, getStatusStyle()]}>
            {getStatusLabel()}
          </Text>

          <Text style={styles.statusMessage}>{statusMessage}</Text>

          {formattedLastCheckedTime && (
            <Text style={styles.lastChecked}>
              Last checked at {formattedLastCheckedTime}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.checkButton, checkingStatus && styles.buttonDisabled]}
          onPress={() => checkApprovalStatus(false)}
          disabled={checkingStatus || !driverId}
          activeOpacity={0.88}
        >
          {checkingStatus ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Check Approval Status</Text>
          )}
        </TouchableOpacity>

        {driverId ? (
          <DocumentUploader
            driverId={driverId}
            documents={documents}
            onDocumentUploaded={handleDocumentUploaded}
          />
        ) : (
          <Text style={styles.errorText}>
            Driver identification number is unavailable.
          </Text>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={navigateToLogin}
          activeOpacity={0.88}
        >
          <Text style={styles.secondaryButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderRadius: 30,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  contentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 10,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 14,
  },
  statusPillText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E2E8F0',
    marginBottom: 14,
  },
  message: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  pending: {
    color: '#f39c12',
  },
  approved: {
    color: '#198754',
  },
  rejected: {
    color: '#dc3545',
  },
  statusMessage: {
    marginTop: 12,
    color: '#666',
    fontSize: 13,
    lineHeight: 19,
  },
  lastChecked: {
    marginTop: 8,
    color: '#999',
    fontSize: 12,
  },
  checkButton: {
    minHeight: 52,
    backgroundColor: '#0F172A',
    padding: 15,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 15,
    borderRadius: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: '#dc3545',
    textAlign: 'center',
    fontSize: 13,
    marginVertical: 16,
  },
});

export default PendingApprovalScreen;
