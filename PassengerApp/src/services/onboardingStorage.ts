import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_COMPLETE_KEY = '@GamanaLK:onboarding_complete';

export async function hasCompletedOnboarding(): Promise<boolean> {
  const storedValue = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
  return storedValue === 'true';
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}
