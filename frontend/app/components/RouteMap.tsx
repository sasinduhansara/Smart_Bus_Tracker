import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

// ─── Colors ─────────────────────────────────────────────────────
const COLORS = {
  primaryBlue: "#0056B3",
  primary: "#1D4ED8",
  white: "#FFFFFF",
  bgLight: "#F8FAFC",
  textDark: "#1E293B",
  textGray: "#64748B",
  textLight: "#94A3B8",
  border: "#E2E8F0",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  red: "#DC2626",
  mapBg: "#0F172A",
};

// ─── Route Data (Colombo → Kurunegala) ──────────────────────────
interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  completed?: boolean;
  isCurrent?: boolean;
}

const ROUTE_STOPS: Stop[] = [
  { id: "1", name: "Colombo Fort", lat: 6.9271, lng: 79.8612, completed: true },
  { id: "2", name: "Kadawatha", lat: 7.1095, lng: 79.9953, completed: true },
  { id: "3", name: "Kiribathgoda", lat: 7.2064, lng: 80.0406, completed: true },
  { id: "4", name: "Gampaha", lat: 7.2862, lng: 80.0967, completed: true },
  { id: "5", name: "Veyangoda", lat: 7.3208, lng: 80.1769 },
  { id: "6", name: "Nittambuwa", lat: 7.4201, lng: 80.3844 },
  { id: "7", name: "Ambepussa", lat: 7.5337, lng: 80.5186 },
  { id: "8", name: "Kurunegala", lat: 7.4772, lng: 80.3647 },
];

// ─── Map coordinate math ────────────────────────────────────────
const MAP_BOUNDS = {
  minLat: 6.9,
  maxLat: 7.55,
  minLng: 79.8,
  maxLng: 80.55,
};

function latLngToPixel(lat: number, lng: number, mapW: number, mapH: number) {
  const x =
    ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) *
    mapW;
  const y =
    ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) *
    mapH;
  return { x, y };
}

interface RouteMapProps {
  height?: number;
  showHeader?: boolean;
  interactive?: boolean;
  onClose?: () => void;
}

