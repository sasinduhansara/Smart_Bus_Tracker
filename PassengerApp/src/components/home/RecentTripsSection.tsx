import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerSpacing,
} from '../../theme/tokens';
import type { RecentTrip } from '../../types';
import { formatRelativeTime } from '../../utils/passengerHome';
import SymbolIcon from '../common/SymbolIcon';

interface RecentTripsSectionProps {
  trips: RecentTrip[];
  onRepeatTrip: (trip: RecentTrip) => void;
}

function RecentTripsSection({
  trips,
  onRepeatTrip,
}: RecentTripsSectionProps): React.JSX.Element | null {
  if (trips.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>PICK UP WHERE YOU LEFT OFF</Text>
      <Text style={styles.title}>Recent journeys</Text>

      <View style={styles.list}>
        {trips.slice(0, 3).map((trip, index) => (
          <TouchableOpacity
            key={trip.id}
            style={[styles.row, index > 0 && styles.rowBorder]}
            onPress={() => onRepeatTrip(trip)}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={
              'Repeat journey to ' +
              trip.destinationName +
              ' on route ' +
              trip.routeNumber
            }
          >
            <View style={styles.historyIcon}>
              <SymbolIcon
                name="history"
                size={19}
                color={passengerColors.secondary}
              />
            </View>
            <View style={styles.copy}>
              <Text style={styles.destination} numberOfLines={1}>
                {trip.destinationName}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                Route {trip.routeNumber} ·{' '}
                {formatRelativeTime(trip.viewedAt).replace('Updated ', '')}
              </Text>
              {trip.originName && (
                <Text style={styles.origin} numberOfLines={1}>
                  From {trip.originName}
                </Text>
              )}
            </View>
            <View style={styles.repeatAction}>
              <Text style={styles.repeatText}>Repeat</Text>
              <SymbolIcon
                name="arrow"
                size={16}
                color={passengerColors.primary}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: passengerSpacing.xxl,
    paddingHorizontal: passengerSpacing.lg,
  },
  eyebrow: {
    color: passengerColors.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: passengerColors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 2,
    marginBottom: passengerSpacing.sm,
  },
  list: {
    overflow: 'hidden',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
  },
  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: passengerSpacing.sm,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: passengerColors.border,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.secondarySoft,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: passengerSpacing.sm,
  },
  destination: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  meta: {
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  origin: {
    color: passengerColors.textSubtle,
    fontSize: 10,
    marginTop: 2,
  },
  repeatAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  repeatText: {
    color: passengerColors.primary,
    fontSize: 11,
    fontWeight: '900',
    marginRight: 2,
  },
});

export default React.memo(RecentTripsSection);
