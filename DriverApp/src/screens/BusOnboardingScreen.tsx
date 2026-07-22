import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  getDriverBusOnboardingReferences,
  getDriverOnboardingStatus,
  submitDriverBusRequest,
  type BusOnboardingDepot,
  type BusOnboardingRoute,
  type DriverBusServiceType,
  type DriverOnboardingStatusResponse,
} from '../services/api';

import { useAuthStore } from '../store/useAuthStore';

import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'BusOnboarding'>;

type FormState = {
  vehicleRegistrationNumber: string;
  ntcPermitNumber: string;
  serviceType: DriverBusServiceType | '';
  depotId: string;
  routeId: string;
  make: string;
  model: string;
  manufactureYear: string;
  seatingCapacity: string;
  notes: string;
};

type SelectorType = 'serviceType' | 'depot' | 'route' | null;

type SelectorOption = {
  id: string;
  title: string;
  subtitle?: string;
};

const EMPTY_FORM: FormState = {
  vehicleRegistrationNumber: '',
  ntcPermitNumber: '',
  serviceType: '',
  depotId: '',
  routeId: '',
  make: '',
  model: '',
  manufactureYear: '',
  seatingCapacity: '',
  notes: '',
};

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : '';
}

function serviceTypeLabel(serviceType: DriverBusServiceType): string {
  return serviceType === 'sltb' ? 'SLTB' : capitalize(serviceType);
}

function requestTypeLabel(requestType?: string): string {
  if (requestType === 'existing_bus_claim') {
    return 'Existing bus claim';
  }

  if (requestType === 'new_bus_registration') {
    return 'New bus registration';
  }

  return 'Bus registration request';
}

