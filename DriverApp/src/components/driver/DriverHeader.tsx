import React from 'react';
import {
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

export type DriverHeaderStatusTone =
  | 'neutral'
  | 'ready'
  | 'attention'
  | 'danger';

export interface DriverHeaderProps {
  title: string;
  subtitle?: string;
  driverName?: string;
  statusLabel?: string;
  statusTone?: DriverHeaderStatusTone;
  notificationCount?: number;
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  menuAccessibilityLabel?: string;
  menuIconName?: string;
  style?: StyleProp<ViewStyle>;
}

const statusToneStyles: Record<
  DriverHeaderStatusTone,
  { backgroundColor: string; dotColor: string; textColor: string }
> = {
  neutral: {
    backgroundColor: driverColors.navy700,
    dotColor: driverColors.border,
    textColor: driverColors.textOnDark,
  },
  ready: {
    backgroundColor: driverColors.teal700,
    dotColor: driverColors.teal100,
    textColor: driverColors.textOnDark,
  },
  attention: {
    backgroundColor: driverColors.amber500,
    dotColor: driverColors.navy950,
    textColor: driverColors.navy950,
  },
  danger: {
    backgroundColor: driverColors.error,
    dotColor: driverColors.textOnDark,
    textColor: driverColors.textOnDark,
  },
};

const formatNotificationLabel = (count?: number) => {
  if (!count || count < 1) return 'Notifications';
  return `${count} unread notification${count === 1 ? '' : 's'}`;
};

export function DriverHeader({
  title,
  subtitle,
  driverName,
  statusLabel,
  statusTone = 'neutral',
  notificationCount,
  onMenuPress,
  onNotificationsPress,
  menuAccessibilityLabel = 'Open driver menu',
  menuIconName = 'menu-outline',
  style,
}: DriverHeaderProps) {
  const tone = statusToneStyles[statusTone];
  const visibleNotificationCount = Math.max(0, notificationCount ?? 0);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        {onMenuPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuAccessibilityLabel}
            hitSlop={8}
            onPress={onMenuPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={menuIconName}
              size={driverSizes.iconMedium}
              color={driverColors.textOnDark}
            />
          </Pressable>
        ) : (
          <View style={styles.iconButtonPlaceholder} />
        )}

        <View style={styles.titleBlock}>
          {driverName ? (
            <Text style={styles.eyebrow} numberOfLines={1}>
              {driverName}
            </Text>
          ) : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {onNotificationsPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={formatNotificationLabel(notificationCount)}
            accessibilityHint="Opens driver notifications"
            hitSlop={8}
            onPress={onNotificationsPress}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="notifications-outline"
              size={driverSizes.iconMedium}
              color={driverColors.textOnDark}
            />
            {visibleNotificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>
                  {visibleNotificationCount > 99
                    ? '99+'
                    : visibleNotificationCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <View style={styles.iconButtonPlaceholder} />
        )}
      </View>

      {statusLabel ? (
        <View
          accessible
          accessibilityLabel={`Driver status: ${statusLabel}`}
          style={[styles.statusPill, { backgroundColor: tone.backgroundColor }]}
        >
          <View
            style={[styles.statusDot, { backgroundColor: tone.dotColor }]}
          />
          <Text style={[styles.statusText, { color: tone.textColor }]}>
            {statusLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: driverColors.navy900,
    paddingHorizontal: driverSpacing.md,
    paddingTop: driverSpacing.sm,
    paddingBottom: driverSpacing.lg,
    borderBottomLeftRadius: driverRadii.feature,
    borderBottomRightRadius: driverRadii.feature,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: driverSpacing.sm,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingTop: driverSpacing.xxs,
  },
  eyebrow: {
    color: driverColors.teal100,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.semibold,
    letterSpacing: 0.3,
  },
  title: {
    color: driverColors.textOnDark,
    fontSize: driverTypography.sectionTitle,
    fontWeight: driverTypography.weights.heavy,
    textAlign: 'center',
  },
  subtitle: {
    color: driverColors.border,
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.medium,
    marginTop: driverSpacing.xxs,
    textAlign: 'center',
  },
  iconButton: {
    width: driverSizes.compactTouchTarget,
    height: driverSizes.compactTouchTarget,
    borderRadius: driverRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: driverColors.navy800,
  },
  iconButtonPlaceholder: {
    width: driverSizes.compactTouchTarget,
    height: driverSizes.compactTouchTarget,
  },
  pressed: {
    opacity: 0.74,
  },
  notificationBadge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: driverRadii.pill,
    backgroundColor: driverColors.amber500,
    borderWidth: 2,
    borderColor: driverColors.navy800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    color: driverColors.navy950,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: driverTypography.weights.heavy,
  },
  statusPill: {
    minHeight: driverSizes.minimumTouchTarget,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: driverSpacing.xs,
    paddingHorizontal: driverSpacing.md,
    paddingVertical: driverSpacing.xs,
    borderRadius: driverRadii.pill,
    marginTop: driverSpacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    flexShrink: 1,
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
