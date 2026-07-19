import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AuthScreenShell from '../components/AuthScreenShell';
import RegisterDocumentsScreen from './RegisterDocumentsScreen';
import RegisterDriverDetailsScreen from './RegisterDriverDetailsScreen';
import RegisterPersonalScreen from './RegisterPersonalScreen';
import RegisterReviewScreen from './RegisterReviewScreen';

import {
  checkDriverRegistrationAvailability,
  requestRegisterOTP,
} from '../services/api';

import { useDriverRegistrationStore } from '../store/useDriverRegistrationStore';

import type { RootStackParamList } from '../types/navigation';

import type {
  DocumentFile,
  DriverRegistrationTextField,
  RegistrationAvailabilityField,
  RegistrationAvailabilityStates,
  RegistrationDocumentKey,
  RegistrationErrors,
} from '../types/registration';

import {
  isValidEmail,
  isValidMobile,
  isValidNIC,
  isValidPassword,
  isTodayOrFutureDate,
} from '../utils/validation';

type RegisterScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Register'
>;

type AvailabilityRequest = Parameters<
  typeof checkDriverRegistrationAvailability
>[0];

const AVAILABILITY_CHECK_DELAY_MS = 700;

const INITIAL_AVAILABILITY: RegistrationAvailabilityStates = {
  nic: 'idle',
  mobile: 'idle',
  email: 'idle',
};

const STEP_TITLES: Record<number, string> = {
  1: 'Personal Information',
  2: 'Driver Qualifications',
  3: 'KYC Documents',
  4: 'Review & Submit',
};

const isAvailabilityField = (
  field: DriverRegistrationTextField,
): field is RegistrationAvailabilityField =>
  field === 'nic' || field === 'mobile' || field === 'email';

