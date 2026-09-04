import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Radio,
  User,
  Clock,
  Compass
} from 'lucide-react';
import './TripsPage.css';

export default function TripsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'ready_dispatch';
  const [activeTab, setActiveTab] = useState(currentTab);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const [trips, setTrips] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ready for Dispatch State
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [sourceAddr, setSourceAddr] = useState('');
  const [destAddr, setDestAddr] = useState('');
  const [calculatedRoutes, setCalculatedRoutes] = useState([]);
  const [selectedRouteType, setSelectedRouteType] = useState('fastest');
  const [calculating, setCalculating] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const canDispatch = user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Dispatcher';
  const canStartOrEnd = user?.role === 'Admin' || user?.role === 'FleetManager' || user?.role === 'Driver';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes, vRes] = await Promise.all([
        getTrips(),
        getShipments(),
        getVehicles(),
      ]);
      setTrips(tRes.data || []);
      setShipments(sRes.data || []);
      setVehicles(vRes.data || []);
    } catch (err) {
      toast.error('Failed to load trips data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When shipment selected, populate details
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
      toast.error('Please specify valid origin and destination addresses.');
      return;
    }
    setCalculating(true);
    try {
      const res = await calculateRoutes(sourceAddr, destAddr);
      setCalculatedRoutes(res.data.routes || []);
      if (res.data.routes?.length > 0) {
        setSelectedRouteType(res.data.routes[0].route_type);
        toast.success(`Calculated ${res.data.routes.length} route options.`);
      }
    } catch (err) {
      toast.error('Failed to calculate route options.');
    } finally {
      setCalculating(false);
    }
  };

  const handleDispatchTrip = async (e) => {
    e.preventDefault();
    if (!selectedShipmentId) {
      toast.error('Please select a shipment ready for dispatch.');
      return;
    }
    if (!selectedVehicleId) {
      toast.error('Please select an available vehicle.');
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

      toast.success('Trip dispatched successfully!');
      setSelectedShipmentId('');
      setCalculatedRoutes([]);
      fetchData();
      handleTabChange('active_trips');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to dispatch trip.');
    } finally {
      setScheduling(false);
    }
  };

  const handleStartTrip = async (tripId) => {
    try {
      await startTrip(tripId);
      toast.success('Trip started! Status updated to In Transit.');
      fetchData();
    } catch (err) {
      toast.error('Failed to start trip.');
    }
  };

  const handleEndTrip = async (tripId) => {
    try {
      await endTrip(tripId);
      toast.success('Trip marked as Completed.');
      fetchData();
    } catch (err) {
      toast.error('Failed to complete trip.');
    }
  };

  const handleCancelTrip = async (tripId) => {
    if (!window.confirm('Cancel this scheduled trip?')) return;
    try {
      await cancelTrip(tripId);
      toast.info('Trip cancelled.');
      fetchData();
    } catch (err) {
      toast.error('Failed to cancel trip.');
    }
  };

  // Ready for Dispatch Shipments List
  const readyShipments = shipments.filter(s => s.status === 'Created' || s.status === 'Assigned');
  const activeTripsList = trips.filter(t => t.status === 'In Transit' || t.status === 'Scheduled');
  const completedTripsList = trips.filter(t => (t.status || '').toLowerCase() === 'completed');

  const selectedShipmentObj = shipments.find(s => s.shipment_id === selectedShipmentId);
  const selectedRouteObj = calculatedRoutes.find(r => r.route_type === selectedRouteType);

  return (
    <div className="trips-page-wrapper">
      <main className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Trip Dispatcher & Route Engine</h1>
            <p>Assign vehicles, calculate routes, review ETA metrics, and dispatch active trips.</p>
          </div>
        </div>

        {/* Internal Tabs */}
        <div className="dashboard-nav-tabs">
          <button
            className={`dash-tab-btn ${activeTab === 'ready_dispatch' ? 'active' : ''}`}
            onClick={() => handleTabChange('ready_dispatch')}
          >
            Ready for Dispatch ({readyShipments.length})
          </button>
          <button
            className={`dash-tab-btn ${activeTab === 'active_trips' ? 'active' : ''}`}
            onClick={() => handleTabChange('active_trips')}
          >
            Active Trips ({activeTripsList.length})
          </button>
          <button
            className={`dash-tab-btn ${activeTab === 'completed_trips' ? 'active' : ''}`}
            onClick={() => handleTabChange('completed_trips')}
          >
            Completed Trips ({completedTripsList.length})
          </button>
        </div>

        {/* ==================================================
            TAB 1: READY FOR DISPATCH
            ================================================== */}
        {activeTab === 'ready_dispatch' && (
          <div className="tab-content-area">
            {canDispatch ? (
              <section className="dispatch-builder-card ff-card" style={{ padding: '1.5rem' }}>
                <div className="section-title-row" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Navigation size={22} color="#38bdf8" />
                    <h2>Dispatch Workflow & Route Calculator</h2>
                  </div>
                  <span className="route-notice-tag">OSRM Engine</span>
                </div>

                <form onSubmit={handleDispatchTrip} className="trip-schedule-form">
                  <div className="form-grid-3">
                    {/* Shipment Dropdown */}
                    <div className="form-group">
                      <label className="form-label">Select Ready Shipment *</label>
                      <select
                        className="form-select"
                        value={selectedShipmentId}
                        onChange={(e) => handleShipmentSelect(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Shipment --</option>
                        {readyShipments.map((s) => (
                          <option key={s.shipment_id} value={s.shipment_id}>
                            {s.tracking_number || s.shipment_code} ({s.source} &rarr; {s.destination})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Assigned Driver Display (Read-Only) */}
                    <div className="form-group">
                      <label className="form-label">Assigned Driver (Read-Only)</label>
                      <div 
                        className="form-input" 
                        style={{ 
                          background: 'rgba(15, 23, 42, 0.7)', 
                          color: '#38bdf8', 
                          fontWeight: 600, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px' 
                        }}
                      >
                        <User size={16} />
                        <span>
                          {selectedShipmentObj ? (selectedShipmentObj.driver_name || 'Driver Assigned at Creation') : 'Select a shipment'}
                        </span>
                      </div>
                    </div>

                    {/* Available Vehicles Dropdown */}
                    <div className="form-group">
                      <label className="form-label">Select Vehicle *</label>
                      <select
                        className="form-select"
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Available Vehicle --</option>
                        {vehicles
                          .filter((v) => (v.status || '').toLowerCase() === 'available' || v.vehicle_id === selectedVehicleId)
                          .map((v) => (
                            <option key={v.vehicle_id} value={v.vehicle_id}>
                              {v.registration_number} ({v.brand || ''} {v.vehicle_type})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Route Mode & Locations */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Origin</label>
                      <input
                        type="text"
                        className="form-input"
                        value={sourceAddr}
                        onChange={(e) => setSourceAddr(e.target.value)}
                        placeholder="Origin address"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Destination</label>
                      <input
                        type="text"
                        className="form-input"
                        value={destAddr}
                        onChange={(e) => setDestAddr(e.target.value)}
                        placeholder="Destination address"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Route Mode</label>
                      <select
                        className="form-select"
                        value={selectedRouteType}
                        onChange={(e) => setSelectedRouteType(e.target.value)}
                      >
                        <option value="fastest">Fastest Route</option>
                        <option value="balanced">Balanced Route</option>
                        <option value="eco">Eco Mode</option>
                        <option value="scenic">Scenic Route</option>
                      </select>
                    </div>
                  </div>

                  {/* Route Action Controls */}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCalculateRoutes}
                      disabled={calculating || !sourceAddr || !destAddr}
                    >
                      <Compass size={16} className={calculating ? 'spin' : ''} />
                      <span>{calculating ? 'Calculating...' : 'Calculate Route'}</span>
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={scheduling || !selectedShipmentId || !selectedVehicleId}
                    >
                      <Calendar size={16} />
                      <span>Review & Dispatch Trip</span>
                    </button>
                  </div>

                  {/* Distance / Duration / ETA Display */}
                  {selectedRouteObj && (
                    <div className="route-perf-grid" style={{ marginTop: '1.25rem' }}>
                      <div className="route-stat-box">
                        <span className="route-stat-label">Distance</span>
                        <span className="route-stat-value">{selectedRouteObj.distance_km} km</span>
                      </div>
                      <div className="route-stat-box">
                        <span className="route-stat-label">Est. Duration</span>
                        <span className="route-stat-value">~{selectedRouteObj.duration_min} min</span>
                      </div>
                      <div className="route-stat-box">
                        <span className="route-stat-label">Est. Arrival (ETA)</span>
                        <span className="route-stat-value">
                          {new Date(Date.now() + (selectedRouteObj.duration_min || 0) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}

                  {calculatedRoutes.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <RouteSelector
                        routes={calculatedRoutes}
                        selectedType={selectedRouteType}
                        onSelect={(type) => setSelectedRouteType(type)}
                      />
                    </div>
                  )}
                </form>
              </section>
            ) : (
              <p style={{ color: '#94a3b8' }}>You must be a Dispatcher, Fleet Manager, or Admin to dispatch trips.</p>
            )}
          </div>
        )}

        {/* ==================================================
            TAB 2: ACTIVE TRIPS
            ================================================== */}
        {activeTab === 'active_trips' && (
          <div className="tab-content-area">
            <div className="ff-table-wrapper">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading active trips...</div>
              ) : activeTripsList.length === 0 ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                  <Navigation size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p>No active trips currently in transit or scheduled.</p>
                </div>
              ) : (
                <table className="ff-table">
                  <thead>
                    <tr>
                      <th>Trip ID / Route</th>
                      <th>Distance & Time</th>
                      <th>Profile</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTripsList.map((t) => (
                      <tr key={t.trip_id}>
                        <td>
                          <strong>{t.start_location} &rarr; {t.destination}</strong>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>ID: {t.trip_id.slice(0, 8)}</div>
                        </td>
                        <td>
                          <span>{t.planned_distance_km ? `${t.planned_distance_km} km` : 'N/A'}</span>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>~{t.planned_duration_min || '--'} min</div>
                        </td>
                        <td><span className="route-profile-tag">{t.route_type}</span></td>
                        <td>
                          <span className={`status-pill ${t.status === 'In Transit' ? 'status-intransit' : 'status-scheduled'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="trip-actions-cell">
                            {t.status === 'Scheduled' && canStartOrEnd && (
                              <button className="btn btn-success btn-sm" onClick={() => handleStartTrip(t.trip_id)}>
                                <Play size={13} /> Start
                              </button>
                            )}
                            {t.status === 'In Transit' && canStartOrEnd && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleEndTrip(t.trip_id)}>
                                <CheckCircle2 size={13} /> Complete
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/live-map?trip=${t.trip_id}`)}>
                              <Radio size={13} /> Track Live
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ==================================================
            TAB 3: COMPLETED TRIPS
            ================================================== */}
        {activeTab === 'completed_trips' && (
          <div className="tab-content-area">
            <div className="ff-table-wrapper">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading completed trips...</div>
              ) : completedTripsList.length === 0 ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                  <p>No completed trips logged in database yet.</p>
                </div>
              ) : (
                <table className="ff-table">
                  <thead>
                    <tr>
                      <th>Trip ID / Route</th>
                      <th>Planned Distance</th>
                      <th>Actual Distance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedTripsList.map((t) => (
                      <tr key={t.trip_id}>
                        <td>
                          <strong>{t.start_location} &rarr; {t.destination}</strong>
                        </td>
                        <td>{t.planned_distance_km || '--'} km</td>
                        <td>{t.actual_distance_km || t.planned_distance_km || '--'} km</td>
                        <td><span className="status-pill status-completed">Completed</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
