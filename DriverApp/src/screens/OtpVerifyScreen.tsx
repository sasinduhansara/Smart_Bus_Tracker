import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthScreenShell from '../components/AuthScreenShell';
import { verifyLoginOTP, verifyRegisterOTP } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useDriverRegistrationStore } from '../store/useDriverRegistrationStore';

import type {
  DriverSession,
  VerificationStatus,
  VerifyOTPResponse,
} from '../types';

import type { RootStackParamList } from '../types/navigation';

type OtpVerifyScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'OtpVerify'
>;

type VerificationResponse = VerifyOTPResponse & {
  status?: string;
};

type NormalizedVerificationStatus = VerificationStatus | 'unknown';

const OTP_LENGTH = 6;

function OtpVerifyScreen({ route, navigation }: OtpVerifyScreenProps) {
  const { mobile, purpose } = route.params;

  const inputRef = useRef<TextInput>(null);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const resetRegistration = useDriverRegistrationStore(
    state => state.resetRegistration,
  );

  const establishSession = useAuthStore(state => state.establishSession);
  const logout = useAuthStore(state => state.logout);

  const canVerify = otp.length === OTP_LENGTH && !loading;

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    return () => {
      clearTimeout(focusTimer);
    };
  }, []);

  const getVerificationStatus = (
    response: VerificationResponse,
  ): NormalizedVerificationStatus => {
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

  const resetToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const resetToDriverRoute = (
    screenName: 'DriverHome' | 'PendingApproval',
    driver: DriverSession,
  ) => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: screenName,
          params: {
            driver,
          },
        },
      ],
    });
  };

  const navigateByVerificationStatus = async (data: VerificationResponse) => {
    const verificationStatus = getVerificationStatus(data);

    switch (verificationStatus) {
      case 'approved':
      case 'verified': {
        if (purpose === 'register') {
          resetRegistration();
        }

        const session = await establishSession({
          ...data,
          verificationStatus,
        });

        resetToDriverRoute('DriverHome', session.driver);
        return;
      }

      case 'pending':
      case 'unverified':
      case 'under_review':
      case 'rejected': {
        if (purpose === 'register') {
          resetRegistration();
        }

        const session = await establishSession({
          ...data,
          verificationStatus,
        });

        resetToDriverRoute('PendingApproval', session.driver);
        return;
      }

      case 'blocked':
        await logout();

        Alert.alert(
          'Account Blocked',
          'Your account has been blocked. Please contact the administrator.',
          [
            {
              text: 'OK',
              onPress: resetToLogin,
            },
          ],
        );
        return;

      default:
        await logout();

        Alert.alert(
          'Verification Status Error',
          'OTP verification was successful, but your account status could not be identified. Please log in again.',
          [
            {
              text: 'OK',
              onPress: resetToLogin,
            },
          ],
        );
    }
  };

  const verifyOtp = async () => {
    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit verification code.');
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      let data: VerificationResponse;

      if (purpose === 'register') {
        data = await verifyRegisterOTP(mobile, normalizedOtp);
      } else {
        data = await verifyLoginOTP(mobile, normalizedOtp);
      }

      await navigateByVerificationStatus(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'OTP verification failed. Please try again.';

      Alert.alert('Verification Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, OTP_LENGTH);

    setOtp(numericValue);
  };

  const focusOtpInput = () => {
    if (!loading) {
      inputRef.current?.focus();
    }
  };

  return (
    <AuthScreenShell centered>
      <View style={styles.card}>
        <View style={styles.otpBadge}>
          <Text style={styles.otpBadgeText}>OTP</Text>
        </View>

        <Text style={styles.title}>Verify Access</Text>

        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.mobileBold}>{mobile}</Text>
        </Text>

        <TouchableOpacity
          style={styles.otpInputArea}
          onPress={focusOtpInput}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Enter six digit verification code"
        >
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            editable={!loading}
            caretHidden
            textContentType="oneTimeCode"
            importantForAutofill="yes"
            selection={{
              start: otp.length,
              end: otp.length,
            }}
          />

          <View style={styles.otpRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const digit = otp[index] ?? '';
              const isFilled = Boolean(digit);

              const isActive =
                !loading && otp.length < OTP_LENGTH && index === otp.length;

              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    isFilled && styles.otpBoxFilled,
                    isActive && styles.otpBoxActive,
                  ]}
                >
                  <Text style={styles.otpDigit}>{digit}</Text>

                  {isActive ? <View style={styles.activeIndicator} /> : null}
                </View>
              );
            })}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !canVerify && styles.buttonDisabled]}
          onPress={verifyOtp}
          disabled={!canVerify}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 30,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    shadowColor: '#020617',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 12,
  },

  otpBadge: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },

  otpBadgeText: {
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    fontSize: 31,
    fontWeight: '900',
    textAlign: 'center',
    color: '#0F172A',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 28,
    lineHeight: 24,
  },

  mobileBold: {
    fontWeight: '900',
    color: '#0F172A',
  },

  otpInputArea: {
    position: 'relative',
    marginBottom: 20,
  },

  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  otpBox: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  otpBoxFilled: {
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },

  otpBoxActive: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },

  otpDigit: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '800',
  },

  activeIndicator: {
    position: 'absolute',
    width: 2,
    height: 24,
    borderRadius: 1,
    backgroundColor: '#F59E0B',
  },

  button: {
    minHeight: 54,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default OtpVerifyScreen;
