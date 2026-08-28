import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { gpsApi, createTrackingWebSocket } from "../api/gps";
import shipmentsApi from "../api/shipments";
import tripsApi from "../api/trips";
import {
  Truck, MapPin, Navigation, Zap, Wifi, WifiOff, RefreshCw,
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, Package,
  ChevronDown, Signal, Play, Square, RotateCcw, Route,
  Fuel, TimerReset,
} from "lucide-react";
import { toast } from "react-toastify";

const CITY_COORDS = {
  // South India
  kollam: [8.8932, 76.6141],
  trivandrum: [8.5241, 76.9366],
  thiruvananthapuram: [8.5241, 76.9366],
  kochi: [9.9312, 76.2673],
  cochin: [9.9312, 76.2673],
  calicut: [11.2588, 75.7804],
  kozhikode: [11.2588, 75.7804],
  thrissur: [10.5276, 76.2144],
  kannur: [11.8745, 75.3704],
  alappuzha: [9.4981, 76.3388],
  palakkad: [10.7867, 76.6548],
  chennai: [13.0827, 80.2707],
  madras: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  madurai: [9.9252, 78.1198],
  trichy: [10.7905, 78.7047],
  tiruchirappalli: [10.7905, 78.7047],
  salem: [11.6643, 78.1460],
  tirunelveli: [8.7139, 77.7567],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  mysore: [12.2958, 76.6394],
  mysuru: [12.2958, 76.6394],
  mangalore: [12.9141, 74.8560],
  mangaluru: [12.9141, 74.8560],
  hubli: [15.3647, 75.1240],
  hyderabad: [17.3850, 78.4867],
  secunderabad: [17.4399, 78.4983],
  visakhapatnam: [17.6868, 83.2185],
  vizag: [17.6868, 83.2185],
  vijayawada: [16.5062, 80.6480],

  // West & Central India
  mumbai: [19.0760, 72.8777],
  bombay: [19.0760, 72.8777],
  pune: [18.5204, 73.8567],
  nagpur: [21.1458, 79.0882],
  nashik: [19.9975, 73.7898],
  aurangabad: [19.8762, 75.3433],
  ahmedabad: [23.0225, 72.5714],
  surat: [21.1702, 72.8311],
  vadodara: [22.3072, 73.1812],
  rajkot: [22.3039, 70.8022],
  goa: [15.2993, 74.1240],
  panaji: [15.4909, 73.8278],
  indore: [22.7196, 75.8577],
  bhopal: [23.2599, 77.4126],
  jabalpur: [23.1815, 79.9864],
  raipur: [21.2514, 81.6296],

  // North India
  delhi: [28.6139, 77.2090],
  "new delhi": [28.6139, 77.2090],
  noida: [28.5355, 77.3910],
  gurgaon: [28.4595, 77.0266],
  gurugram: [28.4595, 77.0266],
  jaipur: [26.9124, 75.7873],
  jodhpur: [26.2389, 73.0243],
  udaipur: [24.5854, 73.7125],
  lucknow: [26.8467, 80.9462],
  kanpur: [26.4499, 80.3319],
  varanasi: [25.3176, 82.9739],
  agra: [27.1767, 78.0081],
  chandigarh: [30.7333, 76.7794],
  ludhiana: [30.9010, 75.8573],
  amritsar: [31.6340, 74.8723],
  dehradun: [30.3165, 78.0322],
  jammu: [32.7266, 74.8570],
  srinagar: [34.0837, 74.7973],

  // East & North-East India
  kolkata: [22.5726, 88.3639],
  calcutta: [22.5726, 88.3639],
  patna: [25.5941, 85.1376],
  bhubaneswar: [20.2961, 85.8245],
  cuttack: [20.4625, 85.8830],
  ranchi: [23.3441, 85.3096],
  jamshedpur: [22.8046, 86.2029],
  guwahati: [26.1445, 91.7362],

  // Major States
  kerala: [8.5241, 76.9366],
  "tamil nadu": [13.0827, 80.2707],
  karnataka: [12.9716, 77.5946],
  maharashtra: [19.0760, 72.8777],
  gujarat: [23.0225, 72.5714],
  rajasthan: [26.9124, 75.7873],
  "uttar pradesh": [26.8467, 80.9462],
  "west bengal": [22.5726, 88.3639],
  telangana: [17.3850, 78.4867],
  "andhra pradesh": [16.5062, 80.6480],
  punjab: [30.7333, 76.7794],
  haryana: [28.4595, 77.0266],
  "madhya pradesh": [22.7196, 75.8577],
  goa: [15.2993, 74.1240],
  odisha: [20.2961, 85.8245],
  assam: [26.1445, 91.7362],

  // Major International Logistics Hubs
  dubai: [25.2048, 55.2708],
  "abu dhabi": [24.4539, 54.3773],
  singapore: [1.3521, 103.8198],
  london: [51.5074, -0.1278],
  "new york": [40.7128, -74.0060],
  chicago: [41.8781, -87.6298],
  "san francisco": [37.7749, -122.4194],
  "los angeles": [34.0522, -118.2437],
  dallas: [32.7767, -96.7970],
  tokyo: [35.6762, 139.6503],
  shanghai: [31.2304, 121.4737],
  "hong kong": [22.3193, 114.1694],
  sydney: [-33.8688, 151.2093],
};
const WS_MAX_DELAY = 30000;
const STATUS_COLORS = {
  Created: "#64748B", Assigned: "#0D9488", "In Transit": "#4F46E5",
  Delivered: "#059669", Delayed: "#D97706", Cancelled: "#DC2626",
};
const ROUTE_TYPE_COLORS = {
  fastest: "#4F46E5", shortest: "#0D9488", other: "#8B5CF6", traffic_avoidance: "#D97706", fuel_efficient: "#059669",
};

