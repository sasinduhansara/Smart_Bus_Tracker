import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../../theme/tokens';
import type { SocketConnectionStatus } from '../../types';
import SymbolIcon from '../common/SymbolIcon';

interface LiveMapPreviewCardProps {
  liveBusCount: number;
  totalBusCount: number;
  connectionStatus: SocketConnectionStatus;
  onOpenMap: () => void;
}

function LiveMapPreviewCard({
  liveBusCount,
  totalBusCount,
  connectionStatus,
  onOpenMap,
}: LiveMapPreviewCardProps): React.JSX.Element {
  const connected = connectionStatus === 'connected';
  const networkCopy = connected
    ? liveBusCount + ' live of ' + totalBusCount + ' tracked buses'
    : 'Live updates are reconnecting';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpenMap}
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel={'Open live bus map. ' + networkCopy}
    >
      <View
        style={styles.artwork}
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.routeLine, styles.routeLineOne]} />
        <View style={[styles.routeLine, styles.routeLineTwo]} />
        <View style={[styles.routeLine, styles.routeLineThree]} />
        <View style={[styles.routeNode, styles.routeNodeOne]} />
        <View style={[styles.routeNode, styles.routeNodeTwo]} />
        <View style={[styles.routeNode, styles.routeNodeThree]} />
        <View style={styles.busMarker}>
          <SymbolIcon name="bus" size={20} color={passengerColors.surface} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.livePill}>
          <View
            style={[
              styles.liveDot,
              connected ? styles.liveDotConnected : styles.liveDotReconnecting,
            ]}
          />
          <Text style={styles.livePillText}>
            {connected ? 'LIVE NETWORK' : 'RECONNECTING'}
          </Text>
        </View>
        <Text style={styles.title}>See the journey unfold</Text>
        <Text style={styles.subtitle}>
          {networkCopy}. Open the full map for routes, stops, and model-backed
          arrival predictions.
        </Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>Open live map</Text>
          <View style={styles.actionIcon}>
            <SymbolIcon
              name="arrow"
              size={18}
              color={passengerColors.primaryDark}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 220,
    overflow: 'hidden',
    marginHorizontal: passengerSpacing.lg,
    marginTop: passengerSpacing.xl,
    borderRadius: passengerRadii.feature,
    backgroundColor: passengerColors.primaryDark,
    ...passengerShadows.floating,
  },
  artwork: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '49%',
    overflow: 'hidden',
    opacity: 0.95,
  },
  routeLine: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#6CC5A0',
    transform: [{ rotate: '-28deg' }],
  },
  routeLineOne: {
    width: 210,
    top: 38,
    right: -54,
  },
  routeLineTwo: {
    width: 180,
    top: 108,
    right: -22,
    transform: [{ rotate: '34deg' }],
  },
  routeLineThree: {
    width: 170,
    bottom: 30,
    right: -14,
  },
  routeNode: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#AEE6CD',
    backgroundColor: passengerColors.primaryDark,
  },
  routeNodeOne: {
    top: 51,
    right: 88,
  },
  routeNodeTwo: {
    top: 111,
    right: 30,
  },
  routeNodeThree: {
    bottom: 32,
    right: 92,
  },
  busMarker: {
    position: 'absolute',
    top: 91,
    right: 78,
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.secondary,
    borderWidth: 3,
    borderColor: passengerColors.primaryDark,
  },
  content: {
    width: '68%',
    minHeight: 220,
    justifyContent: 'center',
    padding: passengerSpacing.lg,
  },
  livePill: {
    alignSelf: 'flex-start',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  liveDotConnected: {
    backgroundColor: '#72D4A5',
  },
  liveDotReconnecting: {
    backgroundColor: passengerColors.warning,
  },
  livePillText: {
    color: '#DCEBE5',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: passengerColors.surface,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: passengerSpacing.sm,
  },
  subtitle: {
    color: '#BED2CA',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: passengerSpacing.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: passengerSpacing.md,
  },
  actionText: {
    color: passengerColors.surface,
    fontSize: 13,
    fontWeight: '900',
    marginRight: passengerSpacing.xs,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.surface,
  },
});

export default React.memo(LiveMapPreviewCard);
