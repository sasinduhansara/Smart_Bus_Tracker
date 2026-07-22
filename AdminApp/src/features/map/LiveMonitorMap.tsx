import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertCircle, Loader2 } from "lucide-react";
import { getLiveMapBuses } from "../../api/mapApi";

const mapStyleUrl = import.meta.env.VITE_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";
const mapAttribution = import.meta.env.VITE_MAP_ATTRIBUTION_TEXT || "© OpenStreetMap contributors";

export function LiveMonitorMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buses, setBuses] = useState<any[]>([]);

  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const liveBuses = await getLiveMapBuses();
        setBuses(liveBuses);
      } catch (err) {
        setError("Failed to load live buses");
      } finally {
        setLoading(false);
      }
    };
    fetchBuses();
    
    // Minimal polling for now. Phase 3 will introduce Socket.IO.
    const interval = setInterval(fetchBuses, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      center: [80.7718, 7.8731], // Sri Lanka center
      zoom: 7,
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.AttributionControl({ customAttribution: mapAttribution }),
      "bottom-right"
    );
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;
      
      map.current.addSource("buses", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      
      map.current.addLayer({
        id: "buses-layer",
        type: "circle",
        source: "buses",
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match",
            ["get", "status"],
            "active", "#16a34a",
            "paused", "#eab308",
            "#94a3b8"
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        }
      });
      
      map.current.on("click", "buses-layer", (e) => {
        if (!e.features || !e.features[0]) return;
        
        const feature = e.features[0];
        const coordinates = (feature.geometry as any).coordinates.slice();
        const props = feature.properties;
        
        new maplibregl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="display: block; font-size: 14px; margin-bottom: 4px;">Bus: ${props.busId}</strong>
              <div style="font-size: 12px; color: #475569;">
                Route: ${props.routeNumber || 'Unknown'}<br/>
                Status: <span style="text-transform: uppercase; font-weight: bold;">${props.status}</span><br/>
                Speed: ${props.speed || 0} km/h
              </div>
            </div>
          `)
          .addTo(map.current!);
      });
      
      map.current.on("mouseenter", "buses-layer", () => {
        map.current!.getCanvas().style.cursor = "pointer";
      });
      
      map.current.on("mouseleave", "buses-layer", () => {
        map.current!.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);
  
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    
    const source = map.current.getSource("buses") as maplibregl.GeoJSONSource;
    if (source) {
      const features = buses.filter(b => b.location?.coordinates).map(bus => ({
        type: "Feature" as const,
        geometry: bus.location,
        properties: {
          busId: bus.busId,
          routeNumber: bus.routeNumber,
          status: bus.operationalStatus || "offline",
          speed: bus.speed,
        }
      }));
      
      source.setData({
        type: "FeatureCollection",
        features,
      });
    }
  }, [buses]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header className="page-header" style={{ marginBottom: "1rem" }}>
        <h1 className="page-title">Live Map</h1>
        <p className="page-subtitle">Real-time view of all active vehicles.</p>
      </header>
      
      {error && (
        <div className="notice-box error" style={{ marginBottom: "1rem" }}>
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}
      
      <div style={{ flex: 1, position: "relative", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", minHeight: "400px" }}>
        {loading && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.7)", zIndex: 10 }}>
            <Loader2 className="spinner" size={32} />
          </div>
        )}
        <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
        
        <div style={{ position: "absolute", top: "1rem", left: "1rem", backgroundColor: "white", padding: "0.5rem", borderRadius: "4px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", zIndex: 1, fontSize: "12px", display: "flex", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#16a34a" }}></span> Active</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#eab308" }}></span> Paused</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#94a3b8" }}></span> Offline</div>
        </div>
      </div>
    </div>
  );
}
