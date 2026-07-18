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
import NotificationsScreen from './src/screens/NotificationsScreen';
import RouteDetailsScreen from './src/screens/RouteDetailsScreen';

import { useAuthStore } from './src/store/useAuthStore';
import { configureUnauthorizedHandler } from './src/services/api';
import type {
  RootStackParamList,
} from './src/types/navigation';
import {
  getDriverNavigationKey,
  getInitialDriverRoute,
} from './src/navigation/authRouting';
import { driverColors } from './src/theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  const session = useAuthStore(state => state.session);

  const isHydrated = useAuthStore(state => state.isHydrated);

  const hydrateSession = useAuthStore(state => state.hydrateSession);
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    configureUnauthorizedHandler(logout);

    return () => configureUnauthorizedHandler(null);
  }, [logout]);

  if (!isHydrated) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={driverColors.teal100} />
        </View>
      </SafeAreaProvider>
    );
  }

  const initialRouteName = getInitialDriverRoute(session);

  const initialDriverParams = session
    ? {
        driver: session.driver,
      }
    : undefined;
  const navigationKey = getDriverNavigationKey(session);

  return (
    <SafeAreaProvider>
      <NavigationContainer key={navigationKey}>
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

          <Stack.Screen name="RouteDetails" component={RouteDetailsScreen} />

          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
          />
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
    backgroundColor: driverColors.navy900,
  },
});

export default App;
