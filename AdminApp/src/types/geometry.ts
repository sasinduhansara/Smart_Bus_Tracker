export type GeoJSONPoint = {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
};

export type GeoJSONLineString = {
  type: "LineString";
  coordinates: [number, number][]; // Array of [longitude, latitude]
};

export interface StopWithCoordinates {
  id?: string;
  stopId?: string;
  name: string;
  sequence: number;
  latitude?: number;
  longitude?: number;
  location?: GeoJSONPoint;
}

export interface RouteGeometry {
  geometry?: GeoJSONLineString;
  geometryVersion?: number;
  totalDistanceMeters?: number;
}
