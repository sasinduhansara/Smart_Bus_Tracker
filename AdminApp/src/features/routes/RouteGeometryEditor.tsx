import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AlertCircle, Check, Loader2, Map as MapIcon, X } from "lucide-react";

import {
  generateRouteGeometry,
  saveRouteGeometry,
  updateRouteStops,
} from "../../api/mapApi";
import type { RouteDetails } from "../../types/route";
import type { StopWithCoordinates } from "../../types/geometry";
import { getErrorMessage } from "../../utils/errors";

interface RouteGeometryEditorProps {
  route: RouteDetails;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const mapStyleUrl = import.meta.env.VITE_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";
const mapAttribution = import.meta.env.VITE_MAP_ATTRIBUTION_TEXT || "© OpenStreetMap contributors";

export function RouteGeometryEditor({
  route,
  onClose,
  onSaved,
}: RouteGeometryEditorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stops, setStops] = useState<StopWithCoordinates[]>(() => {
    // Convert RouteStop to StopWithCoordinates
    return route.stops.map((stop) => ({
      ...stop,
      latitude: stop.location?.coordinates[1] ?? stop.latitude,
      longitude: stop.location?.coordinates[0] ?? stop.longitude,
    }));
  });
  const [previewGeometry, setPreviewGeometry] = useState<any>(null);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number>(0);

  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Calculate bounds from stops
    let minLng = 180,
      maxLng = -180,
      minLat = 90,
      maxLat = -90;
    
    let hasCoords = false;
    stops.forEach((s) => {
      if (s.longitude && s.latitude) {
        hasCoords = true;
        if (s.longitude < minLng) minLng = s.longitude;
        if (s.longitude > maxLng) maxLng = s.longitude;
        if (s.latitude < minLat) minLat = s.latitude;
        if (s.latitude > maxLat) maxLat = s.latitude;
      }
    });

    // Default to Sri Lanka if no coords
    if (!hasCoords) {
      minLng = 79.5;
      maxLng = 81.5;
      minLat = 5.5;
      maxLat = 9.5;
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      bounds: [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      fitBoundsOptions: { padding: 50 },
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.AttributionControl({
        customAttribution: mapAttribution,
      }),
      "bottom-right"
    );
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;

      // Add source for approved geometry
      map.current.addSource("approved-route", {
        type: "geojson",
        data: route.geometry || {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [] },
          properties: {},
        },
      });

      map.current.addLayer({
        id: "approved-route-line",
        type: "line",
        source: "approved-route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 4,
          "line-opacity": 0.6,
        },
      });

      // Add source for preview geometry
      map.current.addSource("preview-route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [] },
          properties: {},
        },
      });

      map.current.addLayer({
        id: "preview-route-line",
        type: "line",
        source: "preview-route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#16a34a",
          "line-width": 5,
          "line-dasharray": [2, 2],
        },
      });

      renderMarkers();
    });

    return () => {
      markers.current.forEach((m) => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const renderMarkers = () => {
    if (!map.current) return;

    // Clear old markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    stops.forEach((stop, index) => {
      if (!stop.longitude || !stop.latitude) return;

      const el = document.createElement("div");
      el.className = "marker";
      el.style.backgroundColor =
        index === 0 ? "#16a34a" : index === stops.length - 1 ? "#dc2626" : "#475569";
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50%";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<strong>${stop.sequence}. ${stop.name}</strong>`
      );

      const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        updateStopLocation(stop.id || stop.sequence.toString(), lngLat.lat, lngLat.lng);
      });

      markers.current.push(marker);
    });
  };

  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      renderMarkers();
    }
  }, [stops]);

  useEffect(() => {
    if (map.current?.isStyleLoaded() && previewGeometry) {
      const source = map.current.getSource("preview-route") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(previewGeometry);
      }
    }
  }, [previewGeometry]);

  const updateStopLocation = (idOrSeq: string, lat: number, lng: number) => {
    setStops((prev) =>
      prev.map((s) => {
        const matchId = s.id || s.sequence.toString();
        if (matchId === idOrSeq) {
          return { ...s, latitude: lat, longitude: lng };
        }
        return s;
      })
    );
    // Clear preview if a stop moved
    setPreviewGeometry(null);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");

    try {
      // First save the stops to the database so the backend sees the new coords
      await updateRouteStops(route.id, stops);
      
      // Then generate the geometry from OSRM
      const res = await generateRouteGeometry(route.id);
      
      setPreviewGeometry(res.geometry);
      setTotalDistanceMeters(res.totalDistanceMeters);
      
      if (map.current && res.geometry.coordinates.length > 0) {
        const coords = res.geometry.coordinates;
        // Simple bounds calculation
        let minLng = coords[0][0], maxLng = coords[0][0];
        let minLat = coords[0][1], maxLat = coords[0][1];
        
        coords.forEach((c) => {
          if (c[0] < minLng) minLng = c[0];
          if (c[0] > maxLng) maxLng = c[0];
          if (c[1] < minLat) minLat = c[1];
          if (c[1] > maxLat) maxLat = c[1];
        });
        
        map.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 50 }
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to generate route geometry"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!previewGeometry) return;
    
    setLoading(true);
    setError("");

    try {
      await saveRouteGeometry(route.id, previewGeometry, totalDistanceMeters);
      onSaved(`Geometry for route ${route.routeNumber} saved successfully.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save route geometry"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal" role="dialog" style={{ width: "90vw", maxWidth: "1200px", height: "90vh", display: "flex", flexDirection: "column" }}>
        <header className="modal-header">
          <div>
            <h2 className="modal-title">Edit Route Geometry</h2>
            <p className="modal-subtitle">
              Route {route.routeNumber} - {route.name}
            </p>
          </div>
          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal-body" style={{ flex: 1, display: "flex", gap: "1rem", padding: "1rem", overflow: "hidden" }}>
          <div className="geometry-sidebar" style={{ width: "300px", display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto" }}>
            <div className="panel" style={{ padding: "1rem" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "0.5rem" }}>Instructions</h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "1rem" }}>
                1. Drag the stop markers on the map to set their exact locations.
                <br /><br />
                2. Click "Generate route line" to preview the snapped road network path.
                <br /><br />
                3. If the path looks correct, click "Approve & save".
              </p>
              
              <button
                type="button"
                className="secondary-button"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="spinner" /> : <MapIcon size={16} />}
                Generate route line
              </button>
            </div>
            
            {error && (
              <div className="notice-box error">
                <AlertCircle size={16} />
                <p>{error}</p>
              </div>
            )}
            
            {previewGeometry && (
              <div className="panel" style={{ padding: "1rem", backgroundColor: "var(--surface-raised)" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "0.5rem" }}>Preview Ready</h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "1rem" }}>
                  Distance: {(totalDistanceMeters / 1000).toFixed(2)} km
                </p>
                <button
                  type="button"
                  className="primary-button"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleSave}
                  disabled={loading}
                >
                  {loading ? <Loader2 size={16} className="spinner" /> : <Check size={16} />}
                  Approve & save
                </button>
              </div>
            )}
            
            <div className="panel" style={{ padding: "1rem", flex: 1 }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "0.5rem" }}>Stops</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {stops.map(s => (
                  <div key={s.id || s.sequence} style={{ fontSize: "13px", padding: "0.25rem", borderBottom: "1px solid var(--border)" }}>
                    <strong>{s.sequence}.</strong> {s.name}
                    {!s.latitude && <span style={{ color: "var(--error)", marginLeft: "0.5rem" }}>No coords</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div style={{ flex: 1, borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
            <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
