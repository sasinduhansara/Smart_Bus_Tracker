import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  driverColors,
  driverRadii,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../../theme/tokens';

interface BaseStateProps {
  title?: string;
  message?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export interface LoadingStateProps extends BaseStateProps {
  accessibilityLabel?: string;
}

export interface ErrorStateProps extends BaseStateProps {
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}

export interface EmptyStateProps extends BaseStateProps {
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function LoadingState({
  title = 'Loading',
  message,
  accessibilityLabel,
  compact = false,
  style,
}: LoadingStateProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel || title}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: true }}
      style={[styles.container, compact && styles.containerCompact, style]}
    >
      <ActivityIndicator
        size={compact ? 'small' : 'large'}
        color={driverColors.teal700}
      />
      <Text style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

export function ErrorState({
  title = 'Unable to load',
  message,
  actionLabel = 'Try again',
  onAction,
  busy = false,
  compact = false,
  style,
}: ErrorStateProps) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, compact && styles.containerCompact, style]}
    >
      <View style={[styles.iconWrap, styles.errorIconWrap]}>
        <Icon
          name="warning-outline"
          size={driverSizes.iconLarge}
          color={driverColors.error}
        />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onAction ? (
        <StateActionButton
          label={busy ? 'Trying again…' : actionLabel}
          onPress={onAction}
          busy={busy}
        />
      ) : null}
    </View>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  message,
  icon = 'file-tray-outline',
  actionLabel,
  onAction,
  compact = false,
  style,
}: EmptyStateProps) {
  return (
    <View
      accessibilityLabel={[title, message].filter(Boolean).join('. ')}
      style={[styles.container, compact && styles.containerCompact, style]}
    >
      <View style={styles.iconWrap}>
        <Icon
          name={icon}
          size={driverSizes.iconLarge}
          color={driverColors.teal700}
        />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <StateActionButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

interface StateActionButtonProps {
  label: string;
  onPress: () => void;
  busy?: boolean;
}

function StateActionButton({
  label,
  onPress,
  busy = false,
}: StateActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.pressed,
        busy && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={driverColors.textOnDark} />
      ) : null}
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 220,
    padding: driverSpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: driverColors.surface,
    borderRadius: driverRadii.card,
    borderWidth: 1,
    borderColor: driverColors.border,
  },
  containerCompact: {
    minHeight: 128,
    padding: driverSpacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: driverRadii.card,
    backgroundColor: driverColors.teal100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: driverSpacing.sm,
  },
  errorIconWrap: {
    backgroundColor: driverColors.errorSoft,
  },
  title: {
    color: driverColors.text,
    fontSize: driverTypography.sectionTitle,
    fontWeight: driverTypography.weights.heavy,
    textAlign: 'center',
    marginTop: driverSpacing.sm,
  },
  titleCompact: {
    fontSize: driverTypography.cardTitle,
  },
  message: {
    maxWidth: 480,
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: driverSpacing.xs,
  },
  actionButton: {
    minWidth: 128,
    minHeight: driverSizes.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: driverSpacing.xs,
    paddingHorizontal: driverSpacing.md,
    paddingVertical: driverSpacing.xs,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.teal700,
    marginTop: driverSpacing.md,
  },
  actionButtonText: {
    color: driverColors.textOnDark,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});
