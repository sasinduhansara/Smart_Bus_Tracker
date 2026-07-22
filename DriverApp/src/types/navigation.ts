import type { DriverSession } from '.';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;

  OtpVerify: {
    mobile: string;
    purpose: 'register' | 'login';
  };

  DriverAccessGate: undefined;
  BusOnboarding: undefined;

  PendingApproval: {
    driver: DriverSession;
  };

  DriverHome: {
    driver: DriverSession;
  };

  Trips: undefined;
  Profile: undefined;
  Notifications: undefined;
  RouteDetails: undefined;
  DriverRouteMap: undefined;
};
