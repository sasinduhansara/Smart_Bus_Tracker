import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  driverColors,
  driverRadii,
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../../theme/tokens';

export type TripLifecycleStatus =
  | 'idle'
  | 'checking_location'
  | 'checking_terminal'
  | 'outside_geofence'
  | 'permission_required'
  | 'gps_unavailable'
  | 'accuracy_low'
  | 'terminal_unavailable'
  | 'backend_unavailable'
  | 'starting'
  | 'active'
  | 'interrupted'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'ending'
  | 'completed'
  | 'error';

export interface TripControlCardProps {
  status: TripLifecycleStatus;
  tripLabel?: string;
  statusMessage?: string;
  elapsedLabel?: string;
  distanceLabel?: string;
  gpsAccuracyLabel?: string;
  warningMessage?: string;
  disabled?: boolean;
  onStart?: () => void;
  onRetryLocation?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onEnd?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
}

interface StatusPresentation {
  label: string;
  icon: string;
  backgroundColor: string;
  foregroundColor: string;
}

const statusPresentation: Record<TripLifecycleStatus, StatusPresentation> = {
  idle: {
    label: 'Ready to start',
    icon: 'radio-button-off-outline',
    backgroundColor: driverColors.surfaceMuted,
    foregroundColor: driverColors.textMuted,
  },
  checking_location: {
    label: 'Checking location',
    icon: 'locate-outline',
    backgroundColor: driverColors.infoSoft,
    foregroundColor: driverColors.info,
  },
  checking_terminal: {
    label: 'Checking terminal',
    icon: 'navigate-outline',
    backgroundColor: driverColors.infoSoft,
    foregroundColor: driverColors.info,
  },
  outside_geofence: {
    label: 'Too far from terminal',
    icon: 'location-outline',
    backgroundColor: driverColors.warningSoft,
    foregroundColor: driverColors.warning,
  },
  permission_required: {
    label: 'Location permission required',
    icon: 'lock-closed-outline',
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
  gps_unavailable: {
    label: 'GPS is disabled',
    icon: 'location-outline',
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
  accuracy_low: {
    label: 'Location accuracy low',
    icon: 'locate-outline',
    backgroundColor: driverColors.warningSoft,
    foregroundColor: driverColors.warning,
  },
  terminal_unavailable: {
    label: 'Route terminal unavailable',
    icon: 'map-outline',
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
  backend_unavailable: {
    label: 'Backend unavailable',
    icon: 'cloud-offline-outline',
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
  starting: {
    label: 'Starting trip',
    icon: 'sync-outline',
    backgroundColor: driverColors.infoSoft,
    foregroundColor: driverColors.info,
  },
  active: {
    label: 'Trip live',
    icon: 'radio-outline',
    backgroundColor: driverColors.successSoft,
    foregroundColor: driverColors.success,
  },
  interrupted: {
    label: 'Resume GPS',
    icon: 'warning-outline',
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
  pausing: {
    label: 'Pausing trip',
    icon: 'sync-outline',
    backgroundColor: driverColors.warningSoft,
    foregroundColor: driverColors.warning,
  },
  paused: {
    label: 'Trip paused',
    icon: 'pause-circle-outline',
    backgroundColor: driverColors.warningSoft,
    foregroundColor: driverColors.warning,
  },
  resuming: {
    label: 'Resuming trip',
    icon: 'sync-outline',
    backgroundColor: driverColors.infoSoft,
    foregroundColor: driverColors.info,
  },
  ending: {
    label: 'Ending trip',
    icon: 'sync-outline',
    backgroundColor: driverColors.infoSoft,
    foregroundColor: driverColors.info,
  },
  completed: {
    label: 'Trip completed',
    icon: 'checkmark-circle-outline',
    backgroundColor: driverColors.successSoft,
    foregroundColor: driverColors.success,
  },
  error: {
    label: 'Trip action failed',
    icon: 'warning-outline',
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
};

const transientStatuses: TripLifecycleStatus[] = [
  'checking_location',
  'checking_terminal',
  'starting',
  'pausing',
  'resuming',
  'ending',
];

export function TripControlCard({
  status,
  tripLabel,
  statusMessage,
  elapsedLabel,
  distanceLabel,
  gpsAccuracyLabel,
  warningMessage,
  disabled = false,
  onStart,
  onRetryLocation,
  onPause,
  onResume,
  onEnd,
  onSecondaryAction,
  secondaryActionLabel,
}: TripControlCardProps) {
  const presentation = statusPresentation[status];
  const busy = transientStatuses.includes(status);
  const actionDisabled = disabled || busy;

  const primaryAction =
    status === 'idle' || status === 'completed'
      ? onStart
        ? { label: 'Start trip', icon: 'play', callback: onStart }
        : null
      : status === 'outside_geofence' ||
        status === 'permission_required' ||
        status === 'gps_unavailable' ||
        status === 'accuracy_low'
      ? onRetryLocation
        ? { label: 'Retry location', icon: 'locate', callback: onRetryLocation }
        : null
      : status === 'terminal_unavailable' ||
        status === 'backend_unavailable' ||
        status === 'error'
      ? onRetryLocation
        ? { label: 'Retry preflight', icon: 'refresh', callback: onRetryLocation }
        : null
      : status === 'active'
      ? onPause
        ? { label: 'Pause trip', icon: 'pause', callback: onPause }
        : null
      : status === 'interrupted'
      ? onResume
        ? { label: 'Resume live tracking', icon: 'play', callback: onResume }
        : null
      : status === 'paused'
      ? onResume
        ? { label: 'Resume trip', icon: 'play', callback: onResume }
        : null
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.heading}>
            Trip control
          </Text>
          {tripLabel ? (
            <Text style={styles.tripLabel} numberOfLines={2}>
              {tripLabel}
            </Text>
          ) : null}
        </View>
        <View
          accessible
          accessibilityLabel={`Trip status: ${presentation.label}`}
          accessibilityLiveRegion="polite"
          style={[
            styles.statusBadge,
            { backgroundColor: presentation.backgroundColor },
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color={presentation.foregroundColor}
            />
          ) : (
            <Icon
              name={presentation.icon}
              size={driverSizes.iconSmall}
              color={presentation.foregroundColor}
            />
          )}
          <Text
            style={[
              styles.statusBadgeText,
              { color: presentation.foregroundColor },
            ]}
          >
            {presentation.label}
          </Text>
        </View>
      </View>

      {statusMessage ? (
        <Text style={styles.statusMessage}>{statusMessage}</Text>
      ) : null}

      {elapsedLabel || distanceLabel || gpsAccuracyLabel ? (
        <View style={styles.metricsRow}>
          {elapsedLabel ? (
            <TripMetric
              icon="time-outline"
              label="Elapsed"
              value={elapsedLabel}
            />
          ) : null}
          {distanceLabel ? (
            <TripMetric
              icon="speedometer-outline"
              label="Distance"
              value={distanceLabel}
            />
          ) : null}
          {gpsAccuracyLabel ? (
            <TripMetric
              icon="locate-outline"
              label="GPS"
              value={gpsAccuracyLabel}
            />
          ) : null}
        </View>
      ) : null}

      {warningMessage ? (
        <View accessibilityRole="alert" style={styles.warningRow}>
          <Icon
            name="warning-outline"
            size={driverSizes.iconSmall}
            color={driverColors.warning}
          />
          <Text style={styles.warningText}>{warningMessage}</Text>
        </View>
      ) : null}

      {primaryAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primaryAction.label}
          accessibilityState={{ busy, disabled: actionDisabled }}
          disabled={actionDisabled}
          onPress={primaryAction.callback}
          style={({ pressed }) => [
            styles.primaryButton,
            status === 'active' ? styles.pauseButton : styles.startButton,
            pressed && styles.pressed,
            actionDisabled && styles.disabled,
          ]}
        >
          <Icon
            name={primaryAction.icon}
            size={driverSizes.iconMedium}
            color={
              status === 'active'
                ? driverColors.textOnDark
                : driverColors.navy950
            }
          />
          <Text
            style={[
              styles.primaryButtonText,
              status === 'active' && styles.primaryButtonTextOnDark,
            ]}
          >
            {primaryAction.label}
          </Text>
        </Pressable>
      ) : busy ? (
        <View
          accessible
          accessibilityLabel={presentation.label}
          accessibilityState={{ busy: true, disabled: true }}
          style={[styles.primaryButton, styles.busyButton]}
        >
          <ActivityIndicator color={driverColors.textOnDark} />
          <Text style={styles.primaryButtonTextOnDark}>
            {presentation.label}…
          </Text>
        </View>
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondaryActionLabel}
          disabled={actionDisabled}
          onPress={onSecondaryAction}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
            actionDisabled && styles.disabled,
          ]}
        >
          <Icon
            name="settings-outline"
            size={driverSizes.iconMedium}
            color={driverColors.teal700}
          />
          <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
        </Pressable>
      ) : null}

      {(status === 'active' ||
        status === 'interrupted' ||
        status === 'paused') &&
      onEnd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End trip"
          accessibilityHint="Ends live tracking for this trip"
          accessibilityState={{ disabled: actionDisabled }}
          disabled={actionDisabled}
          onPress={onEnd}
          style={({ pressed }) => [
            styles.endButton,
            pressed && styles.pressed,
            actionDisabled && styles.disabled,
          ]}
        >
          <Icon
            name="stop-circle-outline"
            size={driverSizes.iconMedium}
            color={driverColors.error}
          />
          <Text style={styles.endButtonText}>End trip</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface TripMetricProps {
  icon: string;
  label: string;
  value: string;
}

function TripMetric({ icon, label, value }: TripMetricProps) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.metricItem}>
      <Icon
        name={icon}
        size={driverSizes.iconSmall}
        color={driverColors.teal700}
      />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minWidth: 0,
    backgroundColor: driverColors.surface,
    borderRadius: driverRadii.feature,
    borderWidth: 1,
    borderColor: driverColors.border,
    padding: driverSpacing.lg,
    ...driverShadows.raised,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: driverSpacing.sm,
  },
  headingCopy: {
    flex: 1,
    minWidth: 150,
  },
  heading: {
    color: driverColors.text,
    fontSize: driverTypography.sectionTitle,
    fontWeight: driverTypography.weights.heavy,
  },
  tripLabel: {
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    lineHeight: 20,
    marginTop: driverSpacing.xxs,
  },
  statusBadge: {
    minHeight: 32,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.xxs,
    borderRadius: driverRadii.pill,
    paddingHorizontal: driverSpacing.sm,
    paddingVertical: driverSpacing.xs,
  },
  statusBadgeText: {
    flexShrink: 1,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.bold,
  },
  statusMessage: {
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    lineHeight: 21,
    marginTop: driverSpacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: driverSpacing.xs,
    marginTop: driverSpacing.md,
  },
  metricItem: {
    flexGrow: 1,
    flexBasis: 92,
    minWidth: 0,
    padding: driverSpacing.sm,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.background,
    alignItems: 'flex-start',
    gap: 2,
  },
  metricLabel: {
    color: driverColors.textMuted,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.medium,
  },
  metricValue: {
    maxWidth: '100%',
    color: driverColors.text,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: driverSpacing.xs,
    padding: driverSpacing.sm,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.warningSoft,
    marginTop: driverSpacing.md,
  },
  warningText: {
    flex: 1,
    color: driverColors.warning,
    fontSize: driverTypography.label,
    lineHeight: 18,
    fontWeight: driverTypography.weights.medium,
  },
  primaryButton: {
    width: '100%',
    minHeight: driverSizes.primaryControlHeight,
    borderRadius: driverRadii.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: driverSpacing.xs,
    marginTop: driverSpacing.lg,
    paddingHorizontal: driverSpacing.md,
  },
  startButton: {
    backgroundColor: driverColors.amber500,
  },
  pauseButton: {
    backgroundColor: driverColors.teal700,
  },
  busyButton: {
    backgroundColor: driverColors.navy700,
  },
  primaryButtonText: {
    color: driverColors.navy950,
    fontSize: driverTypography.bodyLarge,
    fontWeight: driverTypography.weights.heavy,
  },
  primaryButtonTextOnDark: {
    color: driverColors.textOnDark,
    fontSize: driverTypography.bodyLarge,
    fontWeight: driverTypography.weights.heavy,
  },
  endButton: {
    width: '100%',
    minHeight: driverSizes.minimumTouchTarget,
    borderRadius: driverRadii.control,
    borderWidth: 1,
    borderColor: driverColors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: driverSpacing.xs,
    paddingHorizontal: driverSpacing.md,
    marginTop: driverSpacing.sm,
  },
  endButtonText: {
    color: driverColors.error,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
  },
  secondaryButton: {
    minHeight: 48,
    marginTop: driverSpacing.sm,
    borderRadius: driverRadii.control,
    borderWidth: 1,
    borderColor: driverColors.teal700,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: driverSpacing.sm,
    paddingHorizontal: driverSpacing.md,
  },
  secondaryButtonText: {
    color: driverColors.teal700,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.995 }],
  },
  disabled: {
    opacity: 0.48,
  },
});
