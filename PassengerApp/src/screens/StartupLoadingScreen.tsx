import React from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ONBOARDING_COLORS } from '../constants/onboarding';

interface StartupLoadingScreenProps {
  error?: string | null;
  onRetry?: () => void;
}

function StartupLoadingScreen({
  error,
  onRetry,
}: StartupLoadingScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={ONBOARDING_COLORS.background}
      />
      <View style={styles.content}>
        <View style={styles.logoMark}>
          <Text style={styles.logoIcon}>🚌</Text>
        </View>
        <Text style={styles.title}>GamanaLK</Text>
        <Text style={styles.subtitle}>
          {error ? 'We could not load your app state.' : 'Getting your trip ready'}
        </Text>
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Retry loading app"
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator
            size="large"
            color={ONBOARDING_COLORS.amber}
            style={styles.loader}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ONBOARDING_COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  logoMark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: ONBOARDING_COLORS.brandBlue,
    marginBottom: 18,
  },
  logoIcon: {
    fontSize: 34,
  },
  title: {
    color: ONBOARDING_COLORS.primary,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: ONBOARDING_COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
  errorText: {
    color: ONBOARDING_COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
    maxWidth: 300,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 50,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ONBOARDING_COLORS.amber,
    borderRadius: 25,
    marginTop: 22,
    paddingHorizontal: 24,
  },
  retryText: {
    color: ONBOARDING_COLORS.dark,
    fontSize: 16,
    fontWeight: '800',
  },
});

export default StartupLoadingScreen;
