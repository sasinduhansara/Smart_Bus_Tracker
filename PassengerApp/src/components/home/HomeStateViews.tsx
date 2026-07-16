import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerSpacing,
} from '../../theme/tokens';
import SymbolIcon from '../common/SymbolIcon';

export function HomeLoadingSkeleton(): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.skeletonWrapper, { opacity }]}
      accessible
      accessibilityLabel="Loading live passenger information"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonCard} />
      <View style={styles.skeletonCard} />
    </Animated.View>
  );
}

interface HomeErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export function HomeErrorBanner({
  message,
  onRetry,
}: HomeErrorBannerProps): React.JSX.Element {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <View style={styles.errorIcon}>
        <SymbolIcon name="alert" size={18} color={passengerColors.error} />
      </View>
      <View style={styles.errorCopy}>
        <Text style={styles.errorTitle}>Some live data is unavailable</Text>
        <Text style={styles.errorText} numberOfLines={3}>
          {message}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading passenger data"
      >
        <SymbolIcon name="refresh" size={18} color={passengerColors.primary} />
      </TouchableOpacity>
    </View>
  );
}

interface NearbyEmptyStateProps {
  locationAvailable: boolean;
  onOpenMap: () => void;
}

export function NearbyEmptyState({
  locationAvailable,
  onOpenMap,
}: NearbyEmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <SymbolIcon name="bus" size={22} color={passengerColors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No nearby buses found</Text>
      <Text style={styles.emptyText}>
        {locationAvailable
          ? 'No public bus has shared a recent location near you.'
          : 'Live buses will still appear when operators share a location. Enable location to sort them by distance.'}
      </Text>
      <TouchableOpacity
        style={styles.mapButton}
        onPress={onOpenMap}
        accessibilityRole="button"
        accessibilityLabel="Open live bus map"
      >
        <Text style={styles.mapButtonText}>Check the live map</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonWrapper: {
    paddingHorizontal: passengerSpacing.lg,
    paddingBottom: passengerSpacing.lg,
  },
  skeletonTitle: {
    width: 160,
    height: 22,
    borderRadius: 8,
    backgroundColor: passengerColors.surfaceMuted,
    marginBottom: passengerSpacing.sm,
  },
  skeletonCard: {
    height: 196,
    borderRadius: passengerRadii.card,
    backgroundColor: passengerColors.surfaceMuted,
    marginBottom: passengerSpacing.sm,
  },
  errorBanner: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: passengerSpacing.lg,
    marginBottom: passengerSpacing.sm,
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: '#E8C1BA',
    backgroundColor: passengerColors.secondarySoft,
    padding: passengerSpacing.sm,
  },
  errorIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.surface,
  },
  errorCopy: {
    flex: 1,
    marginHorizontal: passengerSpacing.sm,
  },
  errorTitle: {
    color: passengerColors.error,
    fontSize: 13,
    fontWeight: '900',
  },
  errorText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  retryButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: passengerSpacing.lg,
    marginBottom: passengerSpacing.sm,
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primarySoft,
  },
  emptyTitle: {
    color: passengerColors.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: passengerSpacing.sm,
  },
  emptyText: {
    color: passengerColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: passengerSpacing.xs,
  },
  mapButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: passengerSpacing.sm,
  },
  mapButtonText: {
    color: passengerColors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
});
