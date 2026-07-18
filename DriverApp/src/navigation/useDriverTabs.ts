import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../store/useAuthStore';
import type { RootStackParamList } from '../types/navigation';

export type DriverTabKey = 'home' | 'trip' | 'route' | 'profile';

export function useDriverTabs() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const driver = useAuthStore(state => state.session?.driver);

  return useCallback(
    (tab: string) => {
      switch (tab as DriverTabKey) {
        case 'home':
          if (driver) {
            navigation.navigate('DriverHome', { driver });
          }
          break;
        case 'trip':
          navigation.navigate('Trips');
          break;
        case 'route':
          navigation.navigate('RouteDetails');
          break;
        case 'profile':
          navigation.navigate('Profile');
          break;
      }
    },
    [driver, navigation],
  );
}
