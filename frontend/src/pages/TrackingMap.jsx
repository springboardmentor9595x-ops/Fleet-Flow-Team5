import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { gpsApi, createTrackingWebSocket } from "../api/gps";
import shipmentsApi from "../api/shipments";
import {
  Truck, MapPin, Navigation, Zap, Wifi, WifiOff, RefreshCw,
  ArrowLeft, AlertTriangle, CheckCircle2, Compass, Package, ChevronDown,
  Radio, Signal, SignalHigh, Clock
} from "lucide-react";
import { toast } from "react-toastify";


const CITY_COORDS = {
  kollam: [8.8932, 76.6141], mumbai: [19.0760, 72.8777], pune: [18.5204, 73.8567],
  delhi: [28.6139, 77.2090], bangalore: [12.9716, 77.5946], chennai: [13.0827, 80.2707],
  hyderabad: [17.3850, 78.4867], kolkata: [22.5726, 88.3639],
};
const WS_MAX_DELAY = 30000;
const STATUS_COLORS = {
  Created: "#64748B", Assigned: "#0D9488", "In Transit": "#4F46E5",
  Delivered: "#059669", Delayed: "#D97706", Cancelled: "#DC2626",
};

function getCityCoords(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(city)) return coords;
  }
  return null;
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

/* ── WS Status indicator ─────────────────────────────────────────────────── */
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

/* ── Multi-vehicle overview card ────────────────────────────────────────── */
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
      {shipment.customer_name && (
        <p style={{ fontSize: "10px", color: "#64748B", margin: "2px 0 0" }}>{shipment.customer_name}</p>
      )}
    </div>
  );
};

