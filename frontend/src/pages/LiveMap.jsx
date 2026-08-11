import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import Navbar from '../components/layout/Navbar';
import { createLocationSocket } from '../api/socket';
import { getTrips, getTripById, getLatestLocations, sendSimulatedPing, recalculateTrip } from '../api/trips';
import { getShipmentById, getShipments } from '../api/shipments';
import { toast } from 'react-toastify';
import { 
  Radio, 
  Play, 
  RotateCw, 
  MapPin, 
  Truck, 
  Clock, 
  Navigation, 
  Gauge, 
  ShieldAlert, 
  CheckCircle2 
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './LiveMap.css';

// Fix standard Leaflet marker icons in React/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom vehicle pulse marker
const createVehicleIcon = (status = 'In Transit') => {
  return L.divIcon({
    className: 'custom-vehicle-marker-wrapper',
    html: `
      <div class="vehicle-marker-pin ${status === 'Delayed' ? 'delayed' : ''}">
        <div class="marker-pulse"></div>
        <div class="marker-center">🚛</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
};

const createHubIcon = (type = 'origin') => {
  return L.divIcon({
    className: 'custom-hub-marker',
    html: `
      <div class="hub-pin ${type}">
        <span>${type === 'origin' ? 'A' : 'B'}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Component to dynamically fit bounds to the route
function MapBoundsUpdater({ polylineCoords }) {
  const map = useMap();
  useEffect(() => {
    if (polylineCoords && polylineCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(polylineCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } catch (e) {}
    }
  }, [polylineCoords, map]);
  return null;
}

export default function LiveMap() {
  const [searchParams] = useSearchParams();
  const tripParam = searchParams.get('trip');
  const shipmentParam = searchParams.get('shipment');

  const [activeTrip, setActiveTrip] = useState(null);
  const [activeShipment, setActiveShipment] = useState(null);
  const [allTrips, setAllTrips] = useState([]);
  
  // Real-time states
  const [vehiclePositions, setVehiclePositions] = useState({});
  const [liveEta, setLiveEta] = useState(null);
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [wsStatus, setWsStatus] = useState('Connecting...');
  const [geofenceAlert, setGeofenceAlert] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);

  const socketRef = useRef(null);
  const simTimerRef = useRef(null);

  // Initialize data and selected trip/shipment
  const loadInitialData = useCallback(async () => {
    try {
      const [tripsRes, locRes] = await Promise.all([
        getTrips(),
        getLatestLocations(),
      ]);
      setAllTrips(tripsRes.data);

      // Populate initial positions
      const initialMap = {};
      locRes.data.forEach((loc) => {
        initialMap[loc.vehicle_id] = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          speed: loc.speed,
          status: loc.status,
          registration: loc.registration_number,
        };
      });
      setVehiclePositions(initialMap);

      // If URL param provided, select target trip
      if (tripParam) {
        const t = tripsRes.data.find((item) => item.trip_id === tripParam);
        if (t) setActiveTrip(t);
      } else if (shipmentParam) {
        const sRes = await getShipmentById(shipmentParam);
        setActiveShipment(sRes.data);
        const matchingTrip = tripsRes.data.find((item) => item.shipment_id === shipmentParam);
        if (matchingTrip) setActiveTrip(matchingTrip);
      } else if (tripsRes.data.length > 0) {
        setActiveTrip(tripsRes.data[0]);
      }
    } catch (err) {
      console.error('Failed to load live map initial state:', err);
    }
  }, [tripParam, shipmentParam]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // WebSocket Subscription
  useEffect(() => {
    socketRef.current = createLocationSocket(
      (message) => {
        if (message.type === 'location_update' && message.data) {
          const data = message.data;
          setVehiclePositions((prev) => ({
            ...prev,
            [data.vehicle_id]: {
              latitude: data.latitude,
              longitude: data.longitude,
              speed: data.speed,
              status: data.status,
            },
          }));

          setLiveSpeed(data.speed || 0);

          if (data.eta) {
            setLiveEta(data.eta);
          }

          if (data.geofence) {
            setGeofenceAlert(data.geofence.message);
            toast.info(`Geofence Alert: ${data.geofence.message}`);
          }
        }
      },
      () => setWsStatus('Live WebSocket Connected'),
      () => setWsStatus('WebSocket Disconnected'),
      () => setWsStatus('Connection Error')
    );

    return () => {
      socketRef.current?.close();
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  // Extract Route Polyline Coordinates
  const routePolyline = useMemo(() => {
    if (!activeTrip || !activeTrip.route_geometry) {
      return [];
    }
    if (Array.isArray(activeTrip.route_geometry)) {
      return activeTrip.route_geometry;
    }
    if (activeTrip.route_geometry.coordinates) {
      return activeTrip.route_geometry.coordinates.map((c) => [c[1], c[0]]);
    }
    return [];
  }, [activeTrip]);

  // Get Route Color by profile
  const getRouteColor = (type) => {
    if (type === 'fastest') return '#38bdf8'; // Cyan/Blue
    if (type === 'shortest') return '#a78bfa'; // Purple
    if (type === 'traffic_avoidance') return '#f59e0b'; // Amber
    return '#10b981'; // Emerald/Green for fuel-efficient
  };

  // Start GPS Simulation Stream along the route
  const startGpsSimulation = () => {
    if (isSimulating) {
      clearInterval(simTimerRef.current);
      setIsSimulating(false);
      return;
    }

    if (!activeTrip || routePolyline.length === 0) {
      toast.error('No active route to simulate.');
      return;
    }

    setIsSimulating(true);
    let step = simIndex;

    toast.info('Starting Live GPS Stream simulation...');

    simTimerRef.current = setInterval(async () => {
      if (step >= routePolyline.length) {
        clearInterval(simTimerRef.current);
        setIsSimulating(false);
        setSimIndex(0);
        toast.success('Simulation completed: Vehicle arrived at destination.');
        return;
      }

      const point = routePolyline[step];
      const vehicleId = activeTrip?.vehicle_id || '00000000-0000-0000-0000-000000000001';

      try {
        await sendSimulatedPing({
          vehicle_id: vehicleId,
          shipment_id: activeTrip?.shipment_id || null,
          trip_id: activeTrip?.trip_id || null,
          latitude: point[0],
          longitude: point[1],
          speed: Math.round(55 + Math.random() * 20),
          heading: 140.0,
        });
      } catch (e) {}

      step += 1;
      setSimIndex(step);
    }, 1500);
  };

  // Handle Route Recalculation Trigger
  const handleRecalculate = async () => {
    if (!activeTrip || routePolyline.length === 0) return;
    const currentLoc = activeTrip.vehicle_id ? vehiclePositions[activeTrip.vehicle_id] : null;
    const lat = currentLoc ? currentLoc.latitude : routePolyline[0][0];
    const lng = currentLoc ? currentLoc.longitude : routePolyline[0][1];

    try {
      const res = await recalculateTrip(activeTrip.trip_id, lat, lng, activeTrip.route_type);
      setActiveTrip(res.data);
      toast.success('Route recalculated successfully.');
    } catch (err) {
      toast.error('Failed to recalculate route.');
    }
  };

  const activeVehiclePos = activeTrip?.vehicle_id && vehiclePositions[activeTrip.vehicle_id]
    ? [vehiclePositions[activeTrip.vehicle_id].latitude, vehiclePositions[activeTrip.vehicle_id].longitude]
    : isSimulating && routePolyline.length > 0
      ? routePolyline[Math.min(simIndex, routePolyline.length - 1)]
      : null;

  const mapCenter = activeVehiclePos || (routePolyline.length > 0 ? routePolyline[0] : [20.0, 0.0]);
  const mapZoom = routePolyline.length > 0 || activeVehiclePos ? 10 : 2;

  return (
    <div className="live-map-page-wrapper">
      <Navbar />

      <main className="map-page-body">
        {/* Left Side Control HUD */}
        <aside className="map-control-sidebar ff-card">
          <div className="sidebar-section">
            <div className="ws-status-badge">
              <Radio size={14} className="live-pulse-dot" />
              <span>{wsStatus}</span>
            </div>
            <h2>Live Tracking HUD</h2>
            <p className="sidebar-sub">Real-Time Vehicle Position & Route Telemetry</p>
          </div>

          {/* Active Trip Selector */}
          <div className="sidebar-section">
            <label className="form-label">Active Dispatched Trip</label>
            {allTrips.length === 0 ? (
              <select className="form-select" disabled value="">
                <option value="">No active trips found</option>
              </select>
            ) : (
              <select
                className="form-select"
                value={activeTrip?.trip_id || ''}
                onChange={(e) => {
                  const t = allTrips.find((item) => item.trip_id === e.target.value);
                  setActiveTrip(t || null);
                  setSimIndex(0);
                }}
              >
                {allTrips.map((t) => (
                  <option key={t.trip_id} value={t.trip_id}>
                    {t.start_location} → {t.destination} ({t.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Telemetry Metrics */}
          <div className="telemetry-grid">
            <div className="telemetry-card">
              <div className="tel-icon"><Gauge size={18} color="#38bdf8" /></div>
              <div className="tel-info">
                <span className="tel-label">Live Speed</span>
                <span className="tel-val">{activeTrip ? `${liveSpeed} km/h` : 'N/A'}</span>
              </div>
            </div>

            <div className="telemetry-card">
              <div className="tel-icon"><Navigation size={18} color="#a78bfa" /></div>
              <div className="tel-info">
                <span className="tel-label">Remaining Dist</span>
                <span className="tel-val">
                  {activeTrip
                    ? (liveEta?.remaining_distance_km ? `${liveEta.remaining_distance_km} km` : `${activeTrip?.planned_distance_km || 0} km`)
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="telemetry-card">
              <div className="tel-icon"><Clock size={18} color="#34d399" /></div>
              <div className="tel-info">
                <span className="tel-label">Live ETA</span>
                <span className="tel-val">
                  {activeTrip
                    ? (liveEta?.eta ? new Date(liveEta.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Calculating...')
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div className="telemetry-card">
              <div className="tel-icon"><Truck size={18} color="#f59e0b" /></div>
              <div className="tel-info">
                <span className="tel-label">Route Profile</span>
                <span className="tel-val" style={{ textTransform: 'capitalize' }}>
                  {activeTrip?.route_type || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Geofence Notice */}
          {geofenceAlert && (
            <div className="geofence-alert-box">
              <ShieldAlert size={18} color="#fbbf24" />
              <span>{geofenceAlert}</span>
            </div>
          )}

          {/* Simulation & Recalculate Controls */}
          <div className="map-action-controls">
            <button
              className={`btn ${isSimulating ? 'btn-danger' : 'btn-primary'}`}
              onClick={startGpsSimulation}
              disabled={!activeTrip || routePolyline.length === 0}
              style={{ width: '100%' }}
            >
              <Play size={16} />
              <span>{isSimulating ? 'Pause GPS Stream' : 'Simulate Live GPS Stream'}</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleRecalculate}
              disabled={!activeTrip || routePolyline.length === 0}
              style={{ width: '100%' }}
            >
              <RotateCw size={16} />
              <span>Recalculate Route</span>
            </button>
          </div>
        </aside>

        {/* Map Container View */}
        <section className="map-view-container" style={{ position: 'relative' }}>
          {(!activeTrip || routePolyline.length === 0) && (
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 20px',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '0.9rem',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <MapPin size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              No live vehicle locations available.
            </div>
          )}

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            className="leaflet-full-frame"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Auto fit bounds to active route */}
            {routePolyline.length > 0 && <MapBoundsUpdater polylineCoords={routePolyline} />}

            {/* Origin Pin */}
            {routePolyline.length > 0 && (
              <Marker position={routePolyline[0]} icon={createHubIcon('origin')}>
                <Popup>
                  <strong>Origin: {activeTrip?.start_location || 'Pickup Point'}</strong>
                </Popup>
              </Marker>
            )}

            {/* Destination Pin */}
            {routePolyline.length > 1 && (
              <Marker position={routePolyline[routePolyline.length - 1]} icon={createHubIcon('dest')}>
                <Popup>
                  <strong>Destination: {activeTrip?.destination || 'Dropoff Point'}</strong>
                </Popup>
              </Marker>
            )}

            {/* Optimized Route Polyline */}
            {routePolyline.length > 0 && (
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: getRouteColor(activeTrip?.route_type),
                  weight: 5,
                  opacity: 0.85,
                  dashArray: activeTrip?.route_type === 'traffic_avoidance' ? '8, 8' : undefined,
                }}
              />
            )}

            {/* Live Vehicle Marker */}
            {activeVehiclePos && (
              <Marker
                position={activeVehiclePos}
                icon={createVehicleIcon(activeTrip?.status)}
              >
                <Popup>
                  <div className="map-popup-card">
                    <h4>Fleet Vehicle 🚛</h4>
                    <p>Status: <strong>{activeTrip?.status || 'In Transit'}</strong></p>
                    <p>Speed: <strong>{liveSpeed} km/h</strong></p>
                    <p>Profile: <strong>{activeTrip?.route_type || 'N/A'}</strong></p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </section>
      </main>
    </div>
  );
}