function BusOnboardingScreen({ navigation }: Props) {
  const session = useAuthStore(state => state.session);

  const logout = useAuthStore(state => state.logout);

  const [onboarding, setOnboarding] =
    useState<DriverOnboardingStatusResponse | null>(null);

  const [depots, setDepots] = useState<BusOnboardingDepot[]>([]);

  const [routes, setRoutes] = useState<BusOnboardingRoute[]>([]);

  const [serviceTypes, setServiceTypes] = useState<DriverBusServiceType[]>([]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [selector, setSelector] = useState<SelectorType>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');

  const requestRunningRef = useRef(false);

  const prefilledRevisionRef = useRef('');

  const driver = session?.driver;

  const serviceRoutes = useMemo(
    () =>
      routes.filter(route =>
        form.serviceType
          ? route.serviceCategories.includes(form.serviceType)
          : false,
      ),
    [form.serviceType, routes],
  );

  const availableDepots = useMemo(() => {
    const depotNames = new Set(
      serviceRoutes.map(route => route.depotName.trim().toLowerCase()),
    );

    return depots.filter(depot =>
      depotNames.has(depot.name.trim().toLowerCase()),
    );
  }, [depots, serviceRoutes]);

  const selectedDepot = availableDepots.find(
    depot => depot.id === form.depotId,
  );

  const availableRoutes = useMemo(
    () =>
      selectedDepot
        ? serviceRoutes.filter(
            route =>
              route.depotName.trim().toLowerCase() ===
              selectedDepot.name.trim().toLowerCase(),
          )
        : [],
    [selectedDepot, serviceRoutes],
  );

  const selectedRoute = availableRoutes.find(
    route => route.id === form.routeId,
  );

  const navigateHome = useCallback(() => {
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
  }, [driver, navigation]);

  const navigateDriverApproval = useCallback(() => {
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
  }, [driver, navigation]);

  const handleAccountState = useCallback(
    async (response: DriverOnboardingStatusResponse) => {
      switch (response.nextStep) {
        case 'READY_FOR_HOME':
          navigateHome();
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

        case 'DRIVER_VERIFICATION_PENDING':
        case 'DRIVER_CORRECTION_REQUIRED':
        case 'DRIVER_REJECTED':
          navigateDriverApproval();
          return;

        default:
          return;
      }
    },
    [logout, navigateDriverApproval, navigateHome, navigation],
  );

  const prefillFromRequest = useCallback(
    (response: DriverOnboardingStatusResponse) => {
      const busRequest = response.busRequest;

      if (!busRequest) {
        return;
      }

      const revisionKey = `${busRequest.id}:` + `${busRequest.requestRevision}`;

      if (prefilledRevisionRef.current === revisionKey) {
        return;
      }

      prefilledRevisionRef.current = revisionKey;

      setForm({
        vehicleRegistrationNumber: busRequest.vehicleRegistrationNumber || '',

        ntcPermitNumber: busRequest.ntcPermitNumber || '',

        serviceType: busRequest.serviceType || '',

        depotId: busRequest.depotId || '',

        routeId: busRequest.routeId || '',

        make: busRequest.make || '',

        model: busRequest.model || '',

        manufactureYear: busRequest.manufactureYear
          ? String(busRequest.manufactureYear)
          : '',

        seatingCapacity: busRequest.seatingCapacity
          ? String(busRequest.seatingCapacity)
          : '',

        notes: busRequest.notes || '',
      });
    },
    [],
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
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

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      try {
        const [onboardingResponse, referencesResponse] = await Promise.all([
          getDriverOnboardingStatus(),
          getDriverBusOnboardingReferences(),
        ]);

        setOnboarding(onboardingResponse);

        setDepots(referencesResponse.depots);

        setRoutes(referencesResponse.routes);

        setServiceTypes(referencesResponse.serviceTypes);

        prefillFromRequest(onboardingResponse);

        await handleAccountState(onboardingResponse);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load bus registration details.',
        );
      } finally {
        requestRunningRef.current = false;

        setLoading(false);
        setRefreshing(false);
      }
    },
    [handleAccountState, navigation, prefillFromRequest, session],
  );

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  useEffect(() => {
    if (
      !form.depotId ||
      availableDepots.some(depot => depot.id === form.depotId)
    ) {
      return;
    }

    setForm(current => ({
      ...current,
      depotId: '',
      routeId: '',
    }));
  }, [availableDepots, form.depotId]);

  useEffect(() => {
    if (
      !form.routeId ||
      availableRoutes.some(route => route.id === form.routeId)
    ) {
      return;
    }

    setForm(current => ({
      ...current,
      routeId: '',
    }));
  }, [availableRoutes, form.routeId]);

  const updateField = <Field extends keyof FormState>(
    field: Field,
    value: FormState[Field],
  ) => {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  };

  const validateForm = (): string => {
    if (!form.vehicleRegistrationNumber.trim()) {
      return 'Vehicle registration number is required.';
    }

    if (!form.serviceType) {
      return 'Select a service type.';
    }

    if (!form.depotId) {
      return 'Select a depot.';
    }

    if (!form.routeId) {
      return 'Select a route.';
    }

    if (form.manufactureYear && !/^\d{4}$/.test(form.manufactureYear)) {
      return 'Enter a valid manufacture year.';
    }

    if (form.seatingCapacity && !/^\d+$/.test(form.seatingCapacity)) {
      return 'Enter a valid seating capacity.';
    }

    return '';
  };

  const submitRequest = async () => {
    if (submitting) {
      return;
    }

    const validationMessage = validateForm();

    if (validationMessage) {
      Alert.alert('Check Bus Details', validationMessage);

      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await submitDriverBusRequest({
        vehicleRegistrationNumber: form.vehicleRegistrationNumber
          .trim()
          .toUpperCase(),

        ntcPermitNumber: form.ntcPermitNumber.trim().toUpperCase(),

        depotId: form.depotId,

        serviceType: form.serviceType as DriverBusServiceType,

        routeId: form.routeId,

        make: form.make.trim(),

        model: form.model.trim(),

        manufactureYear: form.manufactureYear
          ? Number(form.manufactureYear)
          : undefined,

        seatingCapacity: form.seatingCapacity
          ? Number(form.seatingCapacity)
          : undefined,

        notes: form.notes.trim(),
      });

      setOnboarding(current =>
        current
          ? {
              ...current,
              nextStep: 'BUS_REQUEST_PENDING',
              busVerificationStatus: 'pending',
              busRequest: response.busRequest,
            }
          : current,
      );

      Alert.alert(
        'Request Submitted',
        response.requestType === 'existing_bus_claim'
          ? 'The existing bus was found. Your claim is waiting for admin approval.'
          : 'The bus was not registered previously. A new bus registration request was sent to the admin.',
      );

      await loadData(true);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Could not submit the bus request.';

      setError(message);

      Alert.alert('Request Not Submitted', message);
    } finally {
      setSubmitting(false);
    }
  };

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

  const selectorOptions = useMemo<SelectorOption[]>(() => {
    if (selector === 'serviceType') {
      return serviceTypes.map(serviceType => ({
        id: serviceType,
        title: serviceTypeLabel(serviceType),
      }));
    }

    if (selector === 'depot') {
      return availableDepots.map(depot => ({
        id: depot.id,
        title: depot.name,
        subtitle: [depot.code, depot.district].filter(Boolean).join(' · '),
      }));
    }

    if (selector === 'route') {
      return availableRoutes.map(route => ({
        id: route.id,
        title: `${route.routeNumber} · ${route.name}`,
        subtitle: `${route.origin} → ${route.destination}`,
      }));
    }

    return [];
  }, [
    availableDepots,
    availableRoutes,
    selector,
    serviceTypes,
  ]);

  const selectOption = (option: SelectorOption) => {
    if (selector === 'serviceType') {
      setForm(current => ({
        ...current,
        serviceType: option.id as DriverBusServiceType,
        depotId: '',
        routeId: '',
      }));
    }

    if (selector === 'depot') {
      setForm(current => ({
        ...current,
        depotId: option.id,
        routeId: '',
      }));
    }

    if (selector === 'route') {
      setForm(current => ({
        ...current,
        routeId: option.id,
      }));
    }

    setSelector(null);
  };

  const pending = onboarding?.nextStep === 'BUS_REQUEST_PENDING';

  const correctionRequired = onboarding?.nextStep === 'BUS_CORRECTION_REQUIRED';

  const requestRejected = onboarding?.nextStep === 'BUS_REQUEST_REJECTED';

  const showForm =
    onboarding?.nextStep === 'BUS_REGISTRATION_REQUIRED' ||
    correctionRequired ||
    requestRejected;

  if (loading && !onboarding) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        <ActivityIndicator size="large" color="#F59E0B" />

        <Text style={styles.loadingText}>Checking bus registration</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true).catch(() => undefined)}
              tintColor="#F59E0B"
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>DRIVER ONBOARDING</Text>

            <Text style={styles.title}>Register Your Bus</Text>

            <Text style={styles.subtitle}>
              Enter the bus details you operate. The system will automatically
              check whether this bus is already registered.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {pending ? (
            <View style={styles.statusCard}>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>
                  PENDING ADMIN REVIEW
                </Text>
              </View>

              <Text style={styles.statusTitle}>Bus request submitted</Text>

              <Text style={styles.statusDescription}>
                Your bus details are waiting for admin review. You will be able
                to access Driver Home after approval.
              </Text>

              {onboarding?.busRequest ? (
                <View style={styles.requestSummary}>
                  <SummaryRow
                    label="Request"
                    value={requestTypeLabel(onboarding.busRequest.requestType)}
                  />

                  <SummaryRow
                    label="Vehicle"
                    value={onboarding.busRequest.vehicleRegistrationNumber}
                  />

                  <SummaryRow
                    label="Service type"
                    value={serviceTypeLabel(onboarding.busRequest.serviceType)}
                  />

                  <SummaryRow
                    label="Depot"
                    value={onboarding.busRequest.depotName}
                  />

                  <SummaryRow
                    label="Route"
                    value={`${onboarding.busRequest.routeNumber} · ${onboarding.busRequest.routeName}`}
                  />

                  <SummaryRow
                    label="Status"
                    value={onboarding.busRequest.status.replace(/_/g, ' ')}
                  />
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => loadData(true).catch(() => undefined)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Refresh Status</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {correctionRequired ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>
                Bus details need correction
              </Text>

              <Text style={styles.warningText}>
                {onboarding?.busRequest?.correctionMessage ||
                  'Correct the requested bus details and resubmit.'}
              </Text>

              {onboarding?.busRequest?.correctionFields?.length ? (
                <Text style={styles.warningFields}>
                  Fields: {onboarding.busRequest.correctionFields.join(', ')}
                </Text>
              ) : null}
            </View>
          ) : null}

          {requestRejected ? (
            <View style={styles.rejectedBox}>
              <Text style={styles.rejectedTitle}>
                Previous request rejected
              </Text>

              <Text style={styles.rejectedText}>
                {onboarding?.busRequest?.rejectionReason ||
                  'Review your bus details before submitting a new request.'}
              </Text>
            </View>
          ) : null}

          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>Bus identity</Text>

              <Field
                label="Vehicle registration number"
                value={form.vehicleRegistrationNumber}
                placeholder="NC-1234"
                autoCapitalize="characters"
                onChangeText={value =>
                  updateField('vehicleRegistrationNumber', value)
                }
              />

              <Field
                label="NTC permit number"
                value={form.ntcPermitNumber}
                placeholder="NTC-90872"
                autoCapitalize="characters"
                onChangeText={value => updateField('ntcPermitNumber', value)}
              />

              <Text style={styles.formSectionTitle}>Service Type and depot</Text>

              <SelectionField
                label="Service Type"
                value={
                  form.serviceType
                    ? serviceTypeLabel(form.serviceType)
                    : ''
                }
                placeholder="Select service type"
                onPress={() => setSelector('serviceType')}
              />

              <SelectionField
                label="Depot"
                value={
                  selectedDepot
                    ? `${selectedDepot.name}${
                        selectedDepot.district
                          ? ` · ${selectedDepot.district}`
                          : ''
                      }`
                    : ''
                }
                placeholder={
                  form.serviceType
                    ? 'Select depot'
                    : 'Select service type first'
                }
                disabled={!form.serviceType}
                onPress={() => setSelector('depot')}
              />

              <SelectionField
                label="Route"
                value={
                  selectedRoute
                    ? `${selectedRoute.routeNumber} · ${selectedRoute.name}`
                    : ''
                }
                placeholder={
                  form.depotId ? 'Select route' : 'Select depot first'
                }
                disabled={!form.depotId}
                onPress={() => setSelector('route')}
              />

              <Text style={styles.formSectionTitle}>Vehicle information</Text>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Field
                    label="Make"
                    value={form.make}
                    placeholder="Ashok Leyland"
                    onChangeText={value => updateField('make', value)}
                  />
                </View>

                <View style={styles.half}>
                  <Field
                    label="Model"
                    value={form.model}
                    placeholder="Viking"
                    onChangeText={value => updateField('model', value)}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.half}>
                  <Field
                    label="Manufacture year"
                    value={form.manufactureYear}
                    placeholder="2018"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={value =>
                      updateField('manufactureYear', value.replace(/\D/g, ''))
                    }
                  />
                </View>

                <View style={styles.half}>
                  <Field
                    label="Seating capacity"
                    value={form.seatingCapacity}
                    placeholder="54"
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={value =>
                      updateField('seatingCapacity', value.replace(/\D/g, ''))
                    }
                  />
                </View>
              </View>

              <Field
                label="Additional notes"
                value={form.notes}
                placeholder="Optional information for the admin"
                multiline
                onChangeText={value => updateField('notes', value)}
              />

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Existing bus found: a claim request will be submitted. Bus not
                  found: a new registration request will be submitted.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  submitting && styles.buttonDisabled,
                ]}
                disabled={submitting}
                onPress={() => submitRequest().catch(() => undefined)}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {correctionRequired || requestRejected
                      ? 'Resubmit Bus Request'
                      : 'Submit Bus Request'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => handleSignOut().catch(() => undefined)}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={selector !== null}
        onRequestClose={() => setSelector(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selector === 'serviceType'
                  ? 'Select Service Type'
                  : selector === 'depot'
                    ? 'Select Depot'
                    : 'Select Route'}
              </Text>

              <TouchableOpacity onPress={() => setSelector(null)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectorOptions}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No records available.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => selectOption(item)}
                >
                  <Text style={styles.optionTitle}>{item.title}</Text>

                  {item.subtitle ? (
                    <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>

      <Text style={styles.summaryValue}>{value || '—'}</Text>
    </View>
  );
}

