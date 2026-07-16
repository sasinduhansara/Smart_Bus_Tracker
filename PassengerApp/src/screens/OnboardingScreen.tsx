import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import brandLogo from '../assets/branding/gamana-logo.png';
import OnboardingSlide from '../components/onboarding/OnboardingSlide';
import {
  ONBOARDING_COLORS,
  ONBOARDING_ITEMS,
  type OnboardingItem,
} from '../constants/onboarding';
import { completeOnboarding } from '../services/onboardingStorage';

interface OnboardingScreenProps {
  onFinished: () => void;
}

function OnboardingScreen({
  onFinished,
}: OnboardingScreenProps): React.JSX.Element {
  const flatListRef = useRef<FlatList<OnboardingItem>>(null);
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const isFinalPage = currentIndex === ONBOARDING_ITEMS.length - 1;
  const compact = height < 720;
  const imageHeight = useMemo(() => {
    const preferredHeight = compact ? height * 0.34 : height * 0.4;
    const maxHeight = compact ? 246 : 340;
    const minHeight = compact ? 188 : 250;
    return Math.max(minHeight, Math.min(maxHeight, preferredHeight));
  }, [compact, height]);

  const scrollToPage = useCallback(
    (index: number, animated = true) => {
      const nextIndex = Math.max(
        0,
        Math.min(index, ONBOARDING_ITEMS.length - 1),
      );
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated });
      setCurrentIndex(nextIndex);
    },
    [],
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      scrollToPage(currentIndex, false);
    });

    return () => cancelAnimationFrame(frameId);
  }, [currentIndex, scrollToPage, width]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (currentIndex > 0) {
          scrollToPage(currentIndex - 1);
        }

        return true;
      },
    );

    return () => subscription.remove();
  }, [currentIndex, scrollToPage]);

  const finishOnboarding = useCallback(async () => {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);
    setCompletionError(null);

    try {
      await completeOnboarding();
      onFinished();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Please try again. We could not save onboarding completion.';
      setCompletionError(message);
      setIsCompleting(false);
    }
  }, [isCompleting, onFinished]);

  const handlePrimaryPress = useCallback(() => {
    if (isCompleting) {
      return;
    }

    if (isFinalPage) {
      void finishOnboarding();
      return;
    }

    scrollToPage(currentIndex + 1);
  }, [
    currentIndex,
    finishOnboarding,
    isCompleting,
    isFinalPage,
    scrollToPage,
  ]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x /
          event.nativeEvent.layoutMeasurement.width,
      );
      setCurrentIndex(Math.max(0, Math.min(nextIndex, ONBOARDING_ITEMS.length - 1)));
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<OnboardingItem>) => (
      <OnboardingSlide
        item={item}
        width={width}
        imageHeight={imageHeight}
        compact={compact}
      />
    ),
    [compact, imageHeight, width],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={ONBOARDING_COLORS.background}
      />

      <View style={[styles.header, compact && styles.headerCompact]}>
        <Image
          source={brandLogo}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityLabel="GamanaLK"
        />
        {!isFinalPage && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={finishOnboarding}
            disabled={isCompleting}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={ONBOARDING_ITEMS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        scrollEnabled={!isCompleting}
        extraData={`${width}-${imageHeight}-${currentIndex}`}
        style={styles.slider}
      />

      <View style={[styles.footer, compact && styles.footerCompact]}>
        <View
          style={styles.pagination}
          accessible
          accessibilityLabel={`Onboarding page ${currentIndex + 1} of ${
            ONBOARDING_ITEMS.length
          }`}
        >
          {ONBOARDING_ITEMS.map((item, index) => {
            const isActive = index === currentIndex;

            return (
              <View
                key={item.id}
                style={[
                  styles.dot,
                  isActive ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            );
          })}
        </View>

        {!!completionError && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {completionError}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, isCompleting && styles.disabledButton]}
          onPress={handlePrimaryPress}
          disabled={isCompleting}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={
            isFinalPage ? 'Get started with GamanaLK' : 'Next onboarding page'
          }
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={ONBOARDING_COLORS.dark} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {ONBOARDING_ITEMS[currentIndex].buttonText}
              </Text>
              <Text style={styles.arrowIcon}>→</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ONBOARDING_COLORS.background,
  },
  header: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  headerCompact: {
    minHeight: 64,
    paddingTop: 2,
  },
  brandLogo: {
    width: 172,
    height: 50,
  },
  skipButton: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: ONBOARDING_COLORS.white,
    borderWidth: 1,
    borderColor: ONBOARDING_COLORS.lightGray,
  },
  skipText: {
    color: ONBOARDING_COLORS.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  slider: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 22,
    paddingTop: 14,
  },
  footerCompact: {
    paddingBottom: 14,
    paddingTop: 8,
  },
  pagination: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  dot: {
    height: 9,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 30,
    backgroundColor: ONBOARDING_COLORS.amber,
  },
  inactiveDot: {
    width: 9,
    backgroundColor: ONBOARDING_COLORS.lightGray,
  },
  errorText: {
    color: '#B45309',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ONBOARDING_COLORS.amber,
    borderRadius: 29,
    shadowColor: ONBOARDING_COLORS.amber,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: ONBOARDING_COLORS.dark,
    fontSize: 17,
    fontWeight: '800',
  },
  arrowIcon: {
    color: ONBOARDING_COLORS.dark,
    fontSize: 24,
    fontWeight: '800',
    marginLeft: 10,
    marginTop: -1,
  },
});

export default OnboardingScreen;
