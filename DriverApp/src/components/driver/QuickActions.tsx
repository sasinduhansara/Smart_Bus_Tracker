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

export type QuickActionTone = 'neutral' | 'primary' | 'attention' | 'danger';

export interface QuickActionItem {
  key: string;
  label: string;
  icon: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  badge?: string | number;
  tone?: QuickActionTone;
}

export interface QuickActionsProps {
  actions: QuickActionItem[];
  title?: string;
}

const toneStyles: Record<
  QuickActionTone,
  { iconBackground: string; iconColor: string; borderColor: string }
> = {
  neutral: {
    iconBackground: driverColors.surfaceMuted,
    iconColor: driverColors.navy700,
    borderColor: driverColors.border,
  },
  primary: {
    iconBackground: driverColors.teal100,
    iconColor: driverColors.teal700,
    borderColor: driverColors.teal600,
  },
  attention: {
    iconBackground: driverColors.warningSoft,
    iconColor: driverColors.warning,
    borderColor: driverColors.amber500,
  },
  danger: {
    iconBackground: driverColors.errorSoft,
    iconColor: driverColors.error,
    borderColor: driverColors.error,
  },
};

export function QuickActions({
  actions,
  title = 'Quick actions',
}: QuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <View style={styles.grid}>
        {actions.map(action => {
          const tone = toneStyles[action.tone ?? 'neutral'];

          return (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel || action.label}
              accessibilityState={{ disabled: action.disabled }}
              disabled={action.disabled}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.action,
                { borderColor: tone.borderColor },
                pressed && styles.pressed,
                action.disabled && styles.disabled,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: tone.iconBackground },
                ]}
              >
                <Icon
                  name={action.icon}
                  size={driverSizes.iconMedium}
                  color={tone.iconColor}
                />
                {action.badge !== undefined ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{action.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {action.label}
              </Text>
              <Icon
                name="chevron-forward"
                size={driverSizes.iconSmall}
                color={driverColors.textSubtle}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heading: {
    color: driverColors.text,
    fontSize: driverTypography.cardTitle,
    fontWeight: driverTypography.weights.heavy,
    marginBottom: driverSpacing.sm,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: driverSpacing.sm,
  },
  action: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 148,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.sm,
    padding: driverSpacing.sm,
    borderRadius: driverRadii.control,
    borderWidth: 1,
    backgroundColor: driverColors.surface,
  },
  iconWrap: {
    width: driverSizes.minimumTouchTarget,
    height: driverSizes.minimumTouchTarget,
    borderRadius: driverRadii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    minWidth: 0,
    color: driverColors.text,
    fontSize: driverTypography.body,
    lineHeight: 20,
    fontWeight: driverTypography.weights.bold,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: driverRadii.pill,
    backgroundColor: driverColors.error,
    borderWidth: 2,
    borderColor: driverColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: driverColors.textOnDark,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: driverTypography.weights.heavy,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
