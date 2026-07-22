export const MAP_CONFIG = {
  // Use map style URL from environment, or fallback to maplibre demotiles for OSM map
  styleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json",
  attributionText: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION_TEXT || "© OpenStreetMap contributors",
  minZoom: Number(process.env.EXPO_PUBLIC_MAP_MIN_ZOOM || 5),
  maxZoom: Number(process.env.EXPO_PUBLIC_MAP_MAX_ZOOM || 18),
  defaultCenter: [80.7718, 7.8731], // Sri Lanka
  defaultZoom: 7,
};