export default function RouteMap({
  height = 300,
  showHeader = true,
  interactive = true,
  onClose,
}: RouteMapProps) {
  const router = useRouter();
  const mapW = width - 40;
  const mapH = height - 80;

  // ─── OpenStreetMap Static Map URL (free, no API key) ─────
  const getStaticMapUrl = () => {
    const centerLat = 7.2;
    const centerLng = 80.1;
    const zoom = 9;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${Math.round(mapW)}x${Math.round(mapH)}&maptype=mapnik`;
  };

  // ─── Route line segments (simplified: horizontal bars per pair) ──
  const renderRouteSegments = () => {
    const positions = ROUTE_STOPS.map((s) =>
      latLngToPixel(s.lat, s.lng, mapW, mapH),
    );

    return (
      <View style={[styles.mapOverlay, { width: mapW, height: mapH }]}>
        {/* For each pair of consecutive stops, draw a thin rotated line */}
        {ROUTE_STOPS.slice(0, -1).map((_, i) => {
          const p1 = positions[i];
          const p2 = positions[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <View
              key={`line-${i}`}
              style={{
                position: "absolute",
                left: p1.x,
                top: p1.y - 1.5,
                width: len,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: ROUTE_STOPS[i].completed
                  ? COLORS.green
                  : COLORS.primary,
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          );
        })}

        {/* Stop dots */}
        {ROUTE_STOPS.map((stop, i) => {
          const px = positions[i].x;
          const py = positions[i].y;
          const isCompleted = stop.completed;
          const isCurrent = stop.isCurrent;
          const isLast = i === ROUTE_STOPS.length - 1;
          const r = isLast || isCurrent ? 8 : 6;

          return (
            <View
              key={stop.id}
              style={{
                position: "absolute",
                left: px - r,
                top: py - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: isCompleted
                  ? COLORS.green
                  : isCurrent
                    ? COLORS.primary
                    : COLORS.white,
                borderColor: isCurrent
                  ? COLORS.primary
                  : isCompleted
                    ? COLORS.green
                    : COLORS.textGray,
                borderWidth: 2,
                zIndex: 5,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isCurrent && (
                <View
                  style={{
                    width: r * 3.5,
                    height: r * 3.5,
                    borderRadius: r * 1.75,
                    position: "absolute",
                    borderWidth: 2,
                    borderColor: COLORS.primary,
                    opacity: 0.3,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── Header ─────────────────────────────────────────── */}
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => (onClose ? onClose() : router.back())}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Route Map</Text>
          </View>
          <Text style={styles.routeName}>Colombo → Kurunegala</Text>
        </View>
      )}

      {/* ─── Map Area ──────────────────────────────────────── */}
      <View style={[styles.mapContainer, { height }]}>
        {/* Background - OpenStreetMap Static Map Image */}
        <Image
          source={{ uri: getStaticMapUrl() }}
          style={styles.staticMap}
          resizeMode="cover"
        />

        {/* Route lines and dots overlay */}
        {renderRouteSegments()}

        {/* Map attribution */}
        <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
      </View>

      {/* ─── Stop List ─────────────────────────────────────── */}
      <View style={styles.stopList}>
        {ROUTE_STOPS.map((stop, i) => (
          <View key={stop.id} style={styles.stopItem}>
            <View style={styles.stopDotCol}>
              <View
                style={[
                  styles.stopDot,
                  stop.completed && styles.stopDotCompleted,
                  stop.isCurrent && styles.stopDotCurrent,
                  {
                    backgroundColor: stop.completed
                      ? COLORS.green
                      : stop.isCurrent
                        ? COLORS.primary
                        : COLORS.white,
                    borderColor: stop.isCurrent
                      ? COLORS.primary
                      : stop.completed
                        ? COLORS.green
                        : COLORS.border,
                  },
                ]}
              />
              {i < ROUTE_STOPS.length - 1 && (
                <View
                  style={[
                    styles.stopLine,
                    stop.completed && { backgroundColor: COLORS.green },
                  ]}
                />
              )}
            </View>
            <View style={styles.stopInfo}>
              <Text
                style={[
                  styles.stopName,
                  stop.isCurrent && styles.stopNameCurrent,
                ]}
              >
                {stop.name}
              </Text>
              <Text style={styles.stopStatus}>
                {stop.completed
                  ? "✓ Completed"
                  : stop.isCurrent
                    ? "📍 Current Stop"
                    : `${Math.round(Math.random() * 8 + 2)} km`}
              </Text>
            </View>
            {stop.isCurrent && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>NOW</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* ─── Web Interactive Map (web only) ──────────────── */}
      {interactive && Platform.OS === "web" && (
        <div
          style={{
            height: "400px",
            width: "100%",
          }}
        >
          <iframe
            srcDoc={getEmbedMapHTML()}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title="OpenStreetMap"
          />
        </div>
      )}
    </View>
  );
}

// ─── Web Embed HTML Generator (Leaflet + OSM) ──────────────────
function getEmbedMapHTML() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100vw; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([7.2, 80.1], 8);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap', maxZoom: 18,
        }).addTo(map);
        const coords = [
          [6.9271, 79.8612], [7.1095, 79.9953], [7.2064, 80.0406],
          [7.2862, 80.0967], [7.3208, 80.1769], [7.4201, 80.3844],
          [7.5337, 80.5186], [7.4772, 80.3647]
        ];
        L.polyline(coords, { color: '#1D4ED8', weight: 4 }).addTo(map);
        L.marker([6.9271, 79.8612]).addTo(map).bindPopup('Colombo Fort');
        L.marker([7.4772, 80.3647]).addTo(map).bindPopup('Kurunegala');
        L.marker([7.2064, 80.0406], {
          icon: L.divIcon({ className: 'bus-marker', html: '🚌', iconSize: [30, 30] })
        }).addTo(map).bindPopup('Bus 138');
      </script>
    </body>
    </html>
  `;
}

// ══════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.bgLight,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  routeName: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textGray,
  },
  mapContainer: {
    position: "relative",
    backgroundColor: COLORS.mapBg,
  },
  staticMap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  mapOverlay: {
    position: "absolute",
    top: 40,
    left: 20,
  },
  attribution: {
    position: "absolute",
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
  },
  stopList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stopItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stopDotCol: {
    alignItems: "center",
    width: 16,
  },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  stopDotCompleted: {
    backgroundColor: COLORS.green,
  },
  stopDotCurrent: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  stopLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  stopInfo: {
    flex: 1,
    paddingBottom: 12,
  },
  stopName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  stopNameCurrent: {
    color: COLORS.primary,
    fontSize: 15,
  },
  stopStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textGray,
    marginTop: 2,
  },
  currentBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.white,
  },
});