/* ── Main Component ─────────────────────────────────────────────────────── */
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

  /* Load vehicle telemetry */
  const loadVehicleData = useCallback(async () => {
    if (!activeVehicleId) return;
    try {
      const [posData, trackData, linkedShipments] = await Promise.all([
        gpsApi.getLatest(activeVehicleId).catch(() => null),
        gpsApi.getTrack(activeVehicleId, 50).catch(() => []),
        shipmentsApi.getByVehicle(activeVehicleId).catch(() => []),
      ]);
      if (posData) {
        const lat = parseFloat(posData.latitude), lon = parseFloat(posData.longitude);
        setPosition([lat, lon]);
        if (posData.speed)   setSpeed(parseFloat(posData.speed));
        if (posData.heading) setHeading(parseFloat(posData.heading));
        setLastUpdated(new Date(posData.recorded_time));
      } else {
        const matched = linkedShipments[0] || allShipments.find(s => s.shipment_id === selectedShipmentId);
        const originCoords = matched ? getCityCoords(matched.source) : null;
        setPosition(originCoords || [19.0760, 72.8777]);
      }
      if (trackData?.length > 0) setTrackHistory(trackData.map(t => [parseFloat(t.latitude), parseFloat(t.longitude)]));
      setActiveShipments(linkedShipments);
    } catch (err) { console.error("Failed to load vehicle telemetry", err); }
  }, [activeVehicleId, allShipments, selectedShipmentId]);

  useEffect(() => { loadVehicleData(); }, [loadVehicleData]);

  /* ── WebSocket with exponential backoff reconnect ── */
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
          if (data.speed   !== undefined) setSpeed(parseFloat(data.speed));
          if (data.heading !== undefined) setHeading(parseFloat(data.heading));
          if (data.eta_telemetry !== undefined) setEtaTelemetry(data.eta_telemetry);
          setLastUpdated(new Date());
          setTrackHistory((prev) => [...prev, [lat, lon]]);
        } else if (data.type === "geofence_event") {
          toast.info(`🔔 Geofence Alert: Vehicle arrived at ${data.destination || "destination"}!`);
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
  }, [activeVehicleId]);

  useEffect(() => {
    if (!activeVehicleId) return;
    retryDelay.current = 1000;
    connectWs();
    return () => {
      clearTimeout(retryTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [activeVehicleId, connectWs]);

  /* ── Handlers ── */
  const handleShipmentSelect = (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    const target = allShipments.find((s) => s.shipment_id === shipmentId);
    if (target?.vehicle_id) setActiveVehicleId(target.vehicle_id);
    else toast.info("This shipment has no vehicle assigned yet.");
  };

  const simulatePing = () => {
    const currentShipment = allShipments.find((s) => s.shipment_id === selectedShipmentId);
    const destCoords = currentShipment ? getCityCoords(currentShipment.destination) : [19.0760, 72.8777];
    let newLat, newLon;
    if (destCoords && position) {
      newLat = position[0] + (destCoords[0] - position[0]) * 0.08 + (Math.random() - 0.5) * 0.01;
      newLon = position[1] + (destCoords[1] - position[1]) * 0.08 + (Math.random() - 0.5) * 0.01;
    } else {
      newLat = (position?.[0] ?? 19.0760) + 0.01;
      newLon = (position?.[1] ?? 72.8777) + 0.01;
    }
    const ping = { type: "location_ping", latitude: newLat, longitude: newLon, speed: Math.floor(Math.random() * 35) + 45, heading: 35 };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(ping));
    } else {
      setPosition([newLat, newLon]); setSpeed(ping.speed); setHeading(ping.heading); setLastUpdated(new Date());
    }
    toast.success("📡 GPS ping sent!");
  };

  const currentShipment = allShipments.find((s) => s.shipment_id === selectedShipmentId);
  const sourceCoords    = currentShipment ? getCityCoords(currentShipment.source)      : null;
  const destCoords      = currentShipment ? getCityCoords(currentShipment.destination) : null;
  const defaultCenter   = position || sourceCoords || [19.0760, 72.8777];
  const shipsWithVehicle = allShipments.filter((s) => s.vehicle_id);

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "#F8FAFC", display: "flex", flexDirection: "column", gap: 0, color: "#0F172A" }}>

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

      {/* ── Active Shipment Banner ── */}
      {currentShipment && (
        <div style={{ margin: "14px 28px 0", padding: "14px 20px", borderRadius: "12px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 240px", gap: "16px", padding: "16px 28px 28px", flex: 1 }}>

        {/* ── Left: Multi-vehicle overview panel ── */}
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
              {sourceCoords && destCoords && (
                <Polyline positions={[sourceCoords, position || sourceCoords, destCoords]} color="#0D9488" weight={3} opacity={0.6} dashArray="6, 10" />
              )}
              {trackHistory.length > 1 && (
                <Polyline positions={trackHistory} color="#4F46E5" weight={5} opacity={0.85} />
              )}
            </MapContainer>
          )}
        </div>

        {/* ── Right: Telemetry Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

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

            {etaTelemetry && (
              <div style={{ background: etaTelemetry.is_delayed ? "#FEF2F2" : "#F0FDF4", padding: "10px 12px", borderRadius: "10px", border: `1px solid ${etaTelemetry.is_delayed ? "#FECACA" : "#BBF7D0"}`, marginBottom: "10px" }}>
                <span style={{ fontSize: "9px", color: etaTelemetry.is_delayed ? "#991B1B" : "#166534", fontWeight: 800, display: "block", textTransform: "uppercase", marginBottom: "3px" }}>Dynamic ETA</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: etaTelemetry.is_delayed ? "#7F1D1D" : "#14532D", fontFamily: "monospace", display: "block" }}>
                  {etaTelemetry.distance_remaining_km.toFixed(1)} km left
                </span>
                <div style={{ fontSize: "10px", fontWeight: 600, color: etaTelemetry.is_delayed ? "#991B1B" : "#166534", marginTop: "4px" }}>
                  Status: {etaTelemetry.is_delayed ? <strong>Delayed</strong> : <strong>On Time</strong>}
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
