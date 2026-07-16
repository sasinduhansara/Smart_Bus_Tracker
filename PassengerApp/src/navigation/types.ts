export type PassengerTab = 'home' | 'map' | 'routes' | 'saved';

export type RouteDirectoryMode = 'search' | 'timetables';

export interface PassengerDestination {
  tab: PassengerTab;
  routeNumber?: string;
  busId?: string;
  stopId?: string;
  routeMode?: RouteDirectoryMode;
}

export type PassengerNavigate = (destination: PassengerDestination) => void;
