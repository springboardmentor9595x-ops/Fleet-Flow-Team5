import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDeliveryPerformance } from '../api/analytics';
import { getShipments } from '../api/shipments';
import { getLatestLocations } from '../api/socket';
import { toast } from 'react-toastify';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ArrowRight,
  RotateCw,
  BarChart2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import './LogisticsDashboard.css';

const defaultCenter = [20.5937, 78.9629];

const vehicleMarkerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-cyan.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function LogisticsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role === 'Driver') {
      toast.error('Access forbidden: Drivers cannot access Logistics Dashboard.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [deliveryPerf, setDeliveryPerf] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [delivRes, shipRes, locRes] = await Promise.all([
        getDeliveryPerformance(),
        getShipments({ limit: 100 }),
        getLatestLocations(),
      ]);

      setDeliveryPerf(delivRes.data || null);
      setShipments(shipRes.data || []);
      setLocations(locRes.data || []);
    } catch (err) {
      toast.error('Failed to load Logistics Dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Delivery status breakdown chart data
  const statusCounts = {
    Created: shipments.filter((s) => s.status === 'Created').length,
    Assigned: shipments.filter((s) => s.status === 'Assigned').length,
    'In Transit': shipments.filter((s) => s.status === 'In Transit').length,
    Delayed: shipments.filter((s) => s.status === 'Delayed').length,
    Delivered: shipments.filter((s) => s.status === 'Delivered').length,
    Cancelled: shipments.filter((s) => s.status === 'Cancelled').length,
  };

  const statusChartData = Object.entries(statusCounts).map(([name, count]) => ({
    name,
    count,
  }));

  const activeShipmentsCount = statusCounts['Assigned'] + statusCounts['In Transit'];

  return (
    <div className="logistics-dash-wrapper">
      <main className="page-container">
        <div className="page-header">
          <div className="page-title-group">
            <h1>Logistics & Dispatch Analytics</h1>
            <p>Shipment tracking overview, route delivery performance, and active vehicle telemetry snapshot</p>
          </div>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div className="logistics-kpi-grid">
          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box total-box">
                <Package size={22} />
              </div>
              <span className="kpi-badge">Dispatch Active</span>
            </div>
            <span className="kpi-label">Active Shipments</span>
            <strong className="kpi-number">{activeShipmentsCount}</strong>
            <div className="kpi-sub-stats">
              <span>{statusCounts['In Transit']} In Transit</span> • <span>{statusCounts['Assigned']} Assigned</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box active-icon" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>
                <CheckCircle2 size={22} />
              </div>
              <span className="kpi-badge">SLA Rate</span>
            </div>
            <span className="kpi-label">On-Time Delivery Rate</span>
            <strong className="kpi-number">
              {deliveryPerf?.on_time_rate_pct != null
                ? `${deliveryPerf.on_time_rate_pct}%`
                : 'No data yet'}
            </strong>
            <div className="kpi-sub-stats">
              <span>On-Time vs Total Delivered</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box trip-box" style={{ background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee' }}>
                <Clock size={22} />
              </div>
              <span className="kpi-badge">Lead Time</span>
            </div>
            <span className="kpi-label">Average Delivery Time</span>
            <strong className="kpi-number">
              {deliveryPerf?.average_delivery_time_hours != null
                ? `${deliveryPerf.average_delivery_time_hours} hrs`
                : 'No data yet'}
            </strong>
            <div className="kpi-sub-stats">
              <span>Creation to Final Delivery</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box alert-box">
                <AlertTriangle size={22} />
              </div>
              <span className="kpi-badge">Exceptions</span>
            </div>
            <span className="kpi-label">Delayed Rate</span>
            <strong className="kpi-number">
              {deliveryPerf?.delayed_rate_pct != null
                ? `${deliveryPerf.delayed_rate_pct}%`
                : 'No data yet'}
            </strong>
            <div className="kpi-sub-stats">
              <span>{deliveryPerf?.delayed_count ?? 0} Delayed Shipments</span>
            </div>
          </div>
        </div>

        {/* Status Breakdown & Map Snapshot */}
        <div className="charts-grid-layout">
          {/* Status Breakdown Bar Chart */}
          <div className="ff-card chart-card">
            <div className="chart-header">
              <h2>
                <BarChart2 size={18} color="#22d3ee" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Shipment Status Breakdown
              </h2>
              <p className="dash-sub">Total shipments categorized by lifecycle stage</p>
            </div>
            {shipments.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222948" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#141830', borderColor: '#283056', color: '#f8fafc' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Shipments">
                      {statusChartData.map((entry) => {
                        let fill = '#22d3ee';
                        if (entry.name === 'Delivered') fill = '#22c55e';
                        if (entry.name === 'Delayed') fill = '#f59e0b';
                        if (entry.name === 'Cancelled') fill = '#ef4444';
                        if (entry.name === 'In Transit') fill = '#a855f7';
                        return <Cell key={entry.name} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="no-data-placeholder">No data yet</div>
            )}
          </div>

          {/* Live Tracking Map Snapshot */}
          <div className="ff-card chart-card">
            <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>
                  <MapPin size={18} color="#a855f7" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  Live GPS Tracking Snapshot
                </h2>
                <p className="dash-sub">Real-time vehicle position telemetry</p>
              </div>
              <Link to="/live-map" className="view-all-link" style={{ fontSize: '0.85rem' }}>
                View Full Map <ArrowRight size={14} />
              </Link>
            </div>
            <div style={{ height: 280, borderRadius: '8px', overflow: 'hidden' }}>
              <MapContainer center={defaultCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution="&copy; OpenStreetMap & CartoDB"
                />
                {locations.map((loc) => (
                  <Marker
                    key={loc.vehicle_id}
                    position={[loc.lat || loc.latitude, loc.lng || loc.longitude]}
                    icon={vehicleMarkerIcon}
                  >
                    <Popup>
                      <strong>{loc.registration_number || 'Vehicle'}</strong>
                      <br />
                      Status: {loc.status || 'Active'}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
