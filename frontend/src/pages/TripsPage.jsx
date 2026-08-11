import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import RouteSelector from '../components/trips/RouteSelector';
import { getTrips, createTrip, startTrip, endTrip, cancelTrip, calculateRoutes } from '../api/trips';
import { getShipments } from '../api/shipments';
import { getVehicles } from '../api/vehicles';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  Navigation, 
  Calendar, 
  Play, 
  CheckCircle2, 
  Ban, 
  MapPin, 
  ArrowRight, 
  Truck, 
  RotateCw, 
  Radio 
} from 'lucide-react';
import './TripsPage.css';

export default function TripsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Trip Schedule Form State
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [sourceAddr, setSourceAddr] = useState('');
  const [destAddr, setDestAddr] = useState('');
  const [calculatedRoutes, setCalculatedRoutes] = useState([]);
  const [selectedRouteType, setSelectedRouteType] = useState('fastest');
  const [calculating, setCalculating] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const canDispatch = user?.role === 'Admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes, vRes] = await Promise.all([
        getTrips(),
        getShipments(),
        getVehicles(),
      ]);
      setTrips(tRes.data);
      setShipments(sRes.data);
      setVehicles(vRes.data);
    } catch (err) {
      toast.error('Failed to load trips data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When shipment selected in dropdown, autofill source and destination
  const handleShipmentSelect = (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    const s = shipments.find((item) => item.shipment_id === shipmentId);
    if (s) {
      setSourceAddr(s.source || '');
      setDestAddr(s.destination || '');
      if (s.vehicle_id) setSelectedVehicleId(s.vehicle_id);
    }
  };

  const handleCalculateRoutes = async () => {
    if (!sourceAddr.trim() || !destAddr.trim()) {
      toast.error('Please enter valid source and destination addresses.');
      return;
    }
    setCalculating(true);
    try {
      const res = await calculateRoutes(sourceAddr, destAddr);
      setCalculatedRoutes(res.data.routes || []);
      if (res.data.routes?.length > 0) {
        setSelectedRouteType(res.data.routes[0].route_type);
        toast.success(`Computed ${res.data.routes.length} route options.`);
      }
    } catch (err) {
      toast.error('Failed to calculate routes.');
    } finally {
      setCalculating(false);
    }
  };

  const handleScheduleTrip = async (e) => {
    e.preventDefault();
    if (!selectedShipmentId) {
      toast.error('Please select a shipment to link.');
      return;
    }
    if (!selectedVehicleId) {
      toast.error('Please assign an available vehicle.');
      return;
    }

    setScheduling(true);
    try {
      const chosenRoute = calculatedRoutes.find((r) => r.route_type === selectedRouteType);

      await createTrip({
        shipment_id: selectedShipmentId,
        vehicle_id: selectedVehicleId,
        start_location: sourceAddr,
        destination: destAddr,
        route_type: selectedRouteType,
        planned_distance_km: chosenRoute?.distance_km,
        planned_duration_min: chosenRoute?.duration_min,
        route_geometry: chosenRoute?.coordinates,
      });

      toast.success('Trip scheduled successfully with optimized route!');
      setSelectedShipmentId('');
      setCalculatedRoutes([]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule trip.');
    } finally {
      setScheduling(false);
    }
  };

  const handleStartTrip = async (tripId) => {
    try {
      await startTrip(tripId);
      toast.success('Trip started! Vehicle and shipment are now In Transit.');
      fetchData();
    } catch (err) {
      toast.error('Failed to start trip.');
    }
  };

  const handleEndTrip = async (tripId) => {
    try {
      await endTrip(tripId);
      toast.success('Trip completed! Shipment marked as Delivered and vehicle is freed.');
      fetchData();
    } catch (err) {
      toast.error('Failed to complete trip.');
    }
  };

  const handleCancelTrip = async (tripId) => {
    if (!window.confirm('Are you sure you want to cancel this trip?')) return;
    try {
      await cancelTrip(tripId);
      toast.info('Trip cancelled.');
      fetchData();
    } catch (err) {
      toast.error('Failed to cancel trip.');
    }
  };

  return (
    <div className="trips-page-wrapper">
      <Navbar />

      <main className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Trip Dispatcher & Route Optimization</h1>
            <p>Calculate multi-profile OSRM routes, schedule dispatches and track trips</p>
          </div>
        </div>

        {/* Schedule Trip Panel (for Dispatchers/Admins) */}
        {canDispatch && (
          <section className="dispatch-builder-card ff-card">
            <div className="section-title-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Navigation size={22} color="var(--accent-primary)" />
                <h2>Schedule & Optimize New Trip</h2>
              </div>
              <span className="route-notice-tag">OSRM Driving Engine</span>
            </div>

            <form onSubmit={handleScheduleTrip} className="trip-schedule-form">
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Select Active Shipment *</label>
                  <select
                    className="form-select"
                    value={selectedShipmentId}
                    onChange={(e) => handleShipmentSelect(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Shipment --</option>
                    {shipments
                      .filter((s) => s.status === 'Created' || s.status === 'Assigned')
                      .map((s) => (
                        <option key={s.shipment_id} value={s.shipment_id}>
                          {s.tracking_number} ({s.source} → {s.destination}) - {s.customer_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Vehicle *</label>
                  <select
                    className="form-select"
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Vehicle --</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.registration_number} ({v.brand || ''} {v.model || v.vehicle_type}) - {v.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', height: '42px' }}
                    onClick={handleCalculateRoutes}
                    disabled={calculating}
                  >
                    <RotateCw size={16} className={calculating ? 'spinning' : ''} />
                    <span>{calculating ? 'Calculating...' : 'Preview Routes'}</span>
                  </button>
                </div>
              </div>

              {/* Source and Destination Addrs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '6px' }}>
                <div className="form-group">
                  <label className="form-label">Origin Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter origin location"
                    value={sourceAddr}
                    onChange={(e) => setSourceAddr(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Destination Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter destination location"
                    value={destAddr}
                    onChange={(e) => setDestAddr(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Route Selector Comparison Cards */}
              {calculatedRoutes.length > 0 && (
                <RouteSelector
                  routes={calculatedRoutes}
                  selectedType={selectedRouteType}
                  onSelect={(type) => setSelectedRouteType(type)}
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={scheduling || !selectedShipmentId || !selectedVehicleId}
                >
                  <Calendar size={16} />
                  <span>{scheduling ? 'Scheduling...' : 'Confirm & Dispatch Trip'}</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Scheduled & Active Trips List */}
        <section className="trips-list-section">
          <div className="section-header-bar">
            <h2>Active & Scheduled Trips</h2>
            <span className="count-pill">{trips.length} Total</span>
          </div>

          <div className="ff-table-wrapper">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading scheduled trips...
              </div>
            ) : trips.length === 0 ? (
              <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Navigation size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p>No trips scheduled yet. Dispatch a trip above to begin.</p>
              </div>
            ) : (
              <table className="ff-table">
                <thead>
                  <tr>
                    <th>Trip ID / Route</th>
                    <th>Distance & Time</th>
                    <th>Profile</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => {
                    const isRunning = t.status === 'In Transit';
                    const isDone = t.status === 'Completed';

                    return (
                      <tr key={t.trip_id}>
                        <td>
                          <div className="trip-route-cell">
                            <strong>{t.start_location} → {t.destination}</strong>
                            <span className="trip-id-sub">ID: {t.trip_id.slice(0, 8)}...</span>
                          </div>
                        </td>
                        <td>
                          <div className="trip-metrics-cell">
                            <span>{t.planned_distance_km ? `${t.planned_distance_km} km` : 'N/A'}</span>
                            <span className="duration-sub">{t.planned_duration_min ? `~${t.planned_duration_min} min` : ''}</span>
                          </div>
                        </td>
                        <td>
                          <span className="route-profile-tag">{t.route_type}</span>
                        </td>
                        <td>
                          <span className={`status-pill ${
                            isRunning ? 'status-intransit' : isDone ? 'status-completed' : 'status-scheduled'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td>
                          {t.start_time ? new Date(t.start_time).toLocaleTimeString() : 'Not started'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="trip-actions-cell">
                            {/* Start Trip */}
                            {t.status === 'Scheduled' && canDispatch && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleStartTrip(t.trip_id)}
                              >
                                <Play size={13} />
                                <span>Start</span>
                              </button>
                            )}

                            {/* End Trip */}
                            {isRunning && canDispatch && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleEndTrip(t.trip_id)}
                              >
                                <CheckCircle2 size={13} />
                                <span>Complete</span>
                              </button>
                            )}

                            {/* Live Map Link */}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => navigate(`/live-map?trip=${t.trip_id}`)}
                            >
                              <Radio size={13} />
                              <span>Track Live</span>
                            </button>

                            {/* Cancel */}
                            {t.status === 'Scheduled' && canDispatch && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleCancelTrip(t.trip_id)}
                              >
                                <Ban size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
