import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import BottomNavigation from '../components/navigation/BottomNavigation';
import LiveMapScreen from '../screens/LiveMapScreen';
import PassengerHomeScreen from '../screens/PassengerHomeScreen';
import RouteExplorerScreen from '../screens/RouteExplorerScreen';
import SavedStopsScreen from '../screens/SavedStopsScreen';
import { passengerColors } from '../theme/tokens';
import type {
  PassengerDestination,
  PassengerNavigate,
  PassengerTab,
} from './types';

const HOME_DESTINATION: PassengerDestination = { tab: 'home' };

function PassengerAppShell(): React.JSX.Element {
  const [destination, setDestination] =
    useState<PassengerDestination>(HOME_DESTINATION);

  const navigate = useCallback<PassengerNavigate>(nextDestination => {
    setDestination(nextDestination);
  }, []);

  const handleTabPress = useCallback((tab: PassengerTab) => {
    setDestination({
      tab,
      routeMode: tab === 'routes' ? 'search' : undefined,
    });
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (destination.tab === 'home') {
          return false;
        }

        setDestination(HOME_DESTINATION);
        return true;
      },
    );

    return () => subscription.remove();
  }, [destination.tab]);

  let screen: React.JSX.Element;

  switch (destination.tab) {
    case 'map':
      screen = (
        <LiveMapScreen
          key={[
            destination.busId,
            destination.routeNumber,
            destination.stopId,
          ].join(':')}
          initialBusId={destination.busId}
          initialRouteNumber={destination.routeNumber}
          initialStopId={destination.stopId}
        />
      );
      break;
    case 'routes':
      screen = (
        <RouteExplorerScreen mode={destination.routeMode} navigate={navigate} />
      );
      break;
    case 'saved':
      screen = <SavedStopsScreen navigate={navigate} />;
      break;
    default:
      screen = <PassengerHomeScreen navigate={navigate} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.screen}>{screen}</View>
      <BottomNavigation
        activeTab={destination.tab}
        onTabPress={handleTabPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: passengerColors.background,
  },
  screen: {
    flex: 1,
  },
});

export default PassengerAppShell;