function getCityCoords(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(city) || city.includes(key)) return coords;
  }
  return null;
}

function resolveCoordinates(address, explicitLat, explicitLon) {
  if (explicitLat !== null && explicitLat !== undefined && explicitLon !== null && explicitLon !== undefined) {
    const lat = parseFloat(explicitLat);
    const lon = parseFloat(explicitLon);
    if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
      return [lat, lon];
    }
  }
  return getCityCoords(address) || [8.8932, 76.6141];
}

function isPointNearRoute(lat, lon, sCoords, dCoords) {
  if (!sCoords || !dCoords) return true;
  const minLat = Math.min(sCoords[0], dCoords[0]) - 1.2;
  const maxLat = Math.max(sCoords[0], dCoords[0]) + 1.2;
  const minLon = Math.min(sCoords[1], dCoords[1]) - 1.2;
  const maxLon = Math.max(sCoords[1], dCoords[1]) + 1.2;
  return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

const createVehicleIcon = (heading = 0, isActive = true) => L.divIcon({
  className: "custom-vehicle-icon",
  html: `
    <div style="position:relative;width:48px;height:48px;">
      ${isActive ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(13,148,136,0.4);animation:pulseRing 2s ease-out infinite;"></div>` : ""}
      <div style="
        width:48px;height:48px;border-radius:50%;
        background:${isActive ? "linear-gradient(135deg,#0D9488,#0891B2)" : "#94A3B8"};
        border:3px solid #fff;box-shadow:0 4px 16px rgba(13,148,136,0.45);
        display:flex;align-items:center;justify-content:center;
        transform:rotate(${heading}deg);transition:transform 0.3s ease;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
    </div>`,
  iconSize: [48, 48], iconAnchor: [24, 24],
});

const createPinIcon = (color, label) => L.divIcon({
  className: "custom-pin-icon",
  html: `<div style="background:${color};color:white;padding:5px 12px;border-radius:14px;font-size:11px;font-weight:800;border:2px solid white;box-shadow:0 4px 14px rgba(15,23,42,0.3);white-space:nowrap;">${label}</div>`,
  iconSize: [100, 30], iconAnchor: [50, 15],
});

const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center?.[0] && center?.[1]) map.flyTo(center, map.getZoom(), { animate: true, duration: 1.2 });
  }, [center, map]);
  return null;
};

const WsIndicator = ({ status, attempt }) => {
  const cfg = {
    connected:    { color: "#059669", bg: "rgba(5,150,105,0.1)",   border: "rgba(5,150,105,0.25)",   label: "LIVE",           Icon: Wifi },
    connecting:   { color: "#D97706", bg: "rgba(217,119,6,0.1)",   border: "rgba(217,119,6,0.25)",   label: attempt > 1 ? `RECONNECT #${attempt}` : "CONNECTING", Icon: RefreshCw },
    disconnected: { color: "#DC2626", bg: "rgba(220,38,38,0.1)",   border: "rgba(220,38,38,0.25)",   label: "DISCONNECTED",   Icon: WifiOff },
  }[status] || { color: "#64748B", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)", label: "OFFLINE", Icon: WifiOff };

  return (
    <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 800, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", gap: "6px" }}>
      {status === "connected" && (
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#059669", animation: "liveBlip 1.4s ease-in-out infinite", display: "inline-block" }} />
      )}
      {status === "connecting" && <cfg.Icon size={11} style={{ animation: "spin 1s linear infinite" }} />}
      {status === "disconnected" && <cfg.Icon size={11} />}
      {cfg.label}
    </span>
  );
};

