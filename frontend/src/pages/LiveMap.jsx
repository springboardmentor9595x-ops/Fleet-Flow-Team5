import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { createLocationSocket } from '../api/socket';
import { getTrips, getLatestLocations, sendSimulatedPing, recalculateTrip, calculateRoutes } from '../api/trips';
import { getShipmentTracking } from '../api/shipments';
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
  Package,
  User,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
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

// Component to dynamically fit bounds or center map accurately
function MapBoundsUpdater({ polylineCoords, centerPos, shipmentSource, shipmentDest }) {
  const map = useMap();
  useEffect(() => {
    if (centerPos) {
      map.setView(centerPos, 13, { animate: true });
    } else if (polylineCoords && polylineCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(polylineCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } catch (e) {}
    } else if (shipmentSource && shipmentSource[0] && shipmentSource[1]) {
      try {
        if (shipmentDest && shipmentDest[0] && shipmentDest[1]) {
          const bounds = L.latLngBounds([shipmentSource, shipmentDest]);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
        } else {
          map.setView(shipmentSource, 12, { animate: true });
        }
      } catch (e) {}
    }
  }, [polylineCoords, centerPos, shipmentSource, shipmentDest, map]);
  return null;
}

// Great-circle distance between two points (km)
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Compute remaining distance along route polyline or fallback
const calculateRemainingDistance = (currentLat, currentLng, destLat, destLng, polylineCoords) => {
  if (currentLat === undefined || currentLat === null || currentLng === undefined || currentLng === null) return null;
  
  if (polylineCoords && polylineCoords.length > 1) {
    let minIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < polylineCoords.length; i++) {
      const d = haversineDistance(currentLat, currentLng, polylineCoords[i][0], polylineCoords[i][1]);
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    }
    
    let distSum = 0;
    let prevPt = [currentLat, currentLng];
    for (let i = minIdx; i < polylineCoords.length; i++) {
      distSum += haversineDistance(prevPt[0], prevPt[1], polylineCoords[i][0], polylineCoords[i][1]);
      prevPt = polylineCoords[i];
    }
    return Math.max(distSum, 0.1);
  }

  if (destLat && destLng) {
    return haversineDistance(currentLat, currentLng, destLat, destLng) * 1.25;
  }

  return null;
};