function RegisterScreen({ navigation }: RegisterScreenProps) {
  const form = useDriverRegistrationStore(state => state.form);
  const updateField = useDriverRegistrationStore(state => state.updateField);
  const setDocument = useDriverRegistrationStore(state => state.setDocument);
  const removeDocument = useDriverRegistrationStore(
    state => state.removeDocument,
  );
  const nextStep = useDriverRegistrationStore(state => state.nextStep);
  const previousStep = useDriverRegistrationStore(state => state.previousStep);
  const getPayload = useDriverRegistrationStore(state => state.getPayload);

  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [availability, setAvailability] =
    useState<RegistrationAvailabilityStates>(INITIAL_AVAILABILITY);

  const timersRef = useRef<
    Partial<
      Record<RegistrationAvailabilityField, ReturnType<typeof setTimeout>>
    >
  >({});

  const requestIdsRef = useRef<Record<RegistrationAvailabilityField, number>>({
    nic: 0,
    mobile: 0,
    email: 0,
  });

  useEffect(() => {
    const timers = timersRef.current;
    const requestIds = requestIdsRef.current;

    return () => {
      Object.values(timers).forEach(timer => {
        if (timer) {
          clearTimeout(timer);
        }
      });

      (Object.keys(requestIds) as RegistrationAvailabilityField[]).forEach(
        field => {
          requestIds[field] += 1;
        },
      );
    };
  }, []);

  const clearError = useCallback((field: keyof RegistrationErrors) => {
    setErrors(previousErrors => ({
      ...previousErrors,
      [field]: undefined,
    }));
  }, []);

  const setFieldAvailability = useCallback(
    (
      field: RegistrationAvailabilityField,
      state: RegistrationAvailabilityStates[RegistrationAvailabilityField],
    ) => {
      setAvailability(previousAvailability => ({
        ...previousAvailability,
        [field]: state,
      }));
    },
    [],
  );

  const isAvailabilityValueValid = useCallback(
    (field: RegistrationAvailabilityField, value: string): boolean => {
      if (field === 'nic') {
        return isValidNIC(value);
      }

      if (field === 'mobile') {
        return isValidMobile(value);
      }

      return isValidEmail(value);
    },
    [],
  );

  const createAvailabilityRequest = useCallback(
    (
      field: RegistrationAvailabilityField,
      rawValue: string,
    ): AvailabilityRequest => {
      const request: AvailabilityRequest = {
        mobile: '',
        email: '',
        nic: '',
      };

      if (field === 'nic') {
        request.nic = rawValue.trim().toUpperCase();
      } else if (field === 'mobile') {
        request.mobile = rawValue.trim();
      } else {
        request.email = rawValue.trim().toLowerCase();
      }

      return request;
    },
    [],
  );

  const cancelPendingCheck = useCallback(
    (field: RegistrationAvailabilityField) => {
      const timer = timersRef.current[field];

      if (timer) {
        clearTimeout(timer);
        delete timersRef.current[field];
      }

      requestIdsRef.current[field] += 1;
    },
    [],
  );

  const scheduleAvailabilityCheck = useCallback(
    (field: RegistrationAvailabilityField, rawValue: string) => {
      cancelPendingCheck(field);

      if (!isAvailabilityValueValid(field, rawValue)) {
        setFieldAvailability(field, 'idle');
        return;
      }

      const requestId = requestIdsRef.current[field];
      setFieldAvailability(field, 'checking');

      timersRef.current[field] = setTimeout(async () => {
        try {
          const result = await checkDriverRegistrationAvailability(
            createAvailabilityRequest(field, rawValue),
          );

          if (requestId !== requestIdsRef.current[field]) {
            return;
          }

          const conflict = result.conflicts?.[field];

          if (conflict) {
            setFieldAvailability(field, 'conflict');
            setErrors(previousErrors => ({
              ...previousErrors,
              [field]: conflict,
            }));
            return;
          }

          setFieldAvailability(field, 'available');
          setErrors(previousErrors => ({
            ...previousErrors,
            [field]: undefined,
          }));
        } catch {
          if (requestId !== requestIdsRef.current[field]) {
            return;
          }

          setFieldAvailability(field, 'error');
        } finally {
          delete timersRef.current[field];
        }
      }, AVAILABILITY_CHECK_DELAY_MS);
    },
    [
      cancelPendingCheck,
      createAvailabilityRequest,
      isAvailabilityValueValid,
      setFieldAvailability,
    ],
  );

  const handleChangeText = useCallback(
    (field: DriverRegistrationTextField) => (value: string) => {
      updateField(field, value);
      clearError(field);

      if (isAvailabilityField(field)) {
        scheduleAvailabilityCheck(field, value);
      }
    },
    [clearError, scheduleAvailabilityCheck, updateField],
  );

  const getPersonalStepErrors = (): RegistrationErrors => {
    const newErrors: RegistrationErrors = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!isValidNIC(form.nic)) {
      newErrors.nic = 'Enter a valid NIC (9 digits + V/X or 12 digits)';
    } else if (availability.nic === 'conflict') {
      newErrors.nic = 'This NIC is already registered';
    }

    if (!isValidMobile(form.mobile)) {
      newErrors.mobile = 'Enter a valid mobile number';
    } else if (availability.mobile === 'conflict') {
      newErrors.mobile = 'This mobile number is already registered';
    }

    if (!isValidEmail(form.email)) {
      newErrors.email = 'Enter a valid email address';
    } else if (availability.email === 'conflict') {
      newErrors.email = 'This email is already registered';
    }

    if (!isValidPassword(form.password)) {
      newErrors.password = 'Use at least 8 characters with a letter and number';
    }

    return newErrors;
  };

  const getDriverDetailsStepErrors = (): RegistrationErrors => {
    const newErrors: RegistrationErrors = {};

    if (!form.driverNtcRegistrationNumber.trim()) {
      newErrors.driverNtcRegistrationNumber =
        'Driver NTC registration number is required';
    }

    if (!form.drivingLicenseNumber.trim()) {
      newErrors.drivingLicenseNumber = 'Driving license number is required';
    }

    if (!form.drivingLicenseExpiry.trim()) {
      newErrors.drivingLicenseExpiry = 'Driving license expiry is required';
    } else if (!isTodayOrFutureDate(form.drivingLicenseExpiry)) {
      newErrors.drivingLicenseExpiry =
        'Driving license expiry cannot be a past date';
    }

    return newErrors;
  };

  const validatePersonalStep = (): boolean => {
    const newErrors = getPersonalStepErrors();
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDriverDetailsStep = (): boolean => {
    const newErrors = getDriverDetailsStepErrors();
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRequiredSteps = (): boolean => {
    const newErrors = {
      ...getPersonalStepErrors(),
      ...getDriverDetailsStepErrors(),
    };

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkAllAvailability = async (): Promise<boolean> => {
    const fields: RegistrationAvailabilityField[] = ['nic', 'mobile', 'email'];

    fields.forEach(cancelPendingCheck);
    setLoading(true);

    try {
      const result = await checkDriverRegistrationAvailability({
        mobile: form.mobile,
        email: form.email.trim().toLowerCase(),
        nic: form.nic,
      });

      fields.forEach(field => {
        const value = String(form[field] ?? '');

        if (!isAvailabilityValueValid(field, value)) {
          setFieldAvailability(field, 'idle');
          return;
        }

        setFieldAvailability(
          field,
          result.conflicts?.[field] ? 'conflict' : 'available',
        );
      });

      if (result.available) {
        return true;
      }

      setErrors(previousErrors => ({
        ...previousErrors,
        ...result.conflicts,
      }));
      return false;
    } catch (error) {
      fields.forEach(field => {
        setFieldAvailability(field, 'error');
      });

      const message =
        error instanceof Error
          ? error.message
          : 'Could not check registration details';

      Alert.alert('Registration Check Failed', message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (form.currentStep === 1) {
      if (!validatePersonalStep()) {
        return;
      }

      if (!(await checkAllAvailability())) {
        return;
      }
    }

    if (form.currentStep === 2 && !validateDriverDetailsStep()) {
      return;
    }

    setErrors({});
    nextStep();
  };

  const handlePrevious = () => {
    setErrors({});

    if (form.currentStep === 4) {
      setConfirmed(false);
    }

    previousStep();
  };

  const handleSetDocument = (
    field: RegistrationDocumentKey,
    file: DocumentFile,
  ) => {
    setDocument(field, file);
  };

  const handleToggleConfirmed = () => {
    setConfirmed(previousValue => !previousValue);
    clearError('confirmation');
  };

  const handleSubmit = async () => {
    if (!confirmed) {
      setErrors({
        confirmation: 'Please confirm the information is correct',
      });
      return;
    }

    if (!validateRequiredSteps()) {
      return;
    }

    if (!(await checkAllAvailability())) {
      return;
    }

    setLoading(true);

    try {
      const payload = getPayload();
      await requestRegisterOTP(payload);

      navigation.navigate('OtpVerify', {
        mobile: payload.mobile,
        purpose: 'register',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not connect to server';

      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    if (form.currentStep === 1) {
      return (
        <RegisterPersonalScreen
          form={form}
          errors={errors}
          availability={availability}
          onChangeText={handleChangeText}
        />
      );
    }

    if (form.currentStep === 2) {
      return (
        <RegisterDriverDetailsScreen
          form={form}
          errors={errors}
          onChangeText={handleChangeText}
        />
      );
    }

    if (form.currentStep === 3) {
      return (
        <RegisterDocumentsScreen
          form={form}
          loading={loading}
          onSetDocument={handleSetDocument}
          onRemoveDocument={removeDocument}
          onSkip={handleNext}
          onContinue={handleNext}
        />
      );
    }

    return (
      <RegisterReviewScreen
        form={form}
        confirmed={confirmed}
        loading={loading}
        onToggleConfirmed={handleToggleConfirmed}
        onSubmit={handleSubmit}
      />
    );
  };

  const availabilityBusy =
    availability.nic === 'checking' ||
    availability.mobile === 'checking' ||
    availability.email === 'checking';

  const availabilityConflict =
    availability.nic === 'conflict' ||
    availability.mobile === 'conflict' ||
    availability.email === 'conflict';

  const nextButtonDisabled =
    loading ||
    (form.currentStep === 1 && (availabilityBusy || availabilityConflict));

  return (
    <AuthScreenShell scroll contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>Driver Onboarding</Text>
        </View>

        <Text style={styles.title}>Gamana.lk</Text>
        <Text style={styles.subtitle}>Create your verified driver profile</Text>

        <View style={styles.stepHeader}>
          <Text style={styles.stepCount}>Step {form.currentStep} of 4</Text>
          <Text style={styles.stepTitle}>{STEP_TITLES[form.currentStep]}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        {renderStep()}

        {errors.confirmation ? (
          <Text style={styles.confirmationError}>{errors.confirmation}</Text>
        ) : null}

        {form.currentStep < 3 ? (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              nextButtonDisabled && styles.primaryButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={nextButtonDisabled}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryButtonText}>
              {loading || availabilityBusy ? 'Checking...' : 'Next'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {form.currentStep > 1 ? (
          <TouchableOpacity
            style={[
              styles.backButton,
              form.currentStep === 3 && styles.documentsBackButton,
            ]}
            onPress={handlePrevious}
            disabled={loading}
            activeOpacity={0.88}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#0F172A" />
            <Text style={styles.loadingText}>
              {form.currentStep === 4
                ? 'Requesting OTP...'
                : 'Checking registration details...'}
            </Text>
          </View>
        ) : null}

        {form.currentStep === 1 ? (
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? Login</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderRadius: 30,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginBottom: 16,
  },
  headerBadgeText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  formCard: {
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
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 20,
    lineHeight: 21,
  },
  stepHeader: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  stepCount: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '900',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  documentsBackButton: {
    marginTop: 14,
  },
  backButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmationError: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  loadingText: { color: '#475569', fontSize: 13 },
  linkText: {
    color: '#0369A1',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default RegisterScreen;
