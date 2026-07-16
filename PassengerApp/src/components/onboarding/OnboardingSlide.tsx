import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import {
  ONBOARDING_COLORS,
  type OnboardingItem,
} from '../../constants/onboarding';

interface OnboardingSlideProps {
  item: OnboardingItem;
  width: number;
  imageHeight: number;
  compact: boolean;
}

function OnboardingSlide({
  item,
  width,
  imageHeight,
  compact,
}: OnboardingSlideProps): React.JSX.Element {
  return (
    <View style={[styles.slide, { width }]}>
      <View
        style={[
          styles.imageCard,
          { height: imageHeight },
          compact && styles.imageCardCompact,
        ]}
      >
        <Image
          source={item.image as ImageSourcePropType}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityLabel={`${item.title} illustration`}
        />
      </View>

      <View
        style={[
          styles.copyContainer,
          compact && styles.copyContainerCompact,
        ]}
      >
        <Text
          style={[styles.title, compact && styles.titleCompact]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {item.title}
        </Text>
        <Text style={[styles.description, compact && styles.descriptionCompact]}>
          {item.description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
  },
  imageCard: {
    overflow: 'hidden',
    backgroundColor: ONBOARDING_COLORS.white,
    borderRadius: 30,
    marginHorizontal: 24,
    shadowColor: ONBOARDING_COLORS.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 8,
  },
  imageCardCompact: {
    borderRadius: 24,
    marginHorizontal: 20,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  copyContainer: {
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 34,
  },
  copyContainerCompact: {
    paddingHorizontal: 28,
  },
  title: {
    color: ONBOARDING_COLORS.brandBlue,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  description: {
    color: ONBOARDING_COLORS.muted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 14,
    maxWidth: 360,
    textAlign: 'center',
  },
  descriptionCompact: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
});

export default OnboardingSlide;
