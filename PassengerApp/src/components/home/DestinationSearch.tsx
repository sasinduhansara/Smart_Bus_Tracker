import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  passengerColors,
  passengerRadii,
  passengerShadows,
  passengerSpacing,
} from '../../theme/tokens';
import type { PassengerSearchResult, RecentSearch } from '../../types';
import SymbolIcon from '../common/SymbolIcon';

interface DestinationSearchProps {
  query: string;
  results: PassengerSearchResult[];
  recentSearches: RecentSearch[];
  savedStopIds: Set<string>;
  isSearching: boolean;
  searchError?: string | null;
  onChangeQuery: (query: string) => void;
  onSelectResult: (result: PassengerSearchResult) => void;
  onToggleSaved: (result: PassengerSearchResult) => void;
}

function DestinationSearch({
  query,
  results,
  recentSearches,
  savedStopIds,
  isSearching,
  searchError,
  onChangeQuery,
  onSelectResult,
  onToggleSaved,
}: DestinationSearchProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const trimmedQuery = query.trim();
  const suggestions = useMemo<PassengerSearchResult[]>(
    () =>
      trimmedQuery
        ? results
        : recentSearches.map(search => ({
            id: search.id,
            type: search.type,
            title: search.title,
            subtitle: search.subtitle,
            routeNumber: search.routeNumber,
            stopId: search.stopId,
          })),
    [recentSearches, results, trimmedQuery],
  );
  const showPanel =
    focused && (trimmedQuery.length > 0 || suggestions.length > 0);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.searchField, focused && styles.searchFieldFocused]}>
        <SymbolIcon name="search" size={21} color={passengerColors.primary} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 140);
          }}
          placeholder="Search route, stop or town"
          placeholderTextColor={passengerColors.textSubtle}
          style={styles.input}
          returnKeyType="search"
          autoCapitalize="words"
          autoCorrect={false}
          clearButtonMode="never"
          accessibilityLabel="Search routes, bus stops, or towns"
        />
        {isSearching ? (
          <ActivityIndicator
            size="small"
            color={passengerColors.secondary}
            accessibilityLabel="Searching"
          />
        ) : query.length > 0 ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => onChangeQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <SymbolIcon
              name="close"
              size={18}
              color={passengerColors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {showPanel && (
        <View style={styles.resultsPanel}>
          {!trimmedQuery && suggestions.length > 0 && (
            <Text style={styles.panelLabel}>Recent searches</Text>
          )}

          {trimmedQuery &&
          !isSearching &&
          searchError &&
          suggestions.length === 0 ? (
            <View style={styles.noResult} accessibilityRole="alert">
              <Text style={styles.noResultTitle}>Search is unavailable</Text>
              <Text style={styles.noResultText}>{searchError}</Text>
            </View>
          ) : trimmedQuery && !isSearching && suggestions.length === 0 ? (
            <View style={styles.noResult}>
              <Text style={styles.noResultTitle}>
                No matching route or stop
              </Text>
              <Text style={styles.noResultText}>
                Try a route number, town, or full stop name.
              </Text>
            </View>
          ) : (
            suggestions.map((result, index) => {
              const savedId =
                result.type === 'stop' && result.stopId
                  ? result.routeNumber + ':' + result.stopId
                  : '';
              const isSaved = Boolean(savedId && savedStopIds.has(savedId));

              return (
                <View
                  key={result.id}
                  style={[
                    styles.resultRow,
                    index < suggestions.length - 1 && styles.resultBorder,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.resultMain}
                    onPress={() => onSelectResult(result)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={result.title + ', ' + result.subtitle}
                  >
                    <View style={styles.resultIcon}>
                      <SymbolIcon
                        name={result.type === 'stop' ? 'location' : 'route'}
                        size={18}
                        color={passengerColors.primary}
                      />
                    </View>
                    <View style={styles.resultCopy}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {result.title}
                      </Text>
                      <Text style={styles.resultSubtitle} numberOfLines={2}>
                        {result.subtitle}
                      </Text>
                    </View>
                    <SymbolIcon
                      name="arrow"
                      size={18}
                      color={passengerColors.textSubtle}
                    />
                  </TouchableOpacity>

                  {result.type === 'stop' && (
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => onToggleSaved(result)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isSaved
                          ? 'Remove ' + result.title + ' from saved stops'
                          : 'Save ' + result.title
                      }
                    >
                      <SymbolIcon
                        name={isSaved ? 'savedFilled' : 'saved'}
                        size={19}
                        color={
                          isSaved
                            ? passengerColors.secondary
                            : passengerColors.textMuted
                        }
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 8,
    marginTop: passengerSpacing.sm,
    marginHorizontal: passengerSpacing.lg,
  },
  searchField: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: passengerColors.surfaceRaised,
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    paddingHorizontal: passengerSpacing.md,
    ...passengerShadows.card,
  },
  searchFieldFocused: {
    borderColor: passengerColors.primary,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: passengerColors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: passengerSpacing.sm,
    paddingVertical: 0,
  },
  clearButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsPanel: {
    marginTop: passengerSpacing.xs,
    overflow: 'hidden',
    backgroundColor: passengerColors.surfaceRaised,
    borderRadius: passengerRadii.card,
    borderWidth: 1,
    borderColor: passengerColors.border,
    ...passengerShadows.floating,
  },
  panelLabel: {
    color: passengerColors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: passengerSpacing.md,
    paddingTop: passengerSpacing.sm,
  },
  resultRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: passengerSpacing.sm,
  },
  resultBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: passengerColors.border,
  },
  resultMain: {
    minHeight: 62,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: passengerColors.primarySoft,
  },
  resultCopy: {
    flex: 1,
    marginHorizontal: passengerSpacing.sm,
  },
  resultTitle: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  resultSubtitle: {
    color: passengerColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  saveButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResult: {
    padding: passengerSpacing.lg,
  },
  noResultTitle: {
    color: passengerColors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  noResultText: {
    color: passengerColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: passengerSpacing.xxs,
  },
});

export default React.memo(DestinationSearch);
