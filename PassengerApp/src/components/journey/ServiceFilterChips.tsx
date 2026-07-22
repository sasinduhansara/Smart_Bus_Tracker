import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerSpacing,
} from '../../theme/tokens';
import type { PassengerServiceFilter } from '../../types';

interface ServiceFilterChipsProps {
  value: PassengerServiceFilter;
  disabled?: boolean;
  onChange: (value: PassengerServiceFilter) => void;
}

const OPTIONS: ReadonlyArray<{
  value: PassengerServiceFilter;
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'sltb', label: 'SLTB' },
  { value: 'private', label: 'Private' },
  { value: 'intercity', label: 'AC' },
];

function ServiceFilterChips({
  value,
  disabled = false,
  onChange,
}: ServiceFilterChipsProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {OPTIONS.map(option => {
        const selected = value === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.chip,
              selected && styles.chipSelected,
              disabled && styles.chipDisabled,
            ]}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.label + ' buses'}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: passengerSpacing.xs,
    paddingVertical: passengerSpacing.xxs,
  },
  chip: {
    minWidth: 72,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: passengerRadii.pill,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
    paddingHorizontal: passengerSpacing.md,
  },
  chipSelected: {
    borderColor: passengerColors.primary,
    backgroundColor: passengerColors.primary,
  },
  chipDisabled: {
    opacity: 0.58,
  },
  label: {
    color: passengerColors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  labelSelected: {
    color: passengerColors.white,
  },
});

export default React.memo(ServiceFilterChips);
