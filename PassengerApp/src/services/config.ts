import { Platform } from 'react-native';

const LOCAL_DEV_HOST = Platform.select({
  android: '10.0.2.2',
  ios: 'localhost',
  default: 'localhost',
});

export const API_HOST = LOCAL_DEV_HOST;
export const BASE_URL = `http://${API_HOST}:5000`;

// For a physical phone, replace LOCAL_DEV_HOST with your computer's Wi-Fi IP.