const VehicleCard = ({ shipment, isActive, onClick }) => {
  const sc = STATUS_COLORS[shipment.status] || "#64748B";
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
        background: isActive ? "linear-gradient(135deg, rgba(13,148,136,0.08), rgba(8,145,178,0.06))" : "#F8FAFC",
        border: isActive ? "1.5px solid rgba(13,148,136,0.4)" : "1px solid #E2E8F0",
        transition: "all 0.2s", marginBottom: "8px",
        boxShadow: isActive ? "0 4px 12px rgba(13,148,136,0.12)" : "none",
        transform: isActive ? "translateX(2px)" : "none",
      }}
      onMouseOver={(e) => { if (!isActive) { e.currentTarget.style.borderColor = "#0D9488"; e.currentTarget.style.background = "rgba(13,148,136,0.04)"; }}}
      onMouseOut={(e)  => { if (!isActive) { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#F8FAFC"; }}}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "11px", fontWeight: 900, color: "#0D9488", fontFamily: "monospace" }}>{shipment.tracking_number}</span>
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px", background: `${sc}15`, color: sc, border: `1px solid ${sc}30` }}>
          {shipment.status}
        </span>
      </div>
      <p style={{ fontSize: "11px", color: "#475569", margin: 0, display: "flex", alignItems: "center", gap: "4px" }}>
        <MapPin size={9} /> {shipment.source} → {shipment.destination}
      </p>
    </div>
  );
};

/* ── Main Component ── */
const TrackingMap = () => {
  const { vehicleId: urlVehicleId } = useParams();
  const navigate = useNavigate();

  const [allShipments,       setAllShipments]       = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [activeVehicleId,    setActiveVehicleId]     = useState(urlVehicleId || "");
  const [position,           setPosition]           = useState(null);
  const [speed,              setSpeed]              = useState(0);
  const [heading,            setHeading]            = useState(0);
  const [trackHistory,       setTrackHistory]       = useState([]);
  const [wsStatus,           setWsStatus]           = useState("disconnected");
  const [wsAttempt,          setWsAttempt]          = useState(0);
  const [lastUpdated,        setLastUpdated]        = useState(null);
  const [activeShipments,    setActiveShipments]    = useState([]);
  const [etaTelemetry,       setEtaTelemetry]       = useState(null);
  const [activeTrip,         setActiveTrip]         = useState(null);
  const [routeOptions,       setRouteOptions]       = useState(null);
  const [selectedRoute,      setSelectedRoute]      = useState("fastest");
  const [routeCoords,        setRouteCoords]        = useState(null);
  const [tripLoading,        setTripLoading]        = useState(false);
  const [isOffRoute,         setIsOffRoute]         = useState(false);
  const [recalcNotice,       setRecalcNotice]       = useState(false);

  const wsRef      = useRef(null);
  const retryTimer = useRef(null);
  const retryDelay = useRef(1000);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* Load shipments list */
  useEffect(() => {
    shipmentsApi.list(0, 100).then((res) => {
      const shipments = res.shipments || [];
      setAllShipments(shipments);
      if (!urlVehicleId && shipments.length > 0) {
        const found = shipments.find((s) => s.vehicle_id) || shipments[0];
        if (found) {
          setSelectedShipmentId(found.shipment_id);
          if (found.vehicle_id) setActiveVehicleId(found.vehicle_id);
        }
      }
    }).catch(console.error);
  }, [urlVehicleId]);

  /* Load vehicle telemetry & trips */
  const loadVehicleData = useCallback(async () => {
    if (!activeVehicleId) return;
    try {
      const currentShipment = allShipments.find(s => s.shipment_id === selectedShipmentId);
      const sCoords = currentShipment ? resolveCoordinates(currentShipment.source, currentShipment.source_lat, currentShipment.source_lon) : null;
      const dCoords = currentShipment ? resolveCoordinates(currentShipment.destination, currentShipment.destination_lat, currentShipment.destination_lon) : null;

      const [posData, trackData, linkedShipments] = await Promise.all([
        gpsApi.getLatest(activeVehicleId).catch(() => null),
        gpsApi.getTrack(activeVehicleId, 50).catch(() => []),
        shipmentsApi.getByVehicle(activeVehicleId).catch(() => []),
      ]);

      if (posData) {
        const lat = parseFloat(posData.latitude), lon = parseFloat(posData.longitude);
        if (currentShipment?.status === "Delivered" && dCoords) {
          setPosition(dCoords);
        } else if (sCoords && dCoords && isPointNearRoute(lat, lon, sCoords, dCoords)) {
          setPosition([lat, lon]);
        } else if (sCoords) {
          setPosition(sCoords);
        } else {
          setPosition([lat, lon]);
        }
        if (posData.speed)   setSpeed(parseFloat(posData.speed));
        if (posData.heading) setHeading(parseFloat(posData.heading));
        setLastUpdated(new Date(posData.recorded_time));
      } else {
        if (currentShipment?.status === "Delivered" && dCoords) {
          setPosition(dCoords);
        } else if (sCoords) {
          setPosition(sCoords);
        } else {
          setPosition([19.0760, 72.8777]);
        }
      }
      if (trackData?.length > 0) {
        // Filter track points to only include points relevant to the current route corridor
        const validPoints = trackData
          .map((t) => [parseFloat(t.latitude), parseFloat(t.longitude)])
          .filter(([lat, lon]) => {
            if (isNaN(lat) || isNaN(lon)) return false;
            if (sCoords && dCoords && !isPointNearRoute(lat, lon, sCoords, dCoords)) return false;
            return true;
          });

        // Filter out large telemetry jumps from disjoint historical records
        const cleanTrack = [];
        for (let i = 0; i < validPoints.length; i++) {
          if (cleanTrack.length === 0) {
            cleanTrack.push(validPoints[i]);
          } else {
            const prev = cleanTrack[cleanTrack.length - 1];
            const dLat = (validPoints[i][0] - prev[0]) * 111;
            const dLon = (validPoints[i][1] - prev[1]) * 111 * Math.cos((prev[0] * Math.PI) / 180);
            const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
            if (distKm < 120) {
              cleanTrack.push(validPoints[i]);
            }
          }
        }
        setTrackHistory(cleanTrack);
      } else {
        setTrackHistory([]);
      }
      setActiveShipments(linkedShipments);

      // Load active trip & route for first in-transit shipment
      const inTransitShipment = linkedShipments.find(s => s.status === "In Transit" || s.status === "Assigned") || currentShipment;
      if (inTransitShipment) {
        const trips = await tripsApi.list(0, 20).catch(() => []);
        const tripForShipment = trips.find(t => t.shipment_id === inTransitShipment.shipment_id && t.status !== "Completed");
        if (tripForShipment) {
          setActiveTrip(tripForShipment);
          setSelectedRoute(tripForShipment.planned_route_type || "fastest");
          // Load route options for trip
          const opts = await tripsApi.getRouteOptions(tripForShipment.trip_id).catch(() => null);
          if (opts?.route_options) {
            setRouteOptions(opts.route_options);
            const routeData = opts.route_options[tripForShipment.planned_route_type || "fastest"];
            if (routeData?.coordinates) setRouteCoords(routeData.coordinates);
          }
        }
      }
    } catch (err) { console.error("Failed to load vehicle telemetry", err); }
  }, [activeVehicleId, allShipments, selectedShipmentId]);

  useEffect(() => { loadVehicleData(); }, [loadVehicleData]);

  // Auto-fetch highway driving route for selected shipment
  useEffect(() => {
    const currentShipment = allShipments.find((s) => s.shipment_id === selectedShipmentId);
    if (!currentShipment) return;

    const sCoords = resolveCoordinates(currentShipment.source, currentShipment.source_lat, currentShipment.source_lon);
    const dCoords = resolveCoordinates(currentShipment.destination, currentShipment.destination_lat, currentShipment.destination_lon);

    if (sCoords && dCoords) {
      const url = `https://router.project-osrm.org/route/v1/driving/${sCoords[1]},${sCoords[0]};${dCoords[1]},${dCoords[0]}?overview=full&geometries=geojson`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
            const coords = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            setRouteCoords(coords);
          }
        })
        .catch(() => {
          const fallback = [];
          for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            fallback.push([
              sCoords[0] + t * (dCoords[0] - sCoords[0]),
              sCoords[1] + t * (dCoords[1] - sCoords[1])
            ]);
          }
          setRouteCoords(fallback);
        });
    }
  }, [selectedShipmentId, allShipments]);

  /* WebSocket with exponential backoff reconnect */
  const connectWs = useCallback(() => {
    if (!activeVehicleId || !mountedRef.current) return;
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }

    setWsStatus("connecting");
    const ws = createTrackingWebSocket(activeVehicleId);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setWsStatus("connected");
      retryDelay.current = 1000;
      setWsAttempt(0);
      ws.send(JSON.stringify({ type: "subscribe", vehicle_id: activeVehicleId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "location_update") {
          const lat = parseFloat(data.latitude), lon = parseFloat(data.longitude);
          setPosition([lat, lon]);
          if (data.speed   !== undefined) setSpeed(parseFloat(data.speed) || 0);
          if (data.heading !== undefined) setHeading(parseFloat(data.heading) || 0);
          if (data.eta_telemetry !== undefined) setEtaTelemetry(data.eta_telemetry);
          setLastUpdated(new Date());
          setTrackHistory((prev) => [...prev, [lat, lon]]);

          // Off-route detection: if route coords available, check deviation
          if (routeCoords && routeCoords.length > 0) {
            const distToRoute = Math.min(...routeCoords.map(([rlat, rlon]) => {
              const dLat = (rlat - lat) * 111000;
              const dLon = (rlon - lon) * 111000 * Math.cos(lat * Math.PI / 180);
              return Math.sqrt(dLat * dLat + dLon * dLon);
            }));
            if (distToRoute > 500 && !isOffRoute) {
              setIsOffRoute(true);
              setRecalcNotice(true);
              toast.warning("Vehicle deviated from planned route — recalculating...", { icon: "🔄" });
            } else if (distToRoute <= 500) {
              setIsOffRoute(false);
            }
          }
        } else if (data.type === "geofence_event") {
          toast.info(`Geofence: Vehicle arrived at ${data.destination || "destination"}!`, { icon: "📍" });
        }
      } catch (err) { console.error("WS parse error", err); }
    };

    const scheduleReconnect = () => {
      if (!mountedRef.current) return;
      setWsStatus("connecting");
      setWsAttempt((a) => a + 1);
      const delay = Math.min(retryDelay.current, WS_MAX_DELAY);
      retryDelay.current = Math.min(retryDelay.current * 2, WS_MAX_DELAY);
      retryTimer.current = setTimeout(() => { if (mountedRef.current) connectWs(); }, delay);
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsStatus("disconnected");
      scheduleReconnect();
    };
  }, [activeVehicleId, routeCoords, isOffRoute]);

  useEffect(() => {
    if (!activeVehicleId) return;
    retryDelay.current = 1000;
    connectWs();
    return () => {
      clearTimeout(retryTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [activeVehicleId, connectWs]);

  const handleShipmentSelect = (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    setActiveTrip(null);
    setRouteOptions(null);
    setRouteCoords(null);
    setTrackHistory([]);
    const target = allShipments.find((s) => s.shipment_id === shipmentId);
    if (target) {
      const sCoords = resolveCoordinates(target.source, target.source_lat, target.source_lon);
      const dCoords = resolveCoordinates(target.destination, target.destination_lat, target.destination_lon);
      setPosition(target.status === "Delivered" ? dCoords : sCoords);
      if (target.vehicle_id) {
        setActiveVehicleId(target.vehicle_id);
      } else {
        toast.info("This shipment has no vehicle assigned yet.");
      }
    }
  };

  const handleRouteChange = (type) => {
    setSelectedRoute(type);
    if (routeOptions?.[type]?.coordinates) setRouteCoords(routeOptions[type].coordinates);
  };

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    setTripLoading(true);
    try {
      const updated = await tripsApi.start(activeTrip.trip_id);
      setActiveTrip(updated);
      toast.success("Trip started! Shipment is now In Transit.");
      loadVehicleData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start trip.");
    } finally {
      setTripLoading(false);
    }
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    if (!window.confirm("End this trip? The shipment will be marked as Delivered.")) return;
    setTripLoading(true);
    try {
      await tripsApi.end(activeTrip.trip_id, null);
      toast.success("Trip completed! Shipment marked as Delivered.");
      setActiveTrip(null);
      setRouteCoords(null);
      setRouteOptions(null);
      loadVehicleData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to end trip.");
    } finally {
      setTripLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!activeTrip || !position) return;
    setTripLoading(true);
    setRecalcNotice(false);
    try {
      const updated = await tripsApi.recalculate(activeTrip.trip_id, position[0], position[1]);
      setActiveTrip(updated);
      if (updated.route_geometry) {
        try { setRouteCoords(JSON.parse(updated.route_geometry)); } catch {}
      }
      setIsOffRoute(false);
      toast.success("Route recalculated from current position!");
    } catch (err) {
      toast.error("Recalculation failed. Using last known route.");
    } finally {
      setTripLoading(false);
    }
  };

  const simulatePing = () => {
    const currentShipment = allShipments.find((s) => s.shipment_id === selectedShipmentId);
    if (!currentShipment) {
      toast.warning("Please select a shipment from the dropdown first.");
      return;
    }
    const srcCoords = resolveCoordinates(currentShipment.source, currentShipment.source_lat, currentShipment.source_lon);
    const destCoords = resolveCoordinates(currentShipment.destination, currentShipment.destination_lat, currentShipment.destination_lon);

    let newLat, newLon, headingDeg;
    if (routeCoords && routeCoords.length > 5) {
      const curr = position || srcCoords;
      let closestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < routeCoords.length; i++) {
        const dLat = routeCoords[i][0] - curr[0];
        const dLon = routeCoords[i][1] - curr[1];
        const dist = dLat * dLat + dLon * dLon;
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      const stepAdvance = Math.max(1, Math.floor(routeCoords.length * 0.05));
      const stepIdx = Math.min(closestIdx + stepAdvance, routeCoords.length - 1);
      newLat = Number(routeCoords[stepIdx][0].toFixed(6));
      newLon = Number(routeCoords[stepIdx][1].toFixed(6));

      const nextPt = routeCoords[Math.min(stepIdx + 1, routeCoords.length - 1)];
      const dL = nextPt[1] - newLon;
      const y = Math.sin(dL) * Math.cos(nextPt[0]);
      const x = Math.cos(newLat) * Math.sin(nextPt[0]) - Math.sin(newLat) * Math.cos(nextPt[0]) * Math.cos(dL);
      headingDeg = Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
    } else {
      let startLat = position ? position[0] : srcCoords[0];
      let startLon = position ? position[1] : srcCoords[1];
      const step = 0.08;
      newLat = Number((startLat + (destCoords[0] - startLat) * step).toFixed(6));
      newLon = Number((startLon + (destCoords[1] - startLon) * step).toFixed(6));
      const dL = destCoords[1] - newLon;
      const y = Math.sin(dL) * Math.cos(destCoords[0]);
      const x = Math.cos(newLat) * Math.sin(destCoords[0]) - Math.sin(newLat) * Math.cos(destCoords[0]) * Math.cos(dL);
      headingDeg = Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
    }

    const simSpeed = Math.floor(Math.random() * 20) + 55;

    if (currentShipment.vehicle_id) {
      gpsApi.pushPing(currentShipment.vehicle_id, {
        latitude: newLat,
        longitude: newLon,
        speed: simSpeed,
        heading: headingDeg,
      }).catch(() => {});
    }

    const ping = { type: "location_ping", latitude: newLat, longitude: newLon, speed: simSpeed, heading: headingDeg };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(ping));
    }

    setPosition([newLat, newLon]);
    setSpeed(simSpeed);
    setHeading(headingDeg);
    setLastUpdated(new Date());
    setTrackHistory((prev) => [...prev, [newLat, newLon]]);
    toast.success(`GPS ping along route! (${newLat.toFixed(4)}, ${newLon.toFixed(4)})`, { icon: "🛰️" });
  };

  const currentShipment = allShipments.find((s) => s.shipment_id === selectedShipmentId);
  const sourceCoords    = currentShipment
    ? resolveCoordinates(currentShipment.source, currentShipment.source_lat, currentShipment.source_lon)
    : null;
  const destCoords      = currentShipment
    ? resolveCoordinates(currentShipment.destination, currentShipment.destination_lat, currentShipment.destination_lon)
    : null;
  const defaultCenter   = position || sourceCoords || [19.0760, 72.8777];
  const shipsWithVehicle = allShipments.filter((s) => s.vehicle_id);
  const activeRouteColor = ROUTE_TYPE_COLORS[selectedRoute] || "#0D9488";

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", display: "flex", flexDirection: "column", color: "#0F172A" }}>

      {/* ── Top Header Bar ── */}
      <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/shipments")}
            style={{ padding: "8px 14px", borderRadius: "10px", background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, boxShadow: "0 2px 6px rgba(15,23,42,0.04)" }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ color: "#0F172A", fontWeight: 800, fontSize: "20px", margin: 0 }}>Live Fleet Tracking</h1>
            <WsIndicator status={wsStatus} attempt={wsAttempt} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ position: "relative" }}>
            <select
              value={selectedShipmentId}
              onChange={(e) => handleShipmentSelect(e.target.value)}
              style={{ padding: "9px 36px 9px 14px", borderRadius: "10px", background: "#FFFFFF", border: "1px solid #0D9488", color: "#0D9488", fontWeight: 800, fontSize: "12px", outline: "none", cursor: "pointer", appearance: "none", boxShadow: "0 2px 8px rgba(13,148,136,0.1)" }}
            >
              <option value="">-- Select Shipment --</option>
              {allShipments.map((s) => (
                <option key={s.shipment_id} value={s.shipment_id}>
                  {s.tracking_number} ({s.source} → {s.destination}) [{s.status}]
                </option>
              ))}
            </select>
            <ChevronDown size={13} color="#0D9488" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
          <button
            onClick={simulatePing}
            style={{ padding: "9px 16px", borderRadius: "10px", background: "linear-gradient(135deg, #0D9488, #0891B2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, boxShadow: "0 4px 14px rgba(13,148,136,0.3)" }}
          >
            <Zap size={14} /> Simulate GPS Ping
          </button>
        </div>
      </div>

      {/* ── Deviation / Recalc Notice Banner ── */}
      {recalcNotice && (
        <div style={{ margin: "12px 28px 0", padding: "12px 20px", borderRadius: "12px", background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={16} color="#D97706" />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#92400E" }}>Vehicle off-route detected — route is being recalculated.</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={handleRecalculate} disabled={tripLoading} style={{ padding: "6px 14px", borderRadius: "8px", background: "#D97706", border: "none", color: "white", cursor: "pointer", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
              <RotateCcw size={12} /> Recalculate
            </button>
            <button onClick={() => setRecalcNotice(false)} style={{ padding: "6px 10px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(217,119,6,0.4)", color: "#D97706", cursor: "pointer", fontSize: "11px" }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Active Shipment Banner ── */}
      {currentShipment && (
        <div style={{ margin: "12px 28px 0", padding: "14px 20px", borderRadius: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Package size={18} color="#0D9488" />
            <div>
              <span style={{ color: "#0D9488", fontWeight: 900, fontSize: "14px", fontFamily: "monospace" }}>{currentShipment.tracking_number}</span>
              <span style={{ color: "#0F172A", fontWeight: 700, fontSize: "13px", marginLeft: "12px" }}>
                📍 {currentShipment.source} ➔ 🏁 {currentShipment.destination}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "#475569", fontSize: "12px" }}>Customer: <strong>{currentShipment.customer_name}</strong></span>
            <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: `${STATUS_COLORS[currentShipment.status] || "#64748B"}15`, color: STATUS_COLORS[currentShipment.status] || "#64748B", border: `1px solid ${STATUS_COLORS[currentShipment.status] || "#64748B"}30` }}>
              {currentShipment.status}
            </span>
          </div>
        </div>
      )}

      {/* ── Map + Sidebars ── */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", gap: "16px", padding: "16px 28px 28px", flex: 1 }}>

        {/* Left: Multi-vehicle panel + Route options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
            <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#475569", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
              <Truck size={12} /> Fleet Overview
              <span style={{ marginLeft: "auto", background: "#0D9488", color: "white", borderRadius: "10px", padding: "1px 7px", fontSize: "9px" }}>
                {shipsWithVehicle.length}
              </span>
            </h3>
            {shipsWithVehicle.length === 0 ? (
              <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0, textAlign: "center", padding: "12px 0" }}>No active fleet assignments</p>
            ) : shipsWithVehicle.map((s) => (
              <VehicleCard
                key={s.shipment_id}
                shipment={s}
                isActive={s.shipment_id === selectedShipmentId}
                onClick={() => handleShipmentSelect(s.shipment_id)}
              />
            ))}
          </div>

          {/* Route Options Selector */}
          {routeOptions && (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "14px", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
              <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#475569", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
                <Route size={12} /> Route Options
              </h3>
              {[
                { key: "fastest", label: "Fastest", icon: Zap },
                { key: "shortest", label: "Shortest", icon: Route },
                { key: "other", label: "Other", icon: Navigation },
              ].map(({ key, label, icon: Icon }) => {
                const info = routeOptions[key];
                const isActive = selectedRoute === key;
                const c = ROUTE_TYPE_COLORS[key];
                return (
                  <button
                    key={key}
                    onClick={() => handleRouteChange(key)}
                    style={{
                      width: "100%", textAlign: "left", padding: "9px 11px", borderRadius: "10px", cursor: "pointer",
                      background: isActive ? `${c}10` : "transparent",
                      border: isActive ? `1.5px solid ${c}` : "1px solid #E2E8F0",
                      marginBottom: "6px", transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <Icon size={11} color={isActive ? c : "#94A3B8"} />
                      <span style={{ fontSize: "11px", fontWeight: 800, color: isActive ? c : "#475569" }}>{label}</span>
                      {isActive && <CheckCircle2 size={10} color={c} style={{ marginLeft: "auto" }} />}
                    </div>
                    {info && (
                      <p style={{ fontSize: "10px", color: "#64748B", margin: 0 }}>
                        {info.distance_km} km · {info.duration_mins} min
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* WS reconnect info */}
          {wsStatus !== "connected" && (
            <div style={{ background: wsStatus === "connecting" ? "rgba(217,119,6,0.06)" : "rgba(220,38,38,0.06)", border: `1px solid ${wsStatus === "connecting" ? "rgba(217,119,6,0.25)" : "rgba(220,38,38,0.25)"}`, borderRadius: "12px", padding: "12px 14px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: wsStatus === "connecting" ? "#D97706" : "#DC2626", margin: "0 0 4px" }}>
                {wsStatus === "connecting" ? "Reconnecting..." : "WebSocket Offline"}
              </p>
              <p style={{ fontSize: "10px", color: "#64748B", margin: 0 }}>
                {wsStatus === "connecting" ? `Attempt ${wsAttempt + 1} with backoff` : "Check server connection"}
              </p>
            </div>
          )}
        </div>

        {/* ── Center: Leaflet Map ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", position: "relative", boxShadow: "0 4px 14px rgba(15,23,42,0.05)", minHeight: "560px" }}>
          {defaultCenter && (
            <MapContainer center={defaultCenter} zoom={7} style={{ width: "100%", height: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapRecenter center={position || defaultCenter} />

              {sourceCoords && (
                <Marker position={sourceCoords} icon={createPinIcon("#0D9488", `📍 ${currentShipment?.source}`)}>
                  <Popup>Origin: {currentShipment?.source}</Popup>
                </Marker>
              )}
              {destCoords && (
                <Marker position={destCoords} icon={createPinIcon("#059669", `🏁 ${currentShipment?.destination}`)}>
                  <Popup>Destination: {currentShipment?.destination}</Popup>
                </Marker>
              )}
              {position && (
                <Marker position={position} icon={createVehicleIcon(heading, wsStatus === "connected")}>
                  <Popup>
                    <div style={{ color: "#0F172A" }}>
                      <h4 style={{ margin: "0 0 4px", fontWeight: 800 }}>Vehicle</h4>
                      <p style={{ margin: "0 0 2px", fontSize: "12px" }}>Speed: <strong>{speed} km/h</strong></p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#64748B" }}>
                        {lastUpdated ? lastUpdated.toLocaleTimeString() : "Awaiting signal"}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* OSRM planned route overlay */}
              {routeCoords && routeCoords.length > 1 && (
                <Polyline positions={routeCoords} color={activeRouteColor} weight={4} opacity={0.75} />
              )}

              {/* Fallback straight-line route if no OSRM coords */}
              {!routeCoords && sourceCoords && destCoords && (
                <Polyline positions={[sourceCoords, position || sourceCoords, destCoords]} color="#0D9488" weight={3} opacity={0.6} dashArray="6, 10" />
              )}

              {/* Vehicle GPS track history / breadcrumb trail */}
              {trackHistory.length > 1 && (
                <Polyline positions={trackHistory} color="#0284C7" weight={4} opacity={0.9} dashArray="5, 8" />
              )}
            </MapContainer>
          )}

          {/* Trip Controls overlay */}
          {activeTrip && (
            <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", zIndex: 1000, display: "flex", gap: "10px" }}>
              {activeTrip.status === "Scheduled" && (
                <button
                  onClick={handleStartTrip}
                  disabled={tripLoading}
                  style={{ padding: "10px 20px", borderRadius: "12px", background: "linear-gradient(135deg, #0D9488, #0891B2)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 800, boxShadow: "0 4px 20px rgba(13,148,136,0.5)" }}
                >
                  <Play size={14} /> Start Trip
                </button>
              )}
              {activeTrip.status === "In Transit" && (
                <>
                  <button
                    onClick={handleRecalculate}
                    disabled={tripLoading}
                    style={{ padding: "10px 16px", borderRadius: "12px", background: "rgba(217,119,6,0.9)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700, boxShadow: "0 4px 14px rgba(217,119,6,0.4)" }}
                  >
                    <RotateCcw size={13} /> Recalculate
                  </button>
                  <button
                    onClick={handleEndTrip}
                    disabled={tripLoading}
                    style={{ padding: "10px 20px", borderRadius: "12px", background: "linear-gradient(135deg, #059669, #0D9488)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 800, boxShadow: "0 4px 20px rgba(5,150,105,0.5)" }}
                  >
                    <Square size={14} /> End Trip
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Telemetry Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Trip Status Card */}
          {activeTrip && (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
              <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#475569", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
                <Truck size={12} /> Active Trip
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#64748B" }}>Status</span>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: activeTrip.status === "In Transit" ? "#4F46E5" : "#0D9488" }}>{activeTrip.status}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#64748B" }}>Route</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: activeRouteColor }}>{(activeTrip.planned_route_type || "fastest").replace("_", " ")}</span>
                </div>
                {activeTrip.distance && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>Distance</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F172A" }}>{parseFloat(activeTrip.distance).toFixed(1)} km</span>
                  </div>
                )}
                {activeTrip.estimated_duration && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>Est. Duration</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F172A" }}>{parseFloat(activeTrip.estimated_duration).toFixed(0)} min</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live Telemetry card */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
            <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
              <Signal size={12} /> Live Telemetry
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.07), rgba(8,145,178,0.05))", padding: "12px", borderRadius: "10px", border: "1px solid rgba(13,148,136,0.15)" }}>
                <span style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, display: "block", textTransform: "uppercase" }}>Speed</span>
                <span style={{ fontSize: "22px", fontWeight: 900, color: "#0D9488" }}>{speed}</span>
                <span style={{ fontSize: "10px", color: "#64748B" }}> km/h</span>
              </div>
              <div style={{ background: "linear-gradient(135deg, rgba(79,70,229,0.07), rgba(124,58,237,0.05))", padding: "12px", borderRadius: "10px", border: "1px solid rgba(79,70,229,0.15)" }}>
                <span style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, display: "block", textTransform: "uppercase" }}>Heading</span>
                <span style={{ fontSize: "22px", fontWeight: 900, color: "#4F46E5" }}>{heading}</span>
                <span style={{ fontSize: "10px", color: "#64748B" }}>°</span>
              </div>
            </div>

            <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", marginBottom: "10px" }}>
              <span style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, display: "block", textTransform: "uppercase", marginBottom: "3px" }}>Coordinates</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>
                {position ? `${position[0].toFixed(4)}, ${position[1].toFixed(4)}` : "—"}
              </span>
            </div>

            {/* ETA Panel */}
            {etaTelemetry && (
              <div style={{ background: etaTelemetry.is_delayed ? "#FEF2F2" : "#F0FDF4", padding: "12px", borderRadius: "10px", border: `1px solid ${etaTelemetry.is_delayed ? "#FECACA" : "#BBF7D0"}`, marginBottom: "10px" }}>
                <span style={{ fontSize: "9px", color: etaTelemetry.is_delayed ? "#991B1B" : "#166534", fontWeight: 800, display: "block", textTransform: "uppercase", marginBottom: "4px" }}>Dynamic ETA</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", color: "#64748B" }}>Remaining</span>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: etaTelemetry.is_delayed ? "#7F1D1D" : "#14532D" }}>
                      {(etaTelemetry.remaining_distance_km || 0).toFixed(1)} km
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", color: "#64748B" }}>ETA</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: etaTelemetry.is_delayed ? "#7F1D1D" : "#14532D" }}>
                      {etaTelemetry.remaining_duration_mins ? `${Math.round(etaTelemetry.remaining_duration_mins)} min` : "Calculating..."}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "10px", color: "#64748B" }}>Status</span>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: etaTelemetry.is_delayed ? "#DC2626" : "#059669" }}>
                      {etaTelemetry.is_delayed ? "DELAYED" : "ON TIME"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "#64748B" }}>
              <Clock size={10} />
              Last signal: <strong>{lastUpdated ? lastUpdated.toLocaleTimeString() : "Awaiting..."}</strong>
            </div>
          </div>

          {/* Active shipments linked to vehicle */}
          {activeShipments.length > 0 && (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
              <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#475569", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <Package size={10} style={{ display: "inline", marginRight: "5px" }} />
                Linked Shipments
              </h3>
              {activeShipments.slice(0, 4).map((s) => {
                const sc = STATUS_COLORS[s.status] || "#64748B";
                return (
                  <div key={s.shipment_id} style={{ padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#0D9488", fontFamily: "monospace" }}>{s.tracking_number}</span>
                      <span style={{ fontSize: "9px", fontWeight: 700, color: sc }}>{s.status}</span>
                    </div>
                    <p style={{ fontSize: "10px", color: "#64748B", margin: "2px 0 0" }}>{s.source} → {s.destination}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Track stats */}
          {trackHistory.length > 0 && (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px", boxShadow: "0 2px 8px rgba(15,23,42,0.04)" }}>
              <h3 style={{ fontSize: "10px", fontWeight: 800, color: "#475569", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Track History</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "4px", borderRadius: "2px", background: "#4F46E5" }} />
                <span style={{ fontSize: "11px", color: "#475569" }}><strong>{trackHistory.length}</strong> GPS points logged</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackingMap;
