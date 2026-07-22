/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
  },
}));
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockView = React.forwardRef(({ children }, ref) => {
    React.useImperativeHandle(ref, () => ({}));

    return React.createElement(View, null, children);
  });

  MockView.displayName = 'MapLibreMockView';

  const MockMap = React.forwardRef(({ children }, ref) => {
    React.useImperativeHandle(ref, () => ({
      getCenter: jest.fn(async () => [80, 7]),
      getZoom: jest.fn(async () => 10),
      getVisibleBounds: jest.fn(async () => [
        [79, 8],
        [81, 6],
      ]),
    }));

    return React.createElement(View, null, children);
  });

  MockMap.displayName = 'MapLibreMockMap';

  const MockCamera = React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      setCamera: jest.fn(),
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
      moveTo: jest.fn(),
      zoomTo: jest.fn(),
    }));

    return null;
  });

  MockCamera.displayName = 'MapLibreMockCamera';

  return {
    __esModule: true,
    Map: MockMap,
    MapView: MockMap,
    GeoJSONSource: MockView,
    Layer: MockView,
    Camera: MockCamera,
    MarkerView: MockView,
    PointAnnotation: MockView,
    ShapeSource: MockView,
    VectorSource: MockView,
    RasterSource: MockView,
    LineLayer: MockView,
    CircleLayer: MockView,
    SymbolLayer: MockView,
    FillLayer: MockView,
    RasterLayer: MockView,
    Images: MockView,
    UserLocation: MockView,
    Atmosphere: MockView,
    Logger: {
      setLogCallback: jest.fn(),
      setLogLevel: jest.fn(),
    },
    StyleURL: {
      Default: 'mock-map-style',
      Street: 'mock-map-style',
    },
    requestAndroidLocationPermissions: jest.fn(async () => true),
    setAccessToken: jest.fn(),
  };
});
