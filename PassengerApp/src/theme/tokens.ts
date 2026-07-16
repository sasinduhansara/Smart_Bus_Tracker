import type { ViewStyle } from 'react-native';

export const passengerColors = {
  primary: '#155E4B',
  primaryDark: '#0B3D32',
  primarySoft: '#DDEDE6',
  secondary: '#B9573F',
  secondaryDark: '#813A2D',
  secondarySoft: '#F7E5DF',
  background: '#F5F0E8',
  surface: '#FFFCF7',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#EDE8DF',
  text: '#202522',
  textMuted: '#65706A',
  textSubtle: '#89918D',
  border: '#DED8CE',
  success: '#277A55',
  warning: '#A96319',
  error: '#A13333',
  white: '#FFFFFF',
  scrim: 'rgba(19, 36, 30, 0.42)',
} as const;

export const passengerSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const passengerRadii = {
  control: 12,
  card: 18,
  feature: 24,
  pill: 999,
} as const;

export const passengerShadows: Record<'card' | 'floating', ViewStyle> = {
  card: {
    shadowColor: '#263C33',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  floating: {
    shadowColor: '#1A3027',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 6,
  },
};

export const passengerTypography = {
  caption: 12,
  body: 15,
  cardTitle: 17,
  sectionTitle: 21,
  pageTitle: 28,
} as const;