// Format remaining ETA into human readable format (2h 35m, 45m, 12m)
const formatRemainingEta = (remainingKm, speedKmh) => {
  if (remainingKm === null || remainingKm === undefined) return null;
  if (remainingKm <= 0.05) return 'Arriving now';
  
  const speed = speedKmh && speedKmh >= 5 ? speedKmh : 50.0;
  const totalMins = Math.round((remainingKm / speed) * 60);
  
  if (totalMins <= 0) return '1m';
  if (totalMins < 60) return `${totalMins}m`;
  
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours}h ${mins < 10 ? '0' : ''}${mins}m` : `${hours}h`;
};

export default function LiveMap() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tripParam = searchParams.get('trip');
  const shipmentParam = searchParams.get('shipment');
  const initialTab = searchParams.get('tab') || (tripParam || shipmentParam ? 'active_trips' : 'fleet_map');
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('tab', tabId);
      return newParams;
    });
  };

  const [activeTrip, setActiveTrip] = useState(null);
  const [activeShipment, setActiveShipment] = useState(null);
  const [assignedDriver, setAssignedDriver] = useState(null);
  const [assignedVehicle, setAssignedVehicle] = useState(null);
  const [backendTrackingDetail, setBackendTrackingDetail] = useState(null);
  const [trackingState, setTrackingState] = useState(null);
  const [trackingMessage, setTrackingMessage] = useState(null);
  const [allTrips, setAllTrips] = useState([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [routeProfile, setRouteProfile] = useState('fastest');
  
  // Real-time states
  const [vehiclePositions, setVehiclePositions] = useState({});
  const [liveEta, setLiveEta] = useState(null);
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [wsStatus, setWsStatus] = useState('Connecting...');
  const [geofenceAlert, setGeofenceAlert] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [isChangingProfile, setIsChangingProfile] = useState(false);

  const socketRef = useRef(null);
  const simTimerRef = useRef(null);

  const canTrackFleet = user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Dispatcher';

  // Initialize data and selected trip/shipment
  const loadInitialData = useCallback(async () => {
    try {
      const fetchPromises = [getTrips()];
      if (canTrackFleet) {
        fetchPromises.push(getLatestLocations());
      }

      const results = await Promise.all(fetchPromises);
      const tripsRes = results[0];
      const locRes = canTrackFleet ? results[1] : null;

      setAllTrips(tripsRes.data || []);

      // Populate initial positions
      const initialMap = {};
      if (canTrackFleet && locRes?.data) {
        locRes.data.forEach((loc) => {
          initialMap[loc.vehicle_id] = {
            latitude: loc.latitude,
            longitude: loc.longitude,
            speed: loc.speed,
            status: loc.status,
            registration: loc.registration_number,
            updated_at: loc.updated_at || loc.timestamp,
          };
        });
      }
      setVehiclePositions(initialMap);

      // If shipment URL param provided, load authoritative tracking endpoint
      if (shipmentParam) {
        setIsLoadingTracking(true);
        try {
          const tRes = await getShipmentTracking(shipmentParam);
          const data = tRes.data;
          setBackendTrackingDetail(data);
          setActiveShipment(data.shipment);
          setAssignedDriver(data.driver);
          setAssignedVehicle(data.vehicle);
          if (data.trip) {
            setActiveTrip(data.trip);
            if (data.trip.route_type) setRouteProfile(data.trip.route_type);
          }
          setTrackingState(data.tracking_state);
          setTrackingMessage(data.message);

          if (data.vehicle && data.tracking) {
            setVehiclePositions((prev) => ({
              ...prev,
              [data.vehicle.vehicle_id]: {
                latitude: data.tracking.latitude,
                longitude: data.tracking.longitude,
                speed: data.tracking.speed,
                status: data.shipment.status,
                registration: data.vehicle.registration_number,
                updated_at: data.tracking.recorded_time,
              },
            }));
            setLiveSpeed(data.tracking.speed || 0);
          }
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Unable to load shipment tracking information.');
          setTrackingState('error');
          setTrackingMessage('Unable to load tracking information. Please try again.');
        } finally {
          setIsLoadingTracking(false);
        }
      } else if (tripParam) {
        const t = (tripsRes.data || []).find((item) => item.trip_id === tripParam);
        if (t) {
          setActiveTrip(t);
          if (t.route_type) setRouteProfile(t.route_type);
        }
      } else if (tripsRes.data && tripsRes.data.length > 0) {
        setActiveTrip(tripsRes.data[0]);
        if (tripsRes.data[0].route_type) setRouteProfile(tripsRes.data[0].route_type);
      }
    } catch (err) {
      console.error('Failed to load live map initial state:', err);
    }
  }, [tripParam, shipmentParam, canTrackFleet]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // WebSocket Subscription
  useEffect(() => {
    if (!canTrackFleet) {
      setWsStatus('Driver Mode: Assigned Route Tracking');
      return;
    }

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
              registration: data.registration_number || prev[data.vehicle_id]?.registration,
              updated_at: data.updated_at || new Date().toISOString(),
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
  }, [canTrackFleet]);

  // Handle Clear Filter
  const handleClearFilter = () => {
    setActiveShipment(null);
    setAssignedDriver(null);
    setAssignedVehicle(null);
    setBackendTrackingDetail(null);
    setTrackingState(null);
    setTrackingMessage(null);
    setSearchParams({});
  };

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
    if (type === 'fastest') return '#22D3EE';
    if (type === 'shortest') return '#A78BFA';
    if (type === 'traffic_avoidance') return '#FBBF24';
    if (type === 'fuel_efficient') return '#34D399';
    return '#60A5FA';
  };

  // Start GPS Simulation Stream for active vehicle
  const startGpsSimulation = () => {
    if (isSimulating) {
      clearInterval(simTimerRef.current);
      setIsSimulating(false);
      return;
    }

    if (!activeTrip || routePolyline.length === 0) {
      toast.error('No active route geometry available for simulation.');
      return;
    }

    const targetVehicleId = assignedVehicle?.vehicle_id || activeTrip?.vehicle_id;
    if (!targetVehicleId) {
      toast.error('No assigned vehicle available for simulation.');
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

      try {
        const currentSpeed = Math.round(55 + Math.random() * 20);
        await sendSimulatedPing({
          vehicle_id: targetVehicleId,
          shipment_id: activeShipment?.shipment_id || null,
          trip_id: activeTrip?.trip_id || null,
          latitude: point[0],
          longitude: point[1],
          speed: currentSpeed,
          heading: 140.0,
        });

        // Update local position dynamically
        setVehiclePositions((prev) => ({
          ...prev,
          [targetVehicleId]: {
            latitude: point[0],
            longitude: point[1],
            speed: currentSpeed,
            status: activeShipment?.status || 'In Transit',
            registration: assignedVehicle?.registration_number || prev[targetVehicleId]?.registration,
            updated_at: new Date().toISOString(),
          },
        }));

        setLiveSpeed(currentSpeed);

        if (trackingState !== 'live_tracking_active') {
          setTrackingState('live_tracking_active');
          setTrackingMessage('Live Tracking Active');
        }
      } catch (e) {}

      step += 1;
      setSimIndex(step);
    }, 1500);
  };

  // Recalculate route
  const handleRecalculate = async () => {
    if (!activeTrip || routePolyline.length === 0) return;
    const targetVehId = assignedVehicle?.vehicle_id || activeTrip?.vehicle_id;
    const currentLoc = targetVehId ? vehiclePositions[targetVehId] : null;
    const lat = currentLoc ? currentLoc.latitude : routePolyline[0][0];
    const lng = currentLoc ? currentLoc.longitude : routePolyline[0][1];

    try {
      const res = await recalculateTrip(activeTrip.trip_id, lat, lng, routeProfile);
      setActiveTrip(res.data);
      setAllTrips((prev) =>
        prev.map((t) => (t.trip_id === res.data.trip_id ? res.data : t))
      );
      toast.success('Route recalculated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to recalculate route.');
    }
  };

  // Handle Route Profile change dropdown
  const handleProfileChange = async (newType) => {
    if (!newType || newType === routeProfile) return;
    setRouteProfile(newType);

    const targetVehId = assignedVehicle?.vehicle_id || activeTrip?.vehicle_id;
    const currentLoc = targetVehId ? vehiclePositions[targetVehId] : null;
    const lat = currentLoc ? currentLoc.latitude : (routePolyline.length > 0 ? routePolyline[0][0] : activeTrip?.start_lat || activeShipment?.source_lat);
    const lng = currentLoc ? currentLoc.longitude : (routePolyline.length > 0 ? routePolyline[0][1] : activeTrip?.start_lng || activeShipment?.source_lng);

    setIsChangingProfile(true);
    try {
      if (activeTrip?.trip_id) {
        const res = await recalculateTrip(activeTrip.trip_id, lat, lng, newType);
        setActiveTrip(res.data);
        setAllTrips((prev) =>
          prev.map((t) => (t.trip_id === res.data.trip_id ? res.data : t))
        );
      } else if (activeShipment) {
        const destLat = activeShipment.dest_lat || activeTrip?.dest_lat;
        const destLng = activeShipment.dest_lng || activeTrip?.dest_lng;
        const res = await calculateRoutes(activeShipment.source, activeShipment.destination, {
          start_lat: lat,
          start_lng: lng,
          dest_lat: destLat,
          dest_lng: destLng,
        });
        const selected = res.data.routes?.find((r) => r.route_type === newType) || res.data.routes?.[0];
        if (selected) {
          setActiveTrip((prev) => ({
            ...(prev || {}),
            route_geometry: selected.coordinates,
            planned_distance_km: selected.distance_km,
            planned_duration_min: selected.duration_min,
            route_type: newType,
          }));
        }
      }
      setSimIndex(0);
      const profileLabel = newType.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      toast.success(`Route profile switched to ${profileLabel}.`);
    } catch (err) {
      toast.error('Failed to switch route profile.');
    } finally {
      setIsChangingProfile(false);
    }
  };

  // Selected Target Asset Telemetry
  const selectedVehicleId = assignedVehicle?.vehicle_id || activeShipment?.vehicle_id || activeTrip?.vehicle_id;
  const shipmentLocation = selectedVehicleId ? vehiclePositions[selectedVehicleId] : null;
  const hasGpsLocation = Boolean(shipmentLocation && shipmentLocation.latitude && shipmentLocation.longitude);

  const activeVehiclePos = hasGpsLocation
    ? [shipmentLocation.latitude, shipmentLocation.longitude]
    : isSimulating && routePolyline.length > 0
      ? routePolyline[Math.min(simIndex, routePolyline.length - 1)]
      : null;

  const destLat = activeTrip?.dest_lat || activeShipment?.dest_lat || (routePolyline.length > 0 ? routePolyline[routePolyline.length - 1][0] : null);
  const destLng = activeTrip?.dest_lng || activeShipment?.dest_lng || (routePolyline.length > 0 ? routePolyline[routePolyline.length - 1][1] : null);

  // Real Remaining Distance calculation
  const remainingKm = hasGpsLocation
    ? calculateRemainingDistance(shipmentLocation.latitude, shipmentLocation.longitude, destLat, destLng, routePolyline)
    : backendTrackingDetail?.remaining_distance_km !== undefined && backendTrackingDetail?.remaining_distance_km !== null
    ? backendTrackingDetail.remaining_distance_km
    : null;

  // Real Remaining ETA calculation
  const currentSpeed = shipmentLocation?.speed || liveSpeed || backendTrackingDetail?.tracking?.speed || 0;
  const remainingEtaText = hasGpsLocation && remainingKm !== null
    ? formatRemainingEta(remainingKm, currentSpeed)
    : backendTrackingDetail?.remaining_eta_text
    ? backendTrackingDetail.remaining_eta_text
    : null;

  // Last Ping timestamp
  const lastPingTime = shipmentLocation?.updated_at
    ? new Date(shipmentLocation.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : backendTrackingDetail?.tracking?.recorded_time
    ? new Date(backendTrackingDetail.tracking.recorded_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Telemetry status text display helpers
  const getRemainingDistanceDisplay = () => {
    if (activeShipment && trackingState === 'unassigned') return 'No vehicle assigned';
    if (!activeTrip && !activeShipment) return 'No active trip';
    if (routePolyline.length === 0 && !destLat) return 'Route unavailable';
    if (!hasGpsLocation) return 'Waiting for GPS';
    if (remainingKm !== null) return `${remainingKm.toFixed(1)} km`;
    return 'Route unavailable';
  };

  const getRemainingEtaDisplay = () => {
    if (activeShipment && trackingState === 'unassigned') return 'No vehicle assigned';
    if (!activeTrip && !activeShipment) return 'No active trip';
    if (routePolyline.length === 0 && !destLat) return 'Route unavailable';
    if (!hasGpsLocation) return 'Waiting for GPS';
    if (remainingEtaText) return remainingEtaText;
    return 'Route unavailable';
  };

  const getLastPingDisplay = () => {
    if (!hasGpsLocation) return 'Waiting for GPS';
    if (lastPingTime) return lastPingTime;
    return 'Waiting for GPS';
  };

  const getSpeedDisplay = () => {
    if (!hasGpsLocation) return 'Waiting for GPS';
    return `${currentSpeed} km/h`;
  };

  const firstAvailableVehiclePos = Object.values(vehiclePositions).find((p) => p.latitude && p.longitude);
  const mapCenter = activeVehiclePos 
    || (routePolyline.length > 0 ? routePolyline[0] : null)
    || (firstAvailableVehiclePos ? [firstAvailableVehiclePos.latitude, firstAvailableVehiclePos.longitude] : [20.0, 78.0]);
  const mapZoom = activeVehiclePos ? 13 : routePolyline.length > 0 ? 10 : 6;

  return (
    <div className="live-map-page-wrapper">
      <main className="map-page-body">
        {/* Left Side Control HUD */}
        <aside className="map-control-sidebar ff-card">
          {/* Tab Navigation */}
          <div className="dashboard-nav-tabs" style={{ marginBottom: '1rem' }}>
            <button
              className={`dash-tab-btn ${activeTab === 'fleet_map' ? 'active' : ''}`}
              onClick={() => handleTabChange('fleet_map')}
            >
              Fleet Map
            </button>
            <button
              className={`dash-tab-btn ${activeTab === 'active_trips' ? 'active' : ''}`}
              onClick={() => handleTabChange('active_trips')}
            >
              Active Trips
            </button>
          </div>

          <div className="sidebar-section">
            <div className="ws-status-badge">
              <Radio size={14} className="live-pulse-dot" />
              <span>{wsStatus}</span>
            </div>
            <h2>{activeTab === 'active_trips' ? 'Active Trips Live Tracking' : 'Fleet Location Map'}</h2>
            <p className="sidebar-sub">
              {activeShipment
                ? `Tracking order #${activeShipment.tracking_number}`
                : activeTab === 'active_trips' ? 'Select an active trip to display route path and telemetry' : 'Real-Time Vehicle Positions across Fleet'}
            </p>
          </div>

          {/* If tracking a specific shipment */}
          {activeShipment ? (
            <div className="sidebar-section" style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Target Shipment</strong>
                <button className="btn btn-secondary btn-sm" onClick={handleClearFilter} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                  <X size={12} /> Clear Filter
                </button>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>Tracking #: <strong style={{ color: 'var(--accent-primary)' }}>{activeShipment.tracking_number}</strong></div>
                <div>Customer: <strong>{activeShipment.customer_name}</strong></div>
                <div>Route: <strong>{activeShipment.source} → {activeShipment.destination}</strong></div>
                <div>Status: <span className={`status-pill status-${(activeShipment.status || '').toLowerCase().replace(/ /g, '')}`}>{activeShipment.status}</span></div>
                <div>Assigned Driver: <strong>{assignedDriver?.full_name || (activeShipment.driver_id ? 'Assigned' : 'No driver assigned')}</strong></div>
                <div>Assigned Vehicle: <strong>{assignedVehicle?.registration_number || (activeShipment.vehicle_id ? 'Assigned' : 'No vehicle assigned')}</strong></div>
              </div>
            </div>
          ) : (
            /* Generic Active Trip Selector */
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
                    if (t?.route_type) setRouteProfile(t.route_type);
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
          )}

          {/* Telemetry Metrics Panel */}
          <div className="telemetry-grid">
            {/* 1. Live Speed */}
            <div className="telemetry-card">
              <div className="tel-icon"><Gauge size={18} color="#22D3EE" /></div>
              <div className="tel-info">
                <span className="tel-label">Live Speed</span>
                <span className="tel-val">{getSpeedDisplay()}</span>
              </div>
            </div>

            {/* 2. Remaining Distance */}
            <div className="telemetry-card">
              <div className="tel-icon"><Navigation size={18} color="#A78BFA" /></div>
              <div className="tel-info">
                <span className="tel-label">Remaining Distance</span>
                <span className="tel-val">{getRemainingDistanceDisplay()}</span>
              </div>
            </div>

            {/* 3. Remaining ETA */}
            <div className="telemetry-card">
              <div className="tel-icon"><Clock size={18} color="#34D399" /></div>
              <div className="tel-info">
                <span className="tel-label">Remaining ETA</span>
                <span className="tel-val">{getRemainingEtaDisplay()}</span>
              </div>
            </div>

            {/* 4. Last Ping */}
            <div className="telemetry-card">
              <div className="tel-icon"><Radio size={18} color="#F87171" /></div>
              <div className="tel-info">
                <span className="tel-label">Last Ping</span>
                <span className="tel-val">{getLastPingDisplay()}</span>
              </div>
            </div>

            {/* 5. Route Profile Selector */}
            <div className="telemetry-card" style={{ gridColumn: 'span 2' }}>
              <div className="tel-icon"><Truck size={18} color="#FBBF24" /></div>
              <div className="tel-info" style={{ width: '100%', minWidth: 0 }}>
                <span className="tel-label">Route Profile</span>
                <select
                  className="hud-profile-select"
                  value={routeProfile}
                  onChange={(e) => handleProfileChange(e.target.value)}
                  disabled={isChangingProfile}
                  aria-label="Route Profile"
                >
                  <option value="fastest">Fastest</option>
                  <option value="shortest">Shortest</option>
                  <option value="traffic_avoidance">Traffic Avoidance</option>
                  <option value="fuel_efficient">Fuel-Efficient</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
            </div>
          </div>

          {/* Geofence Notice */}
          {geofenceAlert && (
            <div className="geofence-alert-box">
              <ShieldAlert size={18} color="#FBBF24" />
              <span>{geofenceAlert}</span>
            </div>
          )}

          {/* Simulation & Recalculate Controls */}
          <div className="map-action-controls">
            <button
              className="btn btn-secondary"
              onClick={handleRecalculate}
              disabled={!activeTrip || routePolyline.length === 0}
              style={{ width: '100%' }}
            >
              <RotateCw size={16} />
              <span>Recalculate Route</span>
            </button>

            <button
              className={`btn ${isSimulating ? 'btn-danger' : 'btn-primary'}`}
              onClick={startGpsSimulation}
              disabled={!activeTrip || routePolyline.length === 0}
              style={{ width: '100%' }}
            >
              <Play size={16} />
              <span>{isSimulating ? 'Pause GPS Stream' : 'Simulate Live GPS Stream'}</span>
            </button>
          </div>
        </aside>

        {/* Map Container View */}
        <section className="map-view-container" style={{ position: 'relative' }}>
          {/* Top Shipment Tracking Header Banner */}
          {activeShipment && (
            <div className="shipment-tracking-banner ff-card">
              <div className="banner-primary-info">
                <span className="banner-title">
                  <Package size={18} color="var(--accent-primary)" />
                  Tracking Shipment: <strong>{activeShipment.tracking_number}</strong>
                </span>
                <span className="banner-route">
                  <MapPin size={14} color="#22c55e" /> {activeShipment.source || 'Origin'} → <MapPin size={14} color="#ef4444" /> {activeShipment.destination || 'Destination'}
                </span>
              </div>

              <div className="banner-secondary-info">
                {trackingState === 'live_tracking_active' && (
                  <span className="ws-status-badge" style={{ margin: 0, padding: '4px 10px', fontSize: '0.78rem' }}>
                    <CheckCircle2 size={14} /> Live Tracking Active
                  </span>
                )}
                <span className={`status-pill status-${(activeShipment.status || '').toLowerCase().replace(/ /g, '')}`}>
                  {activeShipment.status}
                </span>
                <div className="banner-meta-item">
                  <User size={14} color="var(--accent-primary)" />
                  <span>Driver: <strong>{assignedDriver?.full_name || (activeShipment.driver_id ? 'Assigned' : 'No driver assigned')}</strong></span>
                </div>
                <div className="banner-meta-item">
                  <Truck size={14} color="#22d3ee" />
                  <span>Vehicle: <strong>{assignedVehicle?.registration_number || (activeShipment.vehicle_id ? 'Assigned' : 'No vehicle assigned')}</strong></span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleClearFilter} style={{ marginLeft: '12px' }}>
                  <X size={14} /> Clear Filter
                </button>
              </div>
            </div>
          )}

          {/* Condition Overlay Banners for Tracking States */}
          {isLoadingTracking ? (
            <div className="map-notice-overlay info">
              <Radio size={22} color="#22d3ee" className="live-pulse-dot" style={{ flexShrink: 0 }} />
              <div>
                <strong>Loading live tracking...</strong>
                <p>Retrieving authoritative tracking state from backend...</p>
              </div>
            </div>
          ) : activeShipment && trackingState === 'unassigned' ? (
            <div className="map-notice-overlay warning">
              <AlertTriangle size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div>
                <strong>Tracking Unavailable</strong>
                <p>Tracking unavailable — assign a driver and vehicle to this shipment.</p>
              </div>
            </div>
          ) : activeShipment && trackingState === 'waiting_for_gps' ? (
            <div className="map-notice-overlay info">
              <Radio size={22} color="#22d3ee" style={{ flexShrink: 0 }} />
              <div>
                <strong>Waiting for GPS signal</strong>
                <p>Driver: <strong>{assignedDriver?.full_name || (activeShipment.driver_id ? 'Assigned' : 'No driver assigned')}</strong> | Vehicle: <strong>{assignedVehicle?.registration_number || (activeShipment.vehicle_id ? 'Assigned' : 'No vehicle assigned')}</strong></p>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Last known position: Not available | Last update: Not available</p>
              </div>
            </div>
          ) : activeShipment && (trackingState === 'completed' || trackingState === 'cancelled') ? (
            <div className="map-notice-overlay info">
              <AlertCircle size={22} color="#94a3b8" style={{ flexShrink: 0 }} />
              <div>
                <strong>Live tracking unavailable for status ({activeShipment.status})</strong>
                <p>{trackingMessage}</p>
              </div>
            </div>
          ) : activeShipment && trackingState === 'error' ? (
            <div className="map-notice-overlay warning">
              <AlertTriangle size={22} color="#ef4444" style={{ flexShrink: 0 }} />
              <div>
                <strong>Tracking Load Error</strong>
                <p>{trackingMessage}</p>
              </div>
            </div>
          ) : !activeShipment && Object.keys(vehiclePositions).length === 0 ? (
            <div className="map-notice-overlay info">
              <AlertCircle size={22} color="#94a3b8" style={{ flexShrink: 0 }} />
              <div>
                <strong>No live tracking data available.</strong>
                <p>No active vehicles are currently transmitting live GPS telemetry.</p>
              </div>
            </div>
          ) : null}

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

            {/* Auto fit bounds or center to active route/position */}
            <MapBoundsUpdater
              polylineCoords={routePolyline}
              centerPos={hasGpsLocation ? activeVehiclePos : null}
              shipmentSource={activeShipment?.source_lat && activeShipment?.source_lng ? [activeShipment.source_lat, activeShipment.source_lng] : null}
              shipmentDest={activeShipment?.dest_lat && activeShipment?.dest_lng ? [activeShipment.dest_lat, activeShipment.dest_lng] : null}
            />

            {/* Origin Pin */}
            {(routePolyline.length > 0 || (activeShipment?.source_lat && activeShipment?.source_lng)) && (
              <Marker
                position={routePolyline.length > 0 ? routePolyline[0] : [activeShipment.source_lat, activeShipment.source_lng]}
                icon={createHubIcon('origin')}
              >
                <Popup>
                  <strong>Origin: {activeTrip?.start_location || activeShipment?.source || 'Pickup Point'}</strong>
                </Popup>
              </Marker>
            )}

            {/* Destination Pin */}
            {(routePolyline.length > 1 || (activeShipment?.dest_lat && activeShipment?.dest_lng)) && (
              <Marker
                position={routePolyline.length > 1 ? routePolyline[routePolyline.length - 1] : [activeShipment.dest_lat, activeShipment.dest_lng]}
                icon={createHubIcon('dest')}
              >
                <Popup>
                  <strong>Destination: {activeTrip?.destination || activeShipment?.destination || 'Dropoff Point'}</strong>
                </Popup>
              </Marker>
            )}

            {/* Optimized Route Polyline */}
            {routePolyline.length > 0 && (
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: getRouteColor(routeProfile),
                  weight: 5,
                  opacity: 0.85,
                  dashArray: routeProfile === 'traffic_avoidance' ? '8, 8' : undefined,
                }}
              />
            )}

            {/* Live Vehicle Markers */}
            {/* If tracking a specific shipment with GPS, display ONLY that vehicle marker */}
            {activeShipment && hasGpsLocation ? (
              <Marker
                position={activeVehiclePos}
                icon={createVehicleIcon(activeShipment.status)}
              >
                <Popup>
                  <div className="map-popup-card">
                    <h4>Tracking #{activeShipment.tracking_number} 🚛</h4>
                    <p>Driver: <strong>{assignedDriver?.full_name || 'Assigned'}</strong></p>
                    <p>Vehicle: <strong>{assignedVehicle?.registration_number || 'Assigned'}</strong></p>
                    <p>Route: <strong>{activeShipment.source} → {activeShipment.destination}</strong></p>
                    <p>Status: <strong>{activeShipment.status}</strong></p>
                    <p>Live Speed: <strong>{getSpeedDisplay()}</strong></p>
                    <p>Remaining Dist: <strong>{getRemainingDistanceDisplay()}</strong></p>
                    <p>Remaining ETA: <strong>{getRemainingEtaDisplay()}</strong></p>
                    <p>Last Ping: <strong>{getLastPingDisplay()}</strong></p>
                  </div>
                </Popup>
              </Marker>
            ) : !activeShipment ? (
              /* Generic Mode: Render all active vehicle positions */
              Object.entries(vehiclePositions).map(([vId, pos]) => (
                <Marker
                  key={vId}
                  position={[pos.latitude, pos.longitude]}
                  icon={createVehicleIcon(pos.status)}
                >
                  <Popup>
                    <div className="map-popup-card">
                      <h4>Fleet Vehicle ({pos.registration || 'Asset'}) 🚛</h4>
                      <p>Status: <strong>{pos.status || 'Active'}</strong></p>
                      <p>Speed: <strong>{pos.speed || 0} km/h</strong></p>
                    </div>
                  </Popup>
                </Marker>
              ))
            ) : null}
          </MapContainer>
        </section>
      </main>
    </div>
  );
}
