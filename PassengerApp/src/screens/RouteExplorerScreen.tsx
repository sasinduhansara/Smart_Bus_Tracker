import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import RouteResultCard from '../components/journey/RouteResultCard';
import ServiceFilterChips from '../components/journey/ServiceFilterChips';
import StopSearchField from '../components/journey/StopSearchField';
import TimetableServiceCard from '../components/journey/TimetableServiceCard';
import SymbolIcon from '../components/common/SymbolIcon';
import type {
  PassengerNavigate,
  RouteDirectoryMode,
} from '../navigation/types';
import {
  getPassengerTimetable,
  searchPassengerRoutes,
  searchPassengerStops,
} from '../services/api';
import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../theme/tokens';
import type {
  PassengerPublicStop,
  PassengerRouteSearchItem,
  PassengerServiceFilter,
  PassengerServiceType,
  PassengerTimetableResponse,
  PassengerTimetableService,
} from '../types';

interface RouteExplorerScreenProps {
  mode?: RouteDirectoryMode;
  navigate: PassengerNavigate;
}

type JourneyStep = 'planner' | 'routes' | 'timetable';
type StopField = 'from' | 'to';

interface DateOption {
  value: string;
  label: string;
  sublabel: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildDateOptions(): DateOption[] {
  const today = new Date();

  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
    );

    return {
      value: toIsoDate(date),
      label:
        offset === 0
          ? 'Today'
          : offset === 1
          ? 'Tomorrow'
          : DAY_NAMES[date.getDay()],
      sublabel: `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`,
    };
  });
}

