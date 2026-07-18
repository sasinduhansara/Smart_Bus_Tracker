import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  driverColors,
  driverRadii,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../../theme/tokens';

export type ConnectionStatus = 'online' | 'connecting' | 'offline' | 'error';

export interface ConnectionStatusBannerProps {
  status: ConnectionStatus;
  message?: string;
  lastUpdatedLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

const statusPresentation: Record<
  ConnectionStatus,
  {
    label: string;
    icon: string;
    backgroundColor: string;
    foregroundColor: string;
  }
> = {
  online: {
    label: 'Connected',
    icon: 'cloud-done-outline',
    backgroundColor: driverColors.successSoft,
    foregroundColor: driverColors.success,
  },
  connecting: {
    label: 'Connecting',
    icon: 'sync-outline',
    backgroundColor: driverColors.infoSoft,
    foregroundColor: driverColors.info,
  },
  offline: {
    label: 'Offline',
    icon: 'cloud-offline-outline',
    backgroundColor: driverColors.warningSoft,
    foregroundColor: driverColors.warning,
  },
  error: {
    label: 'Connection issue',
    icon: 'warning-outline',
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
};

export function ConnectionStatusBanner({
  status,
  message,
  lastUpdatedLabel,
  onRetry,
  retrying = false,
}: ConnectionStatusBannerProps) {
  const presentation = statusPresentation[status];
  const isProblem = status === 'offline' || status === 'error';

  return (
    <View
      accessibilityRole={isProblem ? 'alert' : 'summary'}
      accessibilityLiveRegion={isProblem ? 'assertive' : 'polite'}
      style={[
        styles.container,
        { backgroundColor: presentation.backgroundColor },
      ]}
    >
      <View style={styles.contentRow}>
        <Icon
          name={presentation.icon}
          size={driverSizes.iconMedium}
          color={presentation.foregroundColor}
        />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: presentation.foregroundColor }]}>
            {presentation.label}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {lastUpdatedLabel ? (
            <Text style={styles.timestamp}>{lastUpdatedLabel}</Text>
          ) : null}
        </View>
      </View>

      {onRetry && isProblem ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            retrying ? 'Retrying connection' : 'Retry connection'
          }
          accessibilityState={{ busy: retrying, disabled: retrying }}
          disabled={retrying}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            { borderColor: presentation.foregroundColor },
            pressed && styles.pressed,
            retrying && styles.disabled,
          ]}
        >
          <Text
            style={[styles.retryText, { color: presentation.foregroundColor }]}
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: driverSizes.minimumTouchTarget,
    borderRadius: driverRadii.control,
    paddingVertical: driverSpacing.sm,
    paddingHorizontal: driverSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: driverSpacing.sm,
  },
  contentRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: driverSpacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.bold,
  },
  message: {
    color: driverColors.text,
    fontSize: driverTypography.label,
    lineHeight: 18,
    marginTop: 2,
  },
  timestamp: {
    color: driverColors.textMuted,
    fontSize: driverTypography.caption,
    marginTop: 2,
  },
  retryButton: {
    minWidth: driverSizes.minimumTouchTarget,
    minHeight: driverSizes.minimumTouchTarget,
    paddingHorizontal: driverSpacing.sm,
    borderWidth: 1,
    borderRadius: driverRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.bold,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.55,
  },
});
