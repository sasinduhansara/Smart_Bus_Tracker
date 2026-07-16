import type { ImageSourcePropType } from 'react-native';

import onboardingImageOne from '../assets/onboarding/onboarding-1.png';
import onboardingImageTwo from '../assets/onboarding/onboarding-2.png';
import onboardingImageThree from '../assets/onboarding/onboarding-3.png';

export const ONBOARDING_COLORS = {
  primary: '#0F172A',
  dark: '#07111F',
  brandBlue: '#0B4EA2',
  amber: '#F59E0B',
  white: '#FFFFFF',
  background: '#F8FAFC',
  text: '#0F172A',
  muted: '#64748B',
  lightGray: '#E2E8F0',
  paleBlue: '#DBEAFE',
};

export interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  image: ImageSourcePropType;
}

export const ONBOARDING_ITEMS: OnboardingItem[] = [
  {
    id: 'welcome',
    title: 'Welcome to GamanaLK',
    description:
      'Experience reliable and efficient transport. Track your bus in real time and never miss a ride.',
    buttonText: 'Next',
    image: onboardingImageOne,
  },
  {
    id: 'track-live',
    title: 'Track Buses Live',
    description:
      'See your bus moving in real time with live route tracking and instant location updates.',
    buttonText: 'Next',
    image: onboardingImageTwo,
  },
  {
    id: 'eta',
    title: 'Get ETA & Ride Smarter',
    description:
      'Check estimated arrival times, plan your trip faster, and travel with confidence every day.',
    buttonText: 'Get Started',
    image: onboardingImageThree,
  },
];
