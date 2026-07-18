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
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../../theme/tokens';

export type AssignmentStatusTone = 'neutral' | 'ready' | 'attention' | 'danger';

export interface VehicleAssignmentCardProps {
  vehicleNumber?: string | null;
  routeLabel?: string | null;
  operatorLabel?: string | null;
  conductorName?: string | null;
  serviceStatus?: string | null;
  statusTone?: AssignmentStatusTone;
  assignmentLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const toneStyles: Record<
  AssignmentStatusTone,
  { backgroundColor: string; foregroundColor: string }
> = {
  neutral: {
    backgroundColor: driverColors.surfaceMuted,
    foregroundColor: driverColors.textMuted,
  },
  ready: {
    backgroundColor: driverColors.successSoft,
    foregroundColor: driverColors.success,
  },
  attention: {
    backgroundColor: driverColors.warningSoft,
    foregroundColor: driverColors.warning,
  },
  danger: {
    backgroundColor: driverColors.errorSoft,
    foregroundColor: driverColors.error,
  },
};

export function VehicleAssignmentCard({
  vehicleNumber,
  routeLabel,
  operatorLabel,
  conductorName,
  serviceStatus,
  statusTone = 'neutral',
  assignmentLabel = 'Vehicle assignment',
  onPress,
  style,
}: VehicleAssignmentCardProps) {
  const tone = toneStyles[statusTone];
  const hasAssignment = Boolean(vehicleNumber);
  const accessibilityLabel = [
    assignmentLabel,
    vehicleNumber || 'No vehicle assigned',
    routeLabel,
    operatorLabel,
    serviceStatus,
  ]
    .filter(Boolean)
    .join(', ');

  const content = (
    <>
      <View style={styles.headingRow}>
        <View style={styles.iconWrap}>
          <Icon
            name={hasAssignment ? 'bus' : 'bus-outline'}
            size={driverSizes.iconLarge}
            color={driverColors.teal700}
          />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>{assignmentLabel}</Text>
          <Text style={styles.vehicleNumber} numberOfLines={2}>
            {vehicleNumber || 'No vehicle assigned'}
          </Text>
        </View>
        {onPress ? (
          <Icon
            name="chevron-forward"
            size={driverSizes.iconMedium}
            color={driverColors.textMuted}
          />
        ) : null}
      </View>

      {routeLabel || operatorLabel ? (
        <View style={styles.detailsBlock}>
          {routeLabel ? (
            <View style={styles.detailRow}>
              <Icon
                name="map-outline"
                size={driverSizes.iconSmall}
                color={driverColors.textMuted}
              />
              <Text style={styles.detailText}>{routeLabel}</Text>
            </View>
          ) : null}
          {operatorLabel ? (
            <View style={styles.detailRow}>
              <Icon
                name="business-outline"
                size={driverSizes.iconSmall}
                color={driverColors.textMuted}
              />
              <Text style={styles.detailText}>{operatorLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {conductorName || serviceStatus ? (
        <View style={styles.footerRow}>
          {conductorName ? (
            <View style={styles.conductorRow}>
              <Icon
                name="people-outline"
                size={driverSizes.iconSmall}
                color={driverColors.textMuted}
              />
              <Text style={styles.conductorText} numberOfLines={1}>
                {conductorName}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {serviceStatus ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: tone.backgroundColor },
              ]}
            >
              <Text
                style={[styles.statusText, { color: tone.foregroundColor }]}
                numberOfLines={1}
              >
                {serviceStatus}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens assignment details"
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, style]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minWidth: 0,
    backgroundColor: driverColors.surface,
    borderWidth: 1,
    borderColor: driverColors.border,
    borderRadius: driverRadii.card,
    padding: driverSpacing.md,
    ...driverShadows.card,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.995 }],
  },
  headingRow: {
    minHeight: driverSizes.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.sm,
  },
  iconWrap: {
    width: driverSizes.compactTouchTarget,
    height: driverSizes.compactTouchTarget,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: driverColors.textMuted,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.semibold,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  vehicleNumber: {
    color: driverColors.text,
    fontSize: driverTypography.sectionTitle,
    lineHeight: 27,
    fontWeight: driverTypography.weights.heavy,
    marginTop: 1,
  },
  detailsBlock: {
    marginTop: driverSpacing.md,
    paddingTop: driverSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: driverColors.border,
    gap: driverSpacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.xs,
  },
  detailText: {
    flex: 1,
    color: driverColors.text,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.semibold,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: driverSpacing.sm,
    marginTop: driverSpacing.md,
  },
  conductorRow: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.xs,
  },
  conductorText: {
    flexShrink: 1,
    color: driverColors.textMuted,
    fontSize: driverTypography.label,
  },
  statusBadge: {
    maxWidth: '55%',
    minHeight: 28,
    paddingHorizontal: driverSpacing.sm,
    paddingVertical: driverSpacing.xxs,
    borderRadius: driverRadii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.bold,
  },
});
