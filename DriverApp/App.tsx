import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import {
  NavigationContainer,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OtpVerifyScreen from './src/screens/OtpVerifyScreen';
import DriverHomeScreen from './src/screens/DriverHomeScreen';
import PendingApprovalScreen from './src/screens/PendingApprovalScreen';
import TripsScreen from './src/screens/TripsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

import { useAuthStore } from './src/store/useAuthStore';
import type {
  RootStackParamList,
} from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  const session = useAuthStore(state => state.session);

  const isHydrated = useAuthStore(state => state.isHydrated);

  const hydrateSession = useAuthStore(state => state.hydrateSession);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  if (!isHydrated) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      </SafeAreaProvider>
    );
  }

  const verificationStatus = session?.driver.verificationStatus;

  const initialRouteName: keyof RootStackParamList =
    !session
      ? 'Login'
      : verificationStatus === 'approved' ||
          verificationStatus === 'verified'
        ? 'DriverHome'
        : 'PendingApproval';

  const initialDriverParams = session
    ? {
        driver: session.driver,
      }
    : undefined;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRouteName}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />

          <Stack.Screen name="Register" component={RegisterScreen} />

          <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />

          <Stack.Screen
            name="PendingApproval"
            component={PendingApprovalScreen}
            initialParams={initialDriverParams}
          />

          <Stack.Screen
            name="DriverHome"
            component={DriverHomeScreen}
            initialParams={initialDriverParams}
          />

          <Stack.Screen name="Trips" component={TripsScreen} />

          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});

export default App;
