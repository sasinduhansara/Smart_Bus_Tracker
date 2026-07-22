import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../../theme/tokens';
import type { PassengerTimetableService } from '../../types';
import SymbolIcon from '../common/SymbolIcon';

interface TimetableServiceCardProps {
  service: PassengerTimetableService;
  onViewLive: () => void;
}

function durationLabel(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;

  if (!hours) {
    return `${remaining} min`;
  }

  if (!remaining) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}

function statusLabel(service: PassengerTimetableService): string {
  if (service.liveTrackingAvailable) {
    return service.tripStatus === 'paused' ? 'Paused live' : 'Live now';
  }

  if (service.status === 'completed') {
    return 'Completed';
  }

  return 'Scheduled';
}

function TimetableServiceCard({
  service,
  onViewLive,
}: TimetableServiceCardProps): React.JSX.Element {
  const departure =
    service.departureFromSelectedStop || service.scheduledDeparture || '--:--';
  const arrival = service.arrivalAtDestination || '--:--';
  const live = service.liveTrackingAvailable;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {service.serviceTypeLabel ||
              (service.serviceType === 'intercity'
                ? 'AC'
                : service.serviceType.toUpperCase())}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            live && styles.statusBadgeLive,
            service.status === 'completed' && styles.statusBadgeCompleted,
          ]}
        >
          {live && <View style={styles.liveDot} />}
          <Text
            style={[
              styles.statusText,
              live && styles.statusTextLive,
              service.status === 'completed' && styles.statusTextCompleted,
            ]}
          >
            {statusLabel(service)}
          </Text>
        </View>
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>DEPART</Text>
          <Text style={styles.timeValue}>{departure}</Text>
        </View>
        <View style={styles.durationBlock}>
          <View style={styles.timeLine} />
          <Text style={styles.durationText}>
            {durationLabel(service.journeyDurationMinutes)}
          </Text>
          <View style={styles.timeLine} />
        </View>
        <View style={[styles.timeBlock, styles.timeBlockRight]}>
          <Text style={styles.timeLabel}>ARRIVE</Text>
          <Text style={styles.timeValue}>{arrival}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Bus</Text>
          <Text style={styles.detailValue}>
            {service.busRegistration || 'Assignment pending'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Operator</Text>
          <Text style={styles.detailValue}>
            {service.operatorName || 'Not published'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Driver</Text>
          <Text style={styles.detailValue}>
            {service.driverName || 'Not published'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.liveButton, !live && styles.liveButtonDisabled]}
        onPress={onViewLive}
        disabled={!live}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityState={{ disabled: !live }}
        accessibilityLabel={
          live
            ? 'View this bus on the live map'
            : 'Live tracking is not available yet'
        }
      >
        <SymbolIcon
          name="map"
          size={19}
          color={live ? passengerColors.white : passengerColors.textSubtle}
        />
        <Text
          style={[
            styles.liveButtonText,
            !live && styles.liveButtonTextDisabled,
          ]}
        >
          {live
            ? 'View live bus'
            : 'Live tracking starts when the driver begins'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.md,
    marginBottom: passengerSpacing.sm,
    ...passengerShadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    borderRadius: passengerRadii.pill,
    backgroundColor: passengerColors.primarySoft,
    paddingHorizontal: passengerSpacing.sm,
    paddingVertical: 6,
  },
  typeBadgeText: {
    color: passengerColors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  statusBadge: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.pill,
    backgroundColor: passengerColors.surfaceMuted,
    paddingHorizontal: passengerSpacing.sm,
  },
  statusBadgeLive: {
    backgroundColor: '#E3F2EA',
  },
  statusBadgeCompleted: {
    backgroundColor: passengerColors.surfaceMuted,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: passengerColors.success,
    marginRight: 6,
  },
  statusText: {
    color: passengerColors.textMuted,
    fontSize: 10,
    fontWeight: '900',
  },
  statusTextLive: {
    color: passengerColors.success,
  },
  statusTextCompleted: {
    color: passengerColors.textSubtle,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: passengerSpacing.lg,
  },
  timeBlock: {
    minWidth: 64,
  },
  timeBlockRight: {
    alignItems: 'flex-end',
  },
  timeLabel: {
    color: passengerColors.textSubtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  timeValue: {
    color: passengerColors.text,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  durationBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: passengerSpacing.sm,
  },
  timeLine: {
    flex: 1,
    height: 1,
    backgroundColor: passengerColors.border,
  },
  durationText: {
    color: passengerColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginHorizontal: passengerSpacing.xs,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: passengerColors.border,
    marginTop: passengerSpacing.md,
    paddingTop: passengerSpacing.sm,
  },
  detailRow: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: passengerColors.textSubtle,
    fontSize: 11,
    fontWeight: '700',
  },
  detailValue: {
    flex: 1,
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    marginLeft: passengerSpacing.sm,
  },
  liveButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.control,
    backgroundColor: passengerColors.primary,
    marginTop: passengerSpacing.md,
    paddingHorizontal: passengerSpacing.sm,
  },
  liveButtonDisabled: {
    backgroundColor: passengerColors.surfaceMuted,
  },
  liveButtonText: {
    color: passengerColors.white,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: passengerSpacing.xs,
    textAlign: 'center',
  },
  liveButtonTextDisabled: {
    color: passengerColors.textSubtle,
  },
});

export default React.memo(TimetableServiceCard);
