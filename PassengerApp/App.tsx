import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from './src/screens/OnboardingScreen';
import StartupLoadingScreen from './src/screens/StartupLoadingScreen';
import LiveMapScreen from './src/screens/LiveMapScreen';
import { hasCompletedOnboarding } from './src/services/onboardingStorage';

type StartupState = 'checking' | 'onboarding' | 'ready' | 'error';

function getStartupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Please retry. We could not check whether onboarding was completed.';
}

function App(): React.JSX.Element {
  const [startupState, setStartupState] = useState<StartupState>('checking');
  const [startupError, setStartupError] = useState<string | null>(null);

  const loadOnboardingState = useCallback(async () => {
    setStartupState('checking');
    setStartupError(null);

    try {
      const completed = await hasCompletedOnboarding();
      setStartupState(completed ? 'ready' : 'onboarding');
    } catch (error) {
      setStartupError(getStartupErrorMessage(error));
      setStartupState('error');
    }
  }, []);

  useEffect(() => {
    loadOnboardingState();
  }, [loadOnboardingState]);

  const handleOnboardingFinished = useCallback(() => {
    setStartupState('ready');
    setStartupError(null);
  }, []);

  return (
    <SafeAreaProvider>
      {startupState === 'ready' ? (
        <LiveMapScreen />
      ) : startupState === 'onboarding' ? (
        <OnboardingScreen onFinished={handleOnboardingFinished} />
      ) : (
        <StartupLoadingScreen
          error={startupState === 'error' ? startupError : null}
          onRetry={loadOnboardingState}
        />
      )}
    </SafeAreaProvider>
  );
}

export default App;
