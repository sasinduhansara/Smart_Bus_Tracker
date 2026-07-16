import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerSpacing,
} from '../../theme/tokens';
import type { SavedStop } from '../../types';
import SymbolIcon from '../common/SymbolIcon';

interface SavedStopsSectionProps {
  stops: SavedStop[];
  onViewAll: () => void;
  onOpenStop: (stop: SavedStop) => void;
  onRemoveStop: (stop: SavedStop) => void;
}

function SavedStopsSection({
  stops,
  onViewAll,
  onOpenStop,
  onRemoveStop,
}: SavedStopsSectionProps): React.JSX.Element {
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR EVERYDAY STOPS</Text>
          <Text style={styles.title}>Saved for later</Text>
        </View>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={onViewAll}
          accessibilityRole="button"
          accessibilityLabel="View all saved stops"
        >
          <Text style={styles.viewAllText}>View all</Text>
        </TouchableOpacity>
      </View>

      {stops.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={onViewAll}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="No saved stops. Open route search to save a stop."
        >
          <View style={styles.emptyIcon}>
            <SymbolIcon
              name="saved"
              size={22}
              color={passengerColors.secondary}
            />
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Keep a stop close</Text>
            <Text style={styles.emptyText}>
              Search a stop and tap the bookmark to find it faster next time.
            </Text>
          </View>
          <SymbolIcon
            name="arrow"
            size={18}
            color={passengerColors.textSubtle}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.listCard}>
          {stops.slice(0, 2).map((stop, index) => (
            <View
              key={stop.id}
              style={[styles.stopRow, index > 0 && styles.stopRowBorder]}
            >
              <TouchableOpacity
                style={styles.stopMain}
                onPress={() => onOpenStop(stop)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  stop.name + ', route ' + stop.routeNumber + ', open live map'
                }
              >
                <View style={styles.stopIcon}>
                  <SymbolIcon
                    name="location"
                    size={18}
                    color={passengerColors.primary}
                  />
                </View>
                <View style={styles.stopCopy}>
                  <Text style={styles.stopName} numberOfLines={1}>
                    {stop.name}
                  </Text>
                  <Text style={styles.routeText}>Route {stop.routeNumber}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => onRemoveStop(stop)}
                accessibilityRole="button"
                accessibilityLabel={'Remove ' + stop.name + ' from saved stops'}
              >
                <SymbolIcon
                  name="savedFilled"
                  size={19}
                  color={passengerColors.secondary}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: passengerSpacing.xxl,
    paddingHorizontal: passengerSpacing.lg,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: passengerSpacing.sm,
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
  },
  viewAllButton: {
    minWidth: 62,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  viewAllText: {
    color: passengerColors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surface,
    padding: passengerSpacing.md,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.secondarySoft,
  },
  emptyCopy: {
    flex: 1,
    marginHorizontal: passengerSpacing.sm,
  },
  emptyTitle: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  listCard: {
    overflow: 'hidden',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
  },
  stopRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: passengerSpacing.sm,
  },
  stopRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: passengerColors.border,
  },
  stopMain: {
    flex: 1,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primarySoft,
  },
  stopCopy: {
    flex: 1,
    marginLeft: passengerSpacing.sm,
  },
  stopName: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  routeText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  removeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(SavedStopsSection);
