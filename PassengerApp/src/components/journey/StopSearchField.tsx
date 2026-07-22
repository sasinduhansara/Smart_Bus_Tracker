import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { PassengerPublicStop } from '../../types';
import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../../theme/tokens';
import SymbolIcon from '../common/SymbolIcon';

interface StopSearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  selectedStop: PassengerPublicStop | null;
  suggestions: PassengerPublicStop[];
  active: boolean;
  loading: boolean;
  onFocus: () => void;
  onChangeText: (value: string) => void;
  onClear: () => void;
  onSelect: (stop: PassengerPublicStop) => void;
}

function StopSearchField({
  label,
  placeholder,
  value,
  selectedStop,
  suggestions,
  active,
  loading,
  onFocus,
  onChangeText,
  onClear,
  onSelect,
}: StopSearchFieldProps): React.JSX.Element {
  const showDropdown = active && value.trim().length >= 2 && !selectedStop;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.field,
          active && styles.fieldActive,
          selectedStop && styles.fieldSelected,
        ]}
      >
        <View style={styles.iconWell}>
          <SymbolIcon
            name="location"
            size={19}
            color={
              selectedStop
                ? passengerColors.success
                : passengerColors.primary
            }
          />
        </View>
        <TextInput
          value={value}
          onFocus={onFocus}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={passengerColors.textSubtle}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={label}
        />
        {loading ? (
          <ActivityIndicator
            size="small"
            color={passengerColors.primary}
          />
        ) : value.length > 0 ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={'Clear ' + label.toLowerCase()}
          >
            <SymbolIcon
              name="close"
              size={17}
              color={passengerColors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={styles.dropdownState}>
              <ActivityIndicator
                size="small"
                color={passengerColors.primary}
              />
              <Text style={styles.dropdownStateText}>Searching stops</Text>
            </View>
          ) : suggestions.length > 0 ? (
            suggestions.map((stop, index) => (
              <TouchableOpacity
                key={stop.id}
                style={[
                  styles.suggestion,
                  index < suggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => onSelect(stop)}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={'Select ' + stop.name}
              >
                <View style={styles.suggestionIcon}>
                  <SymbolIcon
                    name="location"
                    size={17}
                    color={passengerColors.secondary}
                  />
                </View>
                <View style={styles.suggestionCopy}>
                  <Text style={styles.suggestionName} numberOfLines={1}>
                    {stop.name}
                  </Text>
                  <Text style={styles.suggestionMeta} numberOfLines={1}>
                    {stop.routeCount
                      ? `${stop.routeCount} route${
                          stop.routeCount === 1 ? '' : 's'
                        } available`
                      : 'Bus stop'}
                  </Text>
                </View>
                <SymbolIcon
                  name="arrow"
                  size={16}
                  color={passengerColors.textSubtle}
                />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.dropdownState}>
              <Text style={styles.dropdownStateTitle}>No matching stops</Text>
              <Text style={styles.dropdownStateText}>
                Check the spelling or try a nearby town.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: passengerSpacing.sm,
    zIndex: 10,
  },
  label: {
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: passengerSpacing.xxs,
    textTransform: 'uppercase',
  },
  field: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
    paddingHorizontal: passengerSpacing.sm,
  },
  fieldActive: {
    borderColor: passengerColors.primary,
  },
  fieldSelected: {
    borderColor: '#B9D5C9',
    backgroundColor: '#F8FCFA',
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primarySoft,
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: passengerColors.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: passengerSpacing.sm,
    paddingVertical: 0,
  },
  clearButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    backgroundColor: passengerColors.surfaceRaised,
    marginTop: passengerSpacing.xxs,
    overflow: 'hidden',
    ...passengerShadows.floating,
  },
  suggestion: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: passengerSpacing.sm,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: passengerColors.border,
  },
  suggestionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.secondarySoft,
  },
  suggestionCopy: {
    flex: 1,
    marginHorizontal: passengerSpacing.sm,
  },
  suggestionName: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  suggestionMeta: {
    color: passengerColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  dropdownState: {
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    padding: passengerSpacing.sm,
  },
  dropdownStateTitle: {
    color: passengerColors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dropdownStateText: {
    color: passengerColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: passengerSpacing.xxs,
  },
});

export default React.memo(StopSearchField);
