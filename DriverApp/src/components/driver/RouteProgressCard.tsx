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

export type RouteStopStatus = 'completed' | 'current' | 'upcoming';

export interface RouteStopPreview {
  id: string;
  label: string;
  status: RouteStopStatus;
  etaLabel?: string;
}

export interface NextStopCardProps {
  stopName: string;
  etaLabel?: string;
  distanceLabel?: string;
  sequenceLabel?: string;
  isFinalStop?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export interface RouteProgressCardProps {
  routeLabel?: string;
  originLabel?: string;
  destinationLabel?: string;
  progress?: number | null;
  completedStops?: number;
  totalStops?: number;
  currentStopLabel?: string;
  nextStop?: Omit<NextStopCardProps, 'onPress' | 'style'>;
  stops?: RouteStopPreview[];
  onOpenRoute?: () => void;
  onNextStopPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function NextStopCard({
  stopName,
  etaLabel,
  distanceLabel,
  sequenceLabel,
  isFinalStop = false,
  onPress,
  style,
}: NextStopCardProps) {
  const accessibilityLabel = [
    isFinalStop ? 'Final stop' : 'Next stop',
    stopName,
    etaLabel ? `ETA ${etaLabel}` : null,
    distanceLabel,
    sequenceLabel,
  ]
    .filter(Boolean)
    .join(', ');

  const content = (
    <>
      <View style={styles.nextStopIcon}>
        <Icon
          name={isFinalStop ? 'flag' : 'navigate'}
          size={driverSizes.iconMedium}
          color={driverColors.textOnDark}
        />
      </View>
      <View style={styles.nextStopCopy}>
        <Text style={styles.nextStopEyebrow}>
          {isFinalStop ? 'Final stop' : 'Next stop'}
        </Text>
        <Text style={styles.nextStopName} numberOfLines={2}>
          {stopName}
        </Text>
        {sequenceLabel ? (
          <Text style={styles.nextStopMeta}>{sequenceLabel}</Text>
        ) : null}
      </View>
      {etaLabel || distanceLabel ? (
        <View style={styles.nextStopTiming}>
          {etaLabel ? <Text style={styles.nextStopEta}>{etaLabel}</Text> : null}
          {distanceLabel ? (
            <Text style={styles.nextStopDistance}>{distanceLabel}</Text>
          ) : null}
        </View>
      ) : null}
      {onPress ? (
        <Icon
          name="chevron-forward"
          size={driverSizes.iconSmall}
          color={driverColors.teal100}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens next stop details"
        onPress={onPress}
        style={({ pressed }) => [
          styles.nextStopCard,
          style,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.nextStopCard, style]}
    >
      {content}
    </View>
  );
}

export function RouteProgressCard({
  routeLabel,
  originLabel,
  destinationLabel,
  progress,
  completedStops,
  totalStops,
  currentStopLabel,
  nextStop,
  stops = [],
  onOpenRoute,
  onNextStopPress,
  style,
}: RouteProgressCardProps) {
  const countProgress =
    typeof completedStops === 'number' &&
    typeof totalStops === 'number' &&
    totalStops > 0
      ? completedStops / totalStops
      : null;
  const rawProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? progress
      : countProgress;
  const normalizedProgress =
    rawProgress === null ? null : Math.max(0, Math.min(1, rawProgress));
  const progressPercent =
    normalizedProgress === null ? null : Math.round(normalizedProgress * 100);
  const stopCountLabel =
    typeof completedStops === 'number' && typeof totalStops === 'number'
      ? `${completedStops} of ${totalStops} stops`
      : null;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.heading}>
            Route progress
          </Text>
          {routeLabel ? (
            <Text style={styles.routeLabel} numberOfLines={2}>
              {routeLabel}
            </Text>
          ) : null}
        </View>
        {onOpenRoute ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open full route"
            hitSlop={8}
            onPress={onOpenRoute}
            style={({ pressed }) => [
              styles.mapButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="map-outline"
              size={driverSizes.iconMedium}
              color={driverColors.teal700}
            />
          </Pressable>
        ) : null}
      </View>

      {originLabel || destinationLabel ? (
        <View style={styles.routeEndpoints}>
          <View
            style={[styles.endpointDot, !originLabel && styles.destinationDot]}
          />
          <Text style={styles.endpointText} numberOfLines={2}>
            {originLabel || destinationLabel}
          </Text>
          {originLabel && destinationLabel ? (
            <Icon
              name="arrow-forward"
              size={driverSizes.iconSmall}
              color={driverColors.textSubtle}
            />
          ) : null}
          {originLabel && destinationLabel ? (
            <Text style={styles.endpointText} numberOfLines={2}>
              {destinationLabel}
            </Text>
          ) : null}
          {originLabel && destinationLabel ? (
            <View style={[styles.endpointDot, styles.destinationDot]} />
          ) : null}
        </View>
      ) : null}

      {progressPercent !== null ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>
              {currentStopLabel
                ? `Current: ${currentStopLabel}`
                : 'Route completion'}
            </Text>
            <Text style={styles.progressValue}>
              {stopCountLabel || `${progressPercent}%`}
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Route completion"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: progressPercent,
              text: stopCountLabel || `${progressPercent}%`,
            }}
            style={styles.progressTrack}
          >
            <View
              style={[styles.progressFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </View>
      ) : currentStopLabel ? (
        <View style={styles.currentStopRow}>
          <Icon
            name="location"
            size={driverSizes.iconSmall}
            color={driverColors.teal700}
          />
          <Text style={styles.progressLabel}>Current: {currentStopLabel}</Text>
        </View>
      ) : null}

      {nextStop ? (
        <NextStopCard
          {...nextStop}
          onPress={onNextStopPress}
          style={styles.nextStopSpacing}
        />
      ) : null}

      {stops.length > 0 ? (
        <View style={styles.stopList}>
          {stops.map((stop, index) => (
            <View key={stop.id} style={styles.stopRow}>
              <View style={styles.stopRail}>
                <View
                  style={[
                    styles.stopDot,
                    stop.status === 'completed' && styles.stopDotCompleted,
                    stop.status === 'current' && styles.stopDotCurrent,
                  ]}
                />
                {index < stops.length - 1 ? (
                  <View
                    style={[
                      styles.stopLine,
                      stop.status === 'completed' && styles.stopLineCompleted,
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.stopCopy}>
                <Text
                  style={[
                    styles.stopLabel,
                    stop.status === 'current' && styles.stopLabelCurrent,
                  ]}
                  numberOfLines={2}
                >
                  {stop.label}
                </Text>
                {stop.etaLabel ? (
                  <Text style={styles.stopEta}>{stop.etaLabel}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minWidth: 0,
    backgroundColor: driverColors.surface,
    borderRadius: driverRadii.card,
    borderWidth: 1,
    borderColor: driverColors.border,
    padding: driverSpacing.md,
    ...driverShadows.card,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: driverSpacing.sm,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  heading: {
    color: driverColors.text,
    fontSize: driverTypography.cardTitle,
    fontWeight: driverTypography.weights.heavy,
  },
  routeLabel: {
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    lineHeight: 20,
    fontWeight: driverTypography.weights.medium,
    marginTop: driverSpacing.xxs,
  },
  mapButton: {
    width: driverSizes.minimumTouchTarget,
    height: driverSizes.minimumTouchTarget,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeEndpoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.xs,
    marginTop: driverSpacing.md,
  },
  endpointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: driverColors.teal700,
  },
  destinationDot: {
    backgroundColor: driverColors.amber600,
  },
  endpointText: {
    minWidth: 0,
    flexShrink: 1,
    color: driverColors.text,
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.semibold,
  },
  progressBlock: {
    marginTop: driverSpacing.md,
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: driverSpacing.sm,
    marginBottom: driverSpacing.xs,
  },
  progressLabel: {
    flex: 1,
    color: driverColors.textMuted,
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.medium,
  },
  progressValue: {
    color: driverColors.text,
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.bold,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: driverRadii.pill,
    overflow: 'hidden',
    backgroundColor: driverColors.surfaceMuted,
  },
  progressFill: {
    height: '100%',
    borderRadius: driverRadii.pill,
    backgroundColor: driverColors.teal600,
  },
  currentStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.xs,
    marginTop: driverSpacing.md,
  },
  nextStopSpacing: {
    marginTop: driverSpacing.md,
  },
  nextStopCard: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.sm,
    padding: driverSpacing.sm,
    backgroundColor: driverColors.navy900,
    borderRadius: driverRadii.control,
  },
  nextStopIcon: {
    width: driverSizes.compactTouchTarget,
    height: driverSizes.compactTouchTarget,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.teal700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStopCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextStopEyebrow: {
    color: driverColors.teal100,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nextStopName: {
    color: driverColors.textOnDark,
    fontSize: driverTypography.bodyLarge,
    lineHeight: 22,
    fontWeight: driverTypography.weights.bold,
    marginTop: 1,
  },
  nextStopMeta: {
    color: driverColors.border,
    fontSize: driverTypography.caption,
    marginTop: 2,
  },
  nextStopTiming: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  nextStopEta: {
    color: driverColors.amber500,
    fontSize: driverTypography.bodyLarge,
    fontWeight: driverTypography.weights.heavy,
  },
  nextStopDistance: {
    color: driverColors.border,
    fontSize: driverTypography.caption,
    marginTop: 2,
  },
  stopList: {
    marginTop: driverSpacing.md,
  },
  stopRow: {
    minHeight: driverSizes.minimumTouchTarget,
    flexDirection: 'row',
  },
  stopRail: {
    width: 22,
    alignItems: 'center',
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: driverColors.borderStrong,
    backgroundColor: driverColors.surface,
    marginTop: 5,
  },
  stopDotCompleted: {
    borderColor: driverColors.teal700,
    backgroundColor: driverColors.teal700,
  },
  stopDotCurrent: {
    borderColor: driverColors.amber600,
    backgroundColor: driverColors.amber500,
  },
  stopLine: {
    flex: 1,
    width: 2,
    backgroundColor: driverColors.border,
  },
  stopLineCompleted: {
    backgroundColor: driverColors.teal600,
  },
  stopCopy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: driverSpacing.xs,
    paddingBottom: driverSpacing.sm,
  },
  stopLabel: {
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    lineHeight: 20,
    fontWeight: driverTypography.weights.medium,
  },
  stopLabelCurrent: {
    color: driverColors.text,
    fontWeight: driverTypography.weights.bold,
  },
  stopEta: {
    color: driverColors.textSubtle,
    fontSize: driverTypography.caption,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.76,
  },
});
