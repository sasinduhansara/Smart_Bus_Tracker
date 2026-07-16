import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import type { SocketConnectionStatus } from '../../types';
import {
  passengerColors,
  passengerRadii,
  passengerSpacing,
  passengerTypography,
} from '../../theme/tokens';
import SymbolIcon from '../common/SymbolIcon';

interface PassengerHomeHeaderProps {
  liveBusCount: number;
  socketStatus: SocketConnectionStatus;
  locationMessage: string;
  canRetryLocation: boolean;
  onRetryLocation: () => void;
  onOpenSaved: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

function PassengerHomeHeader({
  liveBusCount,
  socketStatus,
  locationMessage,
  canRetryLocation,
  onRetryLocation,
  onOpenSaved,
}: PassengerHomeHeaderProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  const compactHeader = width < 370;
  const connectionLabel = useMemo(() => {
    if (socketStatus === 'connected') {
      return liveBusCount > 0
        ? liveBusCount + ' buses live'
        : 'Live network ready';
    }

    if (socketStatus === 'connecting' || socketStatus === 'reconnecting') {
      return 'Reconnecting';
    }

    return 'Updates offline';
  }, [liveBusCount, socketStatus]);

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View
          style={styles.brandGroup}
          accessible
          accessibilityLabel="Gamana LK"
        >
          <View style={styles.brandMark}>
            <Text style={styles.brandLetter}>G</Text>
          </View>
          <View>
            <Text style={styles.brandName}>Gamana</Text>
            <Text style={styles.brandCaption}>SMART BUS · LK</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <View
            style={[
              styles.networkPill,
              compactHeader && styles.networkPillCompact,
            ]}
            accessible
            accessibilityLabel={connectionLabel}
          >
            <View
              style={[
                styles.networkDot,
                compactHeader && styles.networkDotCompact,
                {
                  backgroundColor:
                    socketStatus === 'connected'
                      ? passengerColors.success
                      : passengerColors.warning,
                },
              ]}
            />
            {!compactHeader && (
              <Text style={styles.networkText} numberOfLines={1}>
                {connectionLabel}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onOpenSaved}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open saved stops"
          >
            <SymbolIcon
              name="profile"
              size={21}
              color={passengerColors.primaryDark}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.welcomeBlock}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.title} maxFontSizeMultiplier={1.25}>
          Where can we take you?
        </Text>
        <TouchableOpacity
          style={styles.locationRow}
          onPress={canRetryLocation ? onRetryLocation : undefined}
          disabled={!canRetryLocation}
          activeOpacity={0.75}
          accessibilityRole={canRetryLocation ? 'button' : undefined}
          accessibilityLabel={
            canRetryLocation
              ? locationMessage + '. Double tap to retry.'
              : locationMessage
          }
        >
          <SymbolIcon
            name="location"
            size={16}
            color={passengerColors.secondary}
          />
          <Text style={styles.locationText} numberOfLines={2}>
            {locationMessage}
          </Text>
          {canRetryLocation && <Text style={styles.retryText}>Retry</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: passengerSpacing.lg,
    paddingTop: passengerSpacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: passengerSpacing.sm,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primary,
    marginRight: passengerSpacing.sm,
  },
  brandLetter: {
    color: passengerColors.surface,
    fontSize: 21,
    fontWeight: '900',
  },
  brandName: {
    color: passengerColors.primaryDark,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  brandCaption: {
    color: passengerColors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: passengerSpacing.xs,
  },
  networkPill: {
    minHeight: 36,
    maxWidth: 128,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.pill,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    paddingHorizontal: 10,
  },
  networkPillCompact: {
    width: 36,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  networkDotCompact: {
    marginRight: 0,
  },
  networkText: {
    color: passengerColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    flexShrink: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.surface,
    borderWidth: 1,
    borderColor: passengerColors.border,
  },
  welcomeBlock: {
    marginTop: passengerSpacing.xl,
  },
  greeting: {
    color: passengerColors.secondaryDark,
    fontSize: passengerTypography.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: passengerColors.text,
    fontSize: passengerTypography.pageTitle,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: passengerSpacing.xxs,
  },
  locationRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: passengerSpacing.xs,
  },
  locationText: {
    flex: 1,
    color: passengerColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginHorizontal: passengerSpacing.xs,
  },
  retryText: {
    color: passengerColors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
});

export default React.memo(PassengerHomeHeader);
