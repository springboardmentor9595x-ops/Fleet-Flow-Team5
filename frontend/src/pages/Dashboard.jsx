import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { getVehicleStats } from '../api/vehicles';
import { getShipments, getDelayedAlerts } from '../api/shipments';
import { getTrips } from '../api/trips';
import { toast } from 'react-toastify';
import { 
  Truck, 
  Package, 
  Navigation, 
  AlertTriangle, 
  MapPin, 
  Plus, 
  ArrowRight, 
  Radio, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [vehicleStats, setVehicleStats] = useState({ total: 0, available: 0, in_transit: 0, maintenance: 0, out_of_service: 0 });
  const [shipments, setShipments] = useState([]);
  const [trips, setTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getVehicleStats(),
      getShipments({ limit: 6 }),
      getTrips({ limit: 5 }),
      getDelayedAlerts(),
    ])
      .then(([vRes, sRes, tRes, aRes]) => {
        setVehicleStats(vRes.data);
        setShipments(sRes.data);
        setTrips(tRes.data);
        setAlerts(aRes.data);
      })
      .catch((err) => {
        toast.error('Failed to refresh dashboard metrics.');
      })
      .finally(() => setLoading(false));
  }, []);

  const getStatusPill = (status) => {
    const s = (status || '').toLowerCase().replace(/ /g, '');
    if (s === 'delivered') return <span className="status-pill status-delivered">Delivered</span>;
    if (s === 'intransit') return <span className="status-pill status-intransit">In Transit</span>;
    if (s === 'delayed') return <span className="status-pill status-delayed">Delayed</span>;
    if (s === 'assigned') return <span className="status-pill status-assigned">Assigned</span>;
    if (s === 'cancelled') return <span className="status-pill status-cancelled">Cancelled</span>;
    return <span className="status-pill status-created">Created</span>;
  };

  return (
    <div className="dashboard-wrapper">
      <Navbar />

      <main className="page-container">
        {/* Welcome & Overview Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Fleet Operations Dashboard</h1>
            <p>Welcome back, <strong>{user?.full_name}</strong> ({user?.role})</p>
          </div>

          <div className="header-actions">
            <Link to="/live-map" className="btn btn-primary">
              <Radio size={16} />
              <span>Launch Live Map</span>
            </Link>
          </div>
        </div>

        {/* Delayed Shipments Alert Notification */}
        {alerts.length > 0 && (
          <div className="dashboard-alert-banner">
            <AlertTriangle size={22} />
            <div>
              <strong>{alerts.length} Shipment(s) Overdue or Approaching Window</strong>
              <p>Check the shipments panel to review delayed deliveries and re-optimize routes.</p>
            </div>
            <Link to="/shipments" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
              View Alerts
            </Link>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="kpi-cards-grid">
          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box total-box">
                <Truck size={22} />
              </div>
              <span className="kpi-badge">{vehicleStats.total} Registered</span>
            </div>
            <span className="kpi-label">Total Fleet Vehicles</span>
            <strong className="kpi-number">{vehicleStats.total}</strong>
            <div className="kpi-sub-stats">
              <span>{vehicleStats.available} Available</span> • <span>{vehicleStats.in_transit} In Transit</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box ship-box">
                <Package size={22} />
              </div>
              <span className="kpi-badge active-badge">{shipments.filter(s => s.status !== 'Delivered').length} Active</span>
            </div>
            <span className="kpi-label">Total Shipments</span>
            <strong className="kpi-number">{shipments.length}</strong>
            <div className="kpi-sub-stats">
              <span>{shipments.filter(s => s.status === 'In Transit').length} In Transit</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box trip-box">
                <Navigation size={22} />
              </div>
              <span className="kpi-badge">OSRM Optimized</span>
            </div>
            <span className="kpi-label">Dispatched Trips</span>
            <strong className="kpi-number">{trips.length}</strong>
            <div className="kpi-sub-stats">
              <span>{trips.filter(t => t.status === 'In Transit').length} Active Dispatches</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box alert-box">
                <AlertTriangle size={22} />
              </div>
              <span className="kpi-badge alert-pill-badge">{alerts.length} Flagged</span>
            </div>
            <span className="kpi-label">Delayed Alert Flags</span>
            <strong className="kpi-number">{alerts.length}</strong>
            <div className="kpi-sub-stats">
              <span>Delivery window monitoring</span>
            </div>
          </div>
        </div>

        {/* Main Content Two-Column Grid */}
        <div className="dashboard-columns-grid">
          {/* Left Column: Recent Shipments */}
          <section className="dash-section ff-card">
            <div className="section-head-row">
              <div>
                <h2>Recent Shipment Orders</h2>
                <p className="dash-sub">Latest cargo dispatches & delivery progress</p>
              </div>
              <Link to="/shipments" className="view-all-link">
                View All <ArrowRight size={14} />
              </Link>
            </div>

            <div className="ff-table-wrapper" style={{ border: 'none', background: 'transparent' }}>
              {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading shipments...
                </div>
              ) : shipments.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No shipments found.
                </div>
              ) : (
                <table className="ff-table">
                  <thead>
                    <tr>
                      <th>Tracking #</th>
                      <th>Route</th>
                      <th>Customer</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s) => (
                      <tr key={s.shipment_id}>
                        <td>
                          <span className="plate-badge">{s.tracking_number}</span>
                        </td>
                        <td>
                          <span style={{ color: '#fff', fontSize: '0.85rem' }}>
                            {s.source} → {s.destination}
                          </span>
                        </td>
                        <td>{s.customer_name}</td>
                        <td>{getStatusPill(s.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Right Column: Fleet Status & Quick Actions */}
          <section className="dash-section ff-card">
            <div className="section-head-row">
              <div>
                <h2>Fleet Vehicle Status</h2>
                <p className="dash-sub">Real-time availability distribution</p>
              </div>
              <Link to="/vehicles" className="view-all-link">
                Manage Fleet <ArrowRight size={14} />
              </Link>
            </div>

            <div className="status-progress-breakdown">
              <div className="status-bar-item">
                <div className="bar-labels">
                  <span>Available</span>
                  <strong>{vehicleStats.available}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill avail-fill"
                    style={{ width: `${(vehicleStats.available / (vehicleStats.total || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="status-bar-item">
                <div className="bar-labels">
                  <span>In Transit</span>
                  <strong>{vehicleStats.in_transit}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill transit-fill"
                    style={{ width: `${(vehicleStats.in_transit / (vehicleStats.total || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="status-bar-item">
                <div className="bar-labels">
                  <span>Maintenance</span>
                  <strong>{vehicleStats.maintenance}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill maint-fill"
                    style={{ width: `${(vehicleStats.maintenance / (vehicleStats.total || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="status-bar-item">
                <div className="bar-labels">
                  <span>Out of Service</span>
                  <strong>{vehicleStats.out_of_service}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill out-fill"
                    style={{ width: `${(vehicleStats.out_of_service / (vehicleStats.total || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions (Admin Only) */}
            {user?.role === 'Admin' && (
              <div className="quick-actions-box">
                <h3>Admin Quick Actions</h3>
                <div className="quick-buttons-row">
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/shipments')}>
                    <Plus size={14} /> Create Shipment
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/trips')}>
                    <Navigation size={14} /> Dispatch Trip
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/vehicles')}>
                    <Truck size={14} /> Add Vehicle
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
