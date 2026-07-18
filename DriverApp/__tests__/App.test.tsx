/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: () => null,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../src/screens/LoginScreen', () => () => null);
jest.mock('../src/screens/RegisterScreen', () => () => null);
jest.mock('../src/screens/OtpVerifyScreen', () => () => null);
jest.mock('../src/screens/DriverHomeScreen', () => () => null);
jest.mock('../src/screens/PendingApprovalScreen', () => () => null);
jest.mock('../src/screens/TripsScreen', () => () => null);
jest.mock('../src/screens/ProfileScreen', () => () => null);
jest.mock('../src/screens/NotificationsScreen', () => () => null);
jest.mock('../src/screens/RouteDetailsScreen', () => () => null);

const mockHydrateSession = jest.fn();
const mockLogout = jest.fn();

jest.mock('../src/store/useAuthStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      session: null,
      isHydrated: true,
      hydrateSession: mockHydrateSession,
      logout: mockLogout,
    }),
}));

jest.mock('../src/services/api', () => ({
  configureUnauthorizedHandler: jest.fn(),
}));

import App from '../App';

test('renders the application root without crashing', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  expect(renderer).toBeDefined();

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
});