function SelectionField({
  label,
  value,
  placeholder,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.selectionField, disabled && styles.selectionDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={[styles.selectionText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>

        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({
  label,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  label: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        {...inputProps}
        style={[
          styles.input,
          inputProps.multiline && styles.multilineInput,
          inputProps.style,
        ]}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
  },

  content: {
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    padding: 18,
    paddingBottom: 40,
  },

  header: {
    backgroundColor: '#0F172A',
    marginHorizontal: -18,
    marginTop: -18,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 28,
    marginBottom: 18,
  },

  kicker: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
    marginTop: 6,
  },

  subtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  formSectionTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 6,
  },

  fieldGroup: {
    marginBottom: 15,
  },

  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },

  input: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 15,
    paddingHorizontal: 14,
  },

  multilineInput: {
    minHeight: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },

  selectionField: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectionDisabled: {
    opacity: 0.5,
  },

  selectionText: {
    color: '#0F172A',
    fontSize: 15,
    flex: 1,
  },

  placeholderText: {
    color: '#94A3B8',
  },

  chevron: {
    color: '#64748B',
    fontSize: 25,
    marginLeft: 10,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  half: {
    flex: 1,
  },

  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  buttonDisabled: {
    opacity: 0.55,
  },

  infoBox: {
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 13,
    marginBottom: 10,
  },

  infoText: {
    color: '#1D4ED8',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  pendingBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  pendingBadgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  statusTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 16,
  },

  statusDescription: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  requestSummary: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 18,
    paddingTop: 10,
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 14,
  },

  summaryLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },

  summaryValue: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'capitalize',
  },

  warningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 15,
    marginBottom: 14,
  },

  warningTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '900',
  },

  warningText: {
    color: '#A16207',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  warningFields: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },

  rejectedBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 15,
    marginBottom: 14,
  },

  rejectedTitle: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '900',
  },

  rejectedText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },

  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
  },

  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },

  signOutButton: {
    alignSelf: 'center',
    padding: 14,
    marginTop: 18,
  },

  signOutButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  modalTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
  },

  modalClose: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '800',
    padding: 8,
  },

  optionRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  optionTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },

  optionSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },

  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    padding: 30,
  },
});

export default BusOnboardingScreen;
