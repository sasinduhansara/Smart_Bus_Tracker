import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Driver surfaces deliberately use a high-contrast, safety-focused palette.
 * Navy keeps persistent chrome calm, teal communicates live/ready states, and
 * amber is reserved for attention and primary operational actions.
 */
export const driverColors = {
  navy950: '#071521',
  navy900: '#0B2030',
  navy800: '#123247',
  navy700: '#1D465E',
  teal700: '#08766C',
  teal600: '#0A8F82',
  teal100: '#D8F2EE',
  amber700: '#9A5508',
  amber600: '#C46C08',
  amber500: '#F59E0B',
  amber100: '#FFF0CF',
  background: '#F3F6F7',
  surface: '#FFFFFF',
  surfaceMuted: '#E8EEF0',
  text: '#10232E',
  textMuted: '#536771',
  textSubtle: '#70828B',
  textOnDark: '#FFFFFF',
  border: '#CFDADD',
  borderStrong: '#A8B8BE',
  success: '#16734A',
  successSoft: '#DDF3E7',
  warning: '#9A5508',
  warningSoft: '#FFF0CF',
  error: '#B4232C',
  errorSoft: '#FCE4E6',
  info: '#176B87',
  infoSoft: '#DDEFF5',
  disabled: '#AEBBC0',
  scrim: 'rgba(7, 21, 33, 0.46)',
} as const;

export const driverSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const driverRadii = {
  small: 8,
  control: 12,
  card: 18,
  feature: 24,
  pill: 999,
} as const;

export const driverTypography = {
  caption: 12,
  label: 13,
  body: 15,
  bodyLarge: 17,
  cardTitle: 18,
  sectionTitle: 22,
  pageTitle: 28,
  hero: 34,
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  } satisfies Record<string, NonNullable<TextStyle['fontWeight']>>,
} as const;

export const driverSizes = {
  minimumTouchTarget: 44,
  compactTouchTarget: 48,
  primaryControlHeight: 54,
  iconSmall: 16,
  iconMedium: 22,
  iconLarge: 28,
  bottomNavHeight: 72,
  contentMaxWidth: 720,
} as const;

export const driverShadows: Record<'card' | 'raised' | 'floating', ViewStyle> =
  {
    card: {
      shadowColor: driverColors.navy950,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 2,
    },
    raised: {
      shadowColor: driverColors.navy950,
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 5,
    },
    floating: {
      shadowColor: driverColors.navy950,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 22,
      elevation: 9,
    },
  };
