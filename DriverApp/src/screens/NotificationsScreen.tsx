import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import {
  DriverHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/driver';
import { getDriverNotifications } from '../services/api';
import {
  driverColors,
  driverRadii,
  driverShadows,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../theme/tokens';
import type { DriverNotification } from '../types';
import type { RootStackParamList } from '../types/navigation';

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function iconForType(type: string): string {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('route')) {
    return 'map-outline';
  }

  if (normalizedType.includes('approval')) {
    return 'shield-checkmark-outline';
  }

  if (normalizedType.includes('warning') || normalizedType.includes('issue')) {
    return 'warning-outline';
  }

  return 'notifications-outline';
}

export default function NotificationsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (refresh = false) => {
    const sequence = ++requestSequenceRef.current;

    if (mountedRef.current) {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
    }

    try {
      const response = await getDriverNotifications(50);

      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setNotifications(response.notifications);
      }
    } catch (loadError) {
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Notifications could not be loaded.',
        );
      }
    } finally {
      if (mountedRef.current && sequence === requestSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadNotifications().catch(() => undefined);

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter(notification => !notification.read)
    .length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        backgroundColor={driverColors.navy900}
        barStyle="light-content"
      />
      <DriverHeader
        menuAccessibilityLabel="Go back"
        menuIconName="arrow-back"
        onMenuPress={() => navigation.goBack()}
        statusLabel={unreadCount ? `${unreadCount} unread` : 'Up to date'}
        statusTone={unreadCount ? 'attention' : 'ready'}
        subtitle="Private operations messages"
        title="Notifications"
      />

      {loading && notifications.length === 0 ? (
        <LoadingState
          message="Loading your operations messages"
          style={styles.state}
          title="Loading notifications"
        />
      ) : error && notifications.length === 0 ? (
        <ErrorState
          message={error}
          onAction={() => loadNotifications().catch(() => undefined)}
          style={styles.state}
          title="Notifications unavailable"
        />
      ) : (
        <FlatList
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              message="New operations messages will appear here."
              title="No notifications"
            />
          }
          ListHeaderComponent={
            error ? (
              <View accessibilityRole="alert" style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, driverSpacing.md) + 24 },
          ]}
          data={notifications}
          keyExtractor={notification => notification.id}
          refreshControl={
            <RefreshControl
              onRefresh={() =>
                loadNotifications(true).catch(() => undefined)
              }
              refreshing={refreshing}
              tintColor={driverColors.teal700}
            />
          }
          renderItem={({ item }) => <NotificationCard notification={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationCard({
  notification,
}: {
  notification: DriverNotification;
}) {
  const status = notification.read ? 'Read' : 'Unread';

  return (
    <View
      accessibilityLabel={`${status} notification. ${notification.title}. ${
        notification.message || 'No additional message.'
      }. ${formatTimestamp(notification.createdAt)}`}
      style={[styles.card, !notification.read && styles.cardUnread]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.icon,
          !notification.read && styles.iconUnread,
        ]}
      >
        <Icon
          color={
            notification.read ? driverColors.textMuted : driverColors.teal700
          }
          name={iconForType(notification.type)}
          size={driverSizes.iconMedium}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={styles.title}>
            {notification.title}
          </Text>
          {!notification.read ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>Unread</Text>
            </View>
          ) : null}
        </View>
        {notification.message ? (
          <Text style={styles.message}>{notification.message}</Text>
        ) : null}
        <Text style={styles.timestamp}>
          {formatTimestamp(notification.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: driverColors.background,
  },
  state: {
    flex: 1,
    margin: driverSpacing.md,
  },
  content: {
    width: '100%',
    maxWidth: driverSizes.contentMaxWidth,
    alignSelf: 'center',
    gap: driverSpacing.sm,
    padding: driverSpacing.md,
  },
  errorBanner: {
    padding: driverSpacing.sm,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.errorSoft,
  },
  errorText: {
    color: driverColors.error,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.semibold,
  },
  card: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: driverSpacing.sm,
    padding: driverSpacing.md,
    borderWidth: 1,
    borderColor: driverColors.border,
    borderRadius: driverRadii.card,
    backgroundColor: driverColors.surface,
    ...driverShadows.card,
  },
  cardUnread: {
    borderColor: driverColors.teal600,
    backgroundColor: driverColors.teal100,
  },
  icon: {
    width: driverSizes.compactTouchTarget,
    height: driverSizes.compactTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.surfaceMuted,
  },
  iconUnread: {
    backgroundColor: driverColors.surface,
  },
  copy: {
    flex: 1,
    gap: driverSpacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: driverSpacing.xs,
  },
  title: {
    flex: 1,
    color: driverColors.text,
    fontSize: driverTypography.bodyLarge,
    fontWeight: driverTypography.weights.bold,
  },
  unreadBadge: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: driverSpacing.xs,
    borderRadius: driverRadii.pill,
    backgroundColor: driverColors.teal700,
  },
  unreadText: {
    color: driverColors.textOnDark,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.bold,
  },
  message: {
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    lineHeight: 21,
  },
  timestamp: {
    color: driverColors.textSubtle,
    fontSize: driverTypography.caption,
    fontWeight: driverTypography.weights.medium,
  },
});
