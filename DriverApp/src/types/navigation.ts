import type { DriverSession } from '.';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;

  OtpVerify: {
    mobile: string;
    purpose: 'register' | 'login';
  };

  PendingApproval: {
    driver: DriverSession;
  };

  DriverHome: {
    driver: DriverSession;
  };

  Trips: undefined;
  Profile: undefined;
};