function longDateLabel(value: string): string {
  const parts = value.split('-').map(Number);

  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
    return value;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${
    MONTH_NAMES[date.getMonth()]
  } ${date.getFullYear()}`;
}

function serviceTypesForFilter(
  filter: PassengerServiceFilter,
): PassengerServiceType[] {
  return filter === 'all' ? [] : [filter];
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function RouteExplorerScreen({
  mode = 'search',
  navigate,
}: RouteExplorerScreenProps): React.JSX.Element {
  const dateOptions = useMemo(buildDateOptions, []);
  const stopSearchSequence = useRef(0);
  const routeSearchSequence = useRef(0);
  const timetableSequence = useRef(0);

  const [step, setStep] = useState<JourneyStep>('planner');
  const [activeField, setActiveField] = useState<StopField | null>(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromStop, setFromStop] = useState<PassengerPublicStop | null>(null);
  const [toStop, setToStop] = useState<PassengerPublicStop | null>(null);
  const [stopSuggestions, setStopSuggestions] = useState<
    PassengerPublicStop[]
  >([]);
  const [stopSearchLoading, setStopSearchLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [serviceFilter, setServiceFilter] =
    useState<PassengerServiceFilter>('all');
  const [routes, setRoutes] = useState<PassengerRouteSearchItem[]>([]);
  const [selectedRoute, setSelectedRoute] =
    useState<PassengerRouteSearchItem | null>(null);
  const [timetable, setTimetable] =
    useState<PassengerTimetableResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQuery =
    activeField === 'from' ? fromText : activeField === 'to' ? toText : '';
  const activeSelectedStop =
    activeField === 'from' ? fromStop : activeField === 'to' ? toStop : null;

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (step === 'planner') {
          return false;
        }

        setError(null);
        setStep(currentStep =>
          currentStep === 'timetable' ? 'routes' : 'planner',
        );
        return true;
      },
    );

    return () => subscription.remove();
  }, [step]);

  useEffect(() => {
    if (
      !activeField ||
      activeQuery.trim().length < 2 ||
      (activeSelectedStop && activeSelectedStop.name === activeQuery.trim())
    ) {
      stopSearchSequence.current += 1;
      setStopSuggestions([]);
      setStopSearchLoading(false);
      return;
    }

    const sequence = ++stopSearchSequence.current;
    const controller = new AbortController();
    setStopSuggestions([]);
    setStopSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const response = await searchPassengerStops(
          activeQuery,
          10,
          controller.signal,
        );

        if (sequence === stopSearchSequence.current) {
          setStopSuggestions(response.stops);
        }
      } catch (searchError) {
        if (!controller.signal.aborted && sequence === stopSearchSequence.current) {
          setStopSuggestions([]);
          setError(
            errorMessage(
              searchError,
              'Stop search is temporarily unavailable.',
            ),
          );
        }
      } finally {
        if (sequence === stopSearchSequence.current) {
          setStopSearchLoading(false);
        }
      }
    }, 260);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeField, activeQuery, activeSelectedStop]);

  const handleStopTextChange = (field: StopField, value: string) => {
    setActiveField(field);
    setStopSuggestions([]);
    setError(null);

    if (field === 'from') {
      setFromText(value);
      if (fromStop && value !== fromStop.name) {
        setFromStop(null);
      }
    } else {
      setToText(value);
      if (toStop && value !== toStop.name) {
        setToStop(null);
      }
    }
  };

  const handleClearStop = (field: StopField) => {
    setActiveField(field);
    setStopSuggestions([]);
    setError(null);

    if (field === 'from') {
      setFromText('');
      setFromStop(null);
    } else {
      setToText('');
      setToStop(null);
    }
  };

  const handleSelectStop = (field: StopField, stop: PassengerPublicStop) => {
    const otherStop = field === 'from' ? toStop : fromStop;

    if (otherStop?.id === stop.id) {
      setError('Start and destination stops must be different.');
      return;
    }

    if (field === 'from') {
      setFromStop(stop);
      setFromText(stop.name);
    } else {
      setToStop(stop);
      setToText(stop.name);
    }

    setActiveField(null);
    setStopSuggestions([]);
    setError(null);
  };

  const handleSwapStops = () => {
    setFromStop(toStop);
    setToStop(fromStop);
    setFromText(toText);
    setToText(fromText);
    setActiveField(null);
    setStopSuggestions([]);
    setError(null);
  };

  const loadRoutes = async (
    nextFilter = serviceFilter,
    nextDate = selectedDate,
  ) => {
    if (!fromStop || !toStop) {
      setError('Select both a start stop and a destination stop.');
      return;
    }

    if (fromStop.id === toStop.id) {
      setError('Start and destination stops must be different.');
      return;
    }

    const sequence = ++routeSearchSequence.current;
    setStep('routes');
    setRouteLoading(true);
    setRoutes([]);
    setSelectedRoute(null);
    setTimetable(null);
    setError(null);

    try {
      const response = await searchPassengerRoutes({
        fromStopId: fromStop.id,
        toStopId: toStop.id,
        date: nextDate,
        serviceTypes: serviceTypesForFilter(nextFilter),
      });

      if (sequence === routeSearchSequence.current) {
        setRoutes(response.routes);
      }
    } catch (routeError) {
      if (sequence === routeSearchSequence.current) {
        setError(
          errorMessage(
            routeError,
            'Routes for this journey are temporarily unavailable.',
          ),
        );
      }
    } finally {
      if (sequence === routeSearchSequence.current) {
        setRouteLoading(false);
      }
    }
  };

  const loadTimetable = async (
    route: PassengerRouteSearchItem,
    nextFilter = serviceFilter,
    nextDate = selectedDate,
  ) => {
    if (!fromStop || !toStop) {
      setStep('planner');
      setError('Select your journey again.');
      return;
    }

    const sequence = ++timetableSequence.current;
    setSelectedRoute(route);
    setStep('timetable');
    setTimetableLoading(true);
    setTimetable(null);
    setError(null);

    try {
      const response = await getPassengerTimetable({
        routeId: route.id || route.routeNumber,
        fromStopId: fromStop.id,
        toStopId: toStop.id,
        date: nextDate,
        serviceTypes: serviceTypesForFilter(nextFilter),
      });

      if (sequence === timetableSequence.current) {
        setTimetable(response);
      }
    } catch (timetableError) {
      if (sequence === timetableSequence.current) {
        setError(
          errorMessage(
            timetableError,
            'The timetable is temporarily unavailable.',
          ),
        );
      }
    } finally {
      if (sequence === timetableSequence.current) {
        setTimetableLoading(false);
      }
    }
  };

  const handleFilterChange = (nextFilter: PassengerServiceFilter) => {
    if (nextFilter === serviceFilter) {
      return;
    }

    setServiceFilter(nextFilter);

    if (step === 'routes') {
      loadRoutes(nextFilter, selectedDate);
    } else if (step === 'timetable' && selectedRoute) {
      loadTimetable(selectedRoute, nextFilter, selectedDate);
    }
  };

  const handleDateChange = (nextDate: string) => {
    if (nextDate === selectedDate) {
      return;
    }

    setSelectedDate(nextDate);

    if (step === 'routes') {
      loadRoutes(serviceFilter, nextDate);
    } else if (step === 'timetable' && selectedRoute) {
      loadTimetable(selectedRoute, serviceFilter, nextDate);
    }
  };

  const handleBack = () => {
    setError(null);

    if (step === 'timetable') {
      setStep('routes');
      return;
    }

    setStep('planner');
  };

  const handleViewLive = (service: PassengerTimetableService) => {
    const destinationStop = timetable?.selectedToStop || toStop;

    navigate({
      tab: 'map',
      busId: service.busRegistration || undefined,
      routeNumber: service.routeNumber,
      stopId:
        destinationStop?.routeStopId || destinationStop?.id || undefined,
    });
  };

  const renderDateSelector = () => (
    <View style={styles.dateSection}>
      <View style={styles.sectionLabelRow}>
        <SymbolIcon
          name="calendar"
          size={17}
          color={passengerColors.primary}
        />
        <Text style={styles.sectionLabel}>Travel date</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateOptions}
      >
        {dateOptions.map(option => {
          const selected = selectedDate === option.value;

          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.dateChip, selected && styles.dateChipSelected]}
              onPress={() => handleDateChange(option.value)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}, ${option.sublabel}`}
            >
              <Text
                style={[
                  styles.dateChipLabel,
                  selected && styles.dateChipLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.dateChipSublabel,
                  selected && styles.dateChipSublabelSelected,
                ]}
              >
                {option.sublabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderFilter = () => (
    <View style={styles.filterSection}>
      <Text style={styles.sectionLabel}>Bus type</Text>
      <ServiceFilterChips
        value={serviceFilter}
        disabled={routeLoading || timetableLoading}
        onChange={handleFilterChange}
      />
      <Text style={styles.filterHint}>
        AC services are provided by the Intercity timetable category.
      </Text>
    </View>
  );

  const renderError = () =>
    error ? (
      <View style={styles.errorBanner} accessibilityRole="alert">
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.dismissError}
          onPress={() => setError(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss error"
        >
          <SymbolIcon
            name="close"
            size={17}
            color={passengerColors.error}
          />
        </TouchableOpacity>
      </View>
    ) : null;

  const renderJourneySummary = () => (
    <View style={styles.journeySummary}>
      <View style={styles.summaryStopRow}>
        <View style={styles.startDot} />
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryLabel}>FROM</Text>
          <Text style={styles.summaryStop} numberOfLines={1}>
            {fromStop?.name || 'Start stop'}
          </Text>
        </View>
      </View>
      <View style={styles.summaryConnector} />
      <View style={styles.summaryStopRow}>
        <SymbolIcon
          name="location"
          size={18}
          color={passengerColors.secondary}
        />
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryLabel}>TO</Text>
          <Text style={styles.summaryStop} numberOfLines={1}>
            {toStop?.name || 'Destination stop'}
          </Text>
        </View>
      </View>
      <View style={styles.summaryFooter}>
        <Text style={styles.summaryDate}>{longDateLabel(selectedDate)}</Text>
        <TouchableOpacity
          onPress={() => setStep('planner')}
          accessibilityRole="button"
          accessibilityLabel="Edit journey"
        >
          <Text style={styles.editJourney}>Edit journey</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPlanner = () => (
    <>
      <View style={styles.pageHeader}>
        <Text style={styles.eyebrow}>
          {mode === 'timetables' ? 'FUTURE BUS TIMES' : 'PLAN YOUR JOURNEY'}
        </Text>
        <Text style={styles.pageTitle}>
          {mode === 'timetables' ? 'Find a timetable' : 'Where are you going?'}
        </Text>
        <Text style={styles.pageSubtitle}>
          Select your boarding stop and destination to see matching routes and
          scheduled buses.
        </Text>
      </View>

      <View style={styles.plannerCard}>
        <StopSearchField
          label="Start stop"
          placeholder="Search your boarding stop"
          value={fromText}
          selectedStop={fromStop}
          suggestions={activeField === 'from' ? stopSuggestions : []}
          active={activeField === 'from'}
          loading={activeField === 'from' && stopSearchLoading}
          onFocus={() => setActiveField('from')}
          onChangeText={value => handleStopTextChange('from', value)}
          onClear={() => handleClearStop('from')}
          onSelect={stop => handleSelectStop('from', stop)}
        />

        <TouchableOpacity
          style={styles.swapButton}
          onPress={handleSwapStops}
          disabled={!fromText && !toText}
          accessibilityRole="button"
          accessibilityLabel="Swap start and destination stops"
        >
          <Text style={styles.swapSymbol}>⇅</Text>
          <Text style={styles.swapText}>Swap</Text>
        </TouchableOpacity>

        <StopSearchField
          label="Destination stop"
          placeholder="Search your destination"
          value={toText}
          selectedStop={toStop}
          suggestions={activeField === 'to' ? stopSuggestions : []}
          active={activeField === 'to'}
          loading={activeField === 'to' && stopSearchLoading}
          onFocus={() => setActiveField('to')}
          onChangeText={value => handleStopTextChange('to', value)}
          onClear={() => handleClearStop('to')}
          onSelect={stop => handleSelectStop('to', stop)}
        />

        {renderDateSelector()}
        {renderFilter()}
        {renderError()}

        <TouchableOpacity
          style={[
            styles.searchButton,
            (!fromStop || !toStop || routeLoading) &&
              styles.searchButtonDisabled,
          ]}
          onPress={() => loadRoutes()}
          disabled={!fromStop || !toStop || routeLoading}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityState={{
            disabled: !fromStop || !toStop || routeLoading,
          }}
          accessibilityLabel="Find matching buses"
        >
          {routeLoading ? (
            <ActivityIndicator size="small" color={passengerColors.white} />
          ) : (
            <SymbolIcon
              name="search"
              size={20}
              color={passengerColors.white}
            />
          )}
          <Text style={styles.searchButtonText}>Find buses</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <SymbolIcon
          name="route"
          size={22}
          color={passengerColors.secondary}
        />
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Scheduled first, live when started</Text>
          <Text style={styles.infoText}>
            Future buses remain visible before departure. Live tracking becomes
            available after the assigned driver starts the trip.
          </Text>
        </View>
      </View>
    </>
  );

  const renderRoutes = () => (
    <>
      <View style={styles.backHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to journey planner"
        >
          <Text style={styles.backSymbol}>‹</Text>
        </TouchableOpacity>
        <View style={styles.backHeaderCopy}>
          <Text style={styles.backEyebrow}>MATCHING ROUTES</Text>
          <Text style={styles.backTitle}>Choose a route</Text>
        </View>
      </View>

      {renderJourneySummary()}
      {renderDateSelector()}
      {renderFilter()}
      {renderError()}

      <View style={styles.resultsHeading}>
        <Text style={styles.resultsTitle}>Available routes</Text>
        <Text style={styles.resultsCount}>
          {routes.length} {routes.length === 1 ? 'route' : 'routes'}
        </Text>
      </View>

      {routeLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={passengerColors.primary} />
          <Text style={styles.loadingTitle}>Finding matching routes</Text>
          <Text style={styles.loadingText}>
            Checking stop order and published services.
          </Text>
        </View>
      ) : routes.length > 0 ? (
        routes.map(route => (
          <RouteResultCard
            key={`${route.id}:${route.direction}`}
            route={route}
            onPress={() => loadTimetable(route)}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <SymbolIcon
            name="route"
            size={29}
            color={passengerColors.textSubtle}
          />
          <Text style={styles.emptyTitle}>No matching route found</Text>
          <Text style={styles.emptyText}>
            No active route contains these stops in the selected travel
            direction and bus category.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setStep('planner')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Change journey</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderTimetable = () => (
    <>
      <View style={styles.backHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back to route results"
        >
          <Text style={styles.backSymbol}>‹</Text>
        </TouchableOpacity>
        <View style={styles.backHeaderCopy}>
          <Text style={styles.backEyebrow}>BUS TIMETABLE</Text>
          <Text style={styles.backTitle}>Route {selectedRoute?.routeNumber}</Text>
        </View>
      </View>

      <View style={styles.routeHero}>
        <View style={styles.heroRouteBadge}>
          <Text style={styles.heroRouteLabel}>ROUTE</Text>
          <Text style={styles.heroRouteNumber}>
            {selectedRoute?.routeNumber}
          </Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {selectedRoute?.name}
          </Text>
          <Text style={styles.heroMeta}>
            {selectedRoute?.direction} · {longDateLabel(selectedDate)}
          </Text>
        </View>
      </View>

      {renderJourneySummary()}
      {renderDateSelector()}
      {renderFilter()}
      {renderError()}

      <View style={styles.resultsHeading}>
        <Text style={styles.resultsTitle}>Scheduled buses</Text>
        <Text style={styles.resultsCount}>
          {timetable?.meta.count || 0} services
        </Text>
      </View>

      {timetableLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={passengerColors.primary} />
          <Text style={styles.loadingTitle}>Loading timetable</Text>
          <Text style={styles.loadingText}>
            Calculating departure and destination arrival times.
          </Text>
        </View>
      ) : timetable && timetable.services.length > 0 ? (
        timetable.services.map(service => (
          <TimetableServiceCard
            key={service.serviceId}
            service={service}
            onViewLive={() => handleViewLive(service)}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <SymbolIcon
            name="calendar"
            size={29}
            color={passengerColors.textSubtle}
          />
          <Text style={styles.emptyTitle}>No buses published</Text>
          <Text style={styles.emptyText}>
            This route has no non-cancelled services for the selected date and
            bus category.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={
              serviceFilter === 'all'
                ? () => setStep('routes')
                : () => handleFilterChange('all')
            }
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>
              {serviceFilter === 'all'
                ? 'Choose another route'
                : 'Show all bus types'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={passengerColors.background}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {step === 'planner'
          ? renderPlanner()
          : step === 'routes'
          ? renderRoutes()
          : renderTimetable()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: passengerColors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: passengerSpacing.lg,
    paddingBottom: passengerSpacing.xxl,
  },
  pageHeader: {
    paddingTop: passengerSpacing.lg,
  },
  eyebrow: {
    color: passengerColors.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  pageTitle: {
    color: passengerColors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
    marginTop: passengerSpacing.xxs,
  },
  pageSubtitle: {
    color: passengerColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: passengerSpacing.xs,
    maxWidth: 380,
  },
  plannerCard: {
    borderRadius: passengerRadii.feature,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.md,
    marginTop: passengerSpacing.lg,
    ...passengerShadows.card,
  },
  swapButton: {
    alignSelf: 'center',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.pill,
    backgroundColor: passengerColors.primarySoft,
    paddingHorizontal: passengerSpacing.sm,
    marginTop: passengerSpacing.sm,
    marginBottom: -passengerSpacing.xxs,
  },
  swapSymbol: {
    color: passengerColors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  swapText: {
    color: passengerColors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: passengerSpacing.xxs,
  },
  dateSection: {
    marginTop: passengerSpacing.lg,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabel: {
    color: passengerColors.text,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: passengerSpacing.xxs,
  },
  dateOptions: {
    gap: passengerSpacing.xs,
    paddingTop: passengerSpacing.xs,
    paddingBottom: passengerSpacing.xxs,
  },
  dateChip: {
    minWidth: 78,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.control,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
    paddingHorizontal: passengerSpacing.sm,
  },
  dateChipSelected: {
    borderColor: passengerColors.primary,
    backgroundColor: passengerColors.primary,
  },
  dateChipLabel: {
    color: passengerColors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  dateChipLabelSelected: {
    color: passengerColors.white,
  },
  dateChipSublabel: {
    color: passengerColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  dateChipSublabelSelected: {
    color: '#D3E4DD',
  },
  filterSection: {
    marginTop: passengerSpacing.lg,
  },
  filterHint: {
    color: passengerColors.textSubtle,
    fontSize: 10,
    lineHeight: 15,
    marginTop: passengerSpacing.xxs,
  },
  errorBanner: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.control,
    borderWidth: 1,
    borderColor: '#E5B9B9',
    backgroundColor: '#F9E8E8',
    paddingLeft: passengerSpacing.sm,
    marginTop: passengerSpacing.md,
  },
  errorText: {
    flex: 1,
    color: passengerColors.error,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  dismissError: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.control,
    backgroundColor: passengerColors.primary,
    marginTop: passengerSpacing.lg,
  },
  searchButtonDisabled: {
    opacity: 0.45,
  },
  searchButtonText: {
    color: passengerColors.white,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: passengerSpacing.xs,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: passengerRadii.card,
    backgroundColor: passengerColors.secondarySoft,
    padding: passengerSpacing.md,
    marginTop: passengerSpacing.lg,
  },
  infoCopy: {
    flex: 1,
    marginLeft: passengerSpacing.sm,
  },
  infoTitle: {
    color: passengerColors.secondaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  infoText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: passengerSpacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: passengerColors.surfaceRaised,
    borderWidth: 1,
    borderColor: passengerColors.border,
  },
  backSymbol: {
    color: passengerColors.primaryDark,
    fontSize: 34,
    lineHeight: 35,
    fontWeight: '500',
    marginTop: -2,
  },
  backHeaderCopy: {
    flex: 1,
    marginLeft: passengerSpacing.sm,
  },
  backEyebrow: {
    color: passengerColors.secondary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  backTitle: {
    color: passengerColors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  journeySummary: {
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.md,
    marginTop: passengerSpacing.lg,
  },
  summaryStopRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: passengerColors.primary,
    marginHorizontal: 3,
  },
  summaryConnector: {
    width: 2,
    height: 16,
    backgroundColor: passengerColors.border,
    marginLeft: 8,
    marginVertical: -4,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: passengerSpacing.sm,
  },
  summaryLabel: {
    color: passengerColors.textSubtle,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  summaryStop: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: passengerColors.border,
    paddingTop: passengerSpacing.sm,
    marginTop: passengerSpacing.sm,
  },
  summaryDate: {
    color: passengerColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  editJourney: {
    color: passengerColors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  resultsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: passengerSpacing.xl,
    marginBottom: passengerSpacing.sm,
  },
  resultsTitle: {
    color: passengerColors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  resultsCount: {
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  loadingState: {
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.card,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.lg,
  },
  loadingTitle: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: passengerSpacing.sm,
  },
  loadingText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: passengerSpacing.xxs,
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: passengerColors.border,
    padding: passengerSpacing.lg,
  },
  emptyTitle: {
    color: passengerColors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: passengerSpacing.sm,
  },
  emptyText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: passengerSpacing.xxs,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.pill,
    backgroundColor: passengerColors.primarySoft,
    paddingHorizontal: passengerSpacing.lg,
    marginTop: passengerSpacing.md,
  },
  secondaryButtonText: {
    color: passengerColors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  routeHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.feature,
    backgroundColor: passengerColors.primaryDark,
    padding: passengerSpacing.md,
    marginTop: passengerSpacing.lg,
  },
  heroRouteBadge: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  heroRouteLabel: {
    color: '#CDE1D8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  heroRouteNumber: {
    color: passengerColors.white,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: passengerSpacing.md,
  },
  heroTitle: {
    color: passengerColors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  heroMeta: {
    color: '#C8D9D2',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'capitalize',
  },
});

export default RouteExplorerScreen;
