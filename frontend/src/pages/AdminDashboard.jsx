import React, { useEffect, useState } from 'react';
import {
  getOperationalSummary,
  getDriverPerformance,
  getMaintenanceAnalytics,
} from '../api/analytics';
import { getShipments } from '../api/shipments';
import { toast } from 'react-toastify';
import {
  ShieldAlert,
  Users,
  TrendingUp,
  Wrench,
  AlertTriangle,
  RotateCw,
  BarChart2,
  PieChart as PieIcon
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import './AdminDashboard.css';

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#22d3ee', '#a855f7', '#22c55e', '#f59e0b', '#ef4444'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [operationalData, setOperationalData] = useState(null);
  const [driverPerfData, setDriverPerfData] = useState(null);
  const [maintenanceData, setMaintenanceData] = useState(null);

  useEffect(() => {
    if (user && user.role !== 'Admin') {
      toast.error('Access forbidden: Admin Dashboard is restricted to Administrators.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);
  const [attentionShipments, setAttentionShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [opsRes, driverRes, maintRes, shipRes] = await Promise.all([
        getOperationalSummary(),
        getDriverPerformance(),
        getMaintenanceAnalytics(),
        getShipments({ limit: 100 }),
      ]);

      setOperationalData(opsRes.data || null);
      setDriverPerfData(driverRes.data || null);
      setMaintenanceData(maintRes.data || null);

      const list = (shipRes.data || []).filter((s) =>
        ['delayed', 'cancelled'].includes((s.status || '').toLowerCase())
      );
      setAttentionShipments(list);
    } catch (err) {
      toast.error('Failed to load Admin Operational Dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const volumeTrendData = operationalData?.shipment_volume_trend || [];
  const costPerVehicleData = (maintenanceData?.cost_per_vehicle || []).map((item) => ({
    name: item.registration_number || 'Vehicle',
    cost: item.total_maintenance_cost,
  }));
  const serviceTypeData = (maintenanceData?.frequency_by_type || []).map((item) => ({
    name: item.service_type,
    value: item.count,
  }));

  return (
    <div className="admin-dash-wrapper">
      <main className="page-container">
        <div className="page-header">
          <div className="page-title-group">
            <h1>Executive System & Operational Dashboard</h1>
            <p>Comprehensive system metrics, driver performance reports, and maintenance financial analytics</p>
          </div>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Top KPI Row */}
        <div className="admin-kpi-grid">
          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box total-box">
                <TrendingUp size={22} />
              </div>
              <span className="kpi-badge">Monthly Volume</span>
            </div>
            <span className="kpi-label">Total Period Shipments</span>
            <strong className="kpi-number">{operationalData?.period_total_shipments ?? 'No data yet'}</strong>
            <div className="kpi-sub-stats">
              <span>{operationalData?.active_dispatches_count ?? 0} Active Dispatches</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box ship-box" style={{ background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee' }}>
                <Users size={22} />
              </div>
              <span className="kpi-badge">Drivers</span>
            </div>
            <span className="kpi-label">Active Drivers On-Roster</span>
            <strong className="kpi-number">{driverPerfData?.total_drivers ?? 0}</strong>
            <div className="kpi-sub-stats">
              <span>Monitored performance metrics</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box alert-box">
                <ShieldAlert size={22} />
              </div>
              <span className="kpi-badge">Attention Needed</span>
            </div>
            <span className="kpi-label">Delayed / Cancelled</span>
            <strong className="kpi-number">{operationalData?.delayed_shipments_count ?? 0}</strong>
            <div className="kpi-sub-stats">
              <span>Shipments requiring intervention</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box trip-box" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                <Wrench size={22} />
              </div>
              <span className="kpi-badge">Maintenance</span>
            </div>
            <span className="kpi-label">Total Service Expenditure</span>
            <strong className="kpi-number">
              ${maintenanceData?.total_maintenance_cost != null ? maintenanceData.total_maintenance_cost : 'No data yet'}
            </strong>
            <div className="kpi-sub-stats">
              <span>{maintenanceData?.total_maintenance_records ?? 0} Service Records</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid-layout">
          {/* Shipment Volume Trend Line Chart */}
          <div className="ff-card chart-card">
            <div className="chart-header">
              <h2>
                <TrendingUp size={18} color="#22d3ee" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Shipment Volume Trend
              </h2>
              <p className="dash-sub">Monthly shipment volume progression</p>
            </div>
            {volumeTrendData.length > 0 ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={volumeTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222948" />
                    <XAxis dataKey="period" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#141830', borderColor: '#283056', color: '#f8fafc' }} />
                    <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={3} name="Shipments" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="no-data-placeholder">No data yet</div>
            )}
          </div>

          {/* Maintenance Cost per Vehicle Bar Chart */}
          <div className="ff-card chart-card">
            <div className="chart-header">
              <h2>
                <BarChart2 size={18} color="#c084fc" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Maintenance Expenditure per Vehicle
              </h2>
              <p className="dash-sub">Total servicing cost accumulated per vehicle asset</p>
            </div>
            {costPerVehicleData.length > 0 ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={costPerVehicleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222948" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#141830', borderColor: '#283056', color: '#f8fafc' }} />
                    <Bar dataKey="cost" fill="#c084fc" radius={[4, 4, 0, 0]} name="Cost ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="no-data-placeholder">No data yet</div>
            )}
          </div>
        </div>

        {/* Driver Performance Table */}
        <div className="ff-card dash-section" style={{ marginTop: '24px' }}>
          <h2>Driver Performance Reports</h2>
          <p className="dash-sub">Aggregated driver metrics, on-time delivery rates, and monthly attendance</p>
          {!driverPerfData || driverPerfData.drivers.length === 0 ? (
            <div className="no-data-placeholder">No data yet</div>
          ) : (
            <table className="ff-table" style={{ marginTop: '14px' }}>
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>License Number</th>
                  <th>Completed Trips</th>
                  <th>Delivered Shipments</th>
                  <th>On-Time Rate %</th>
                  <th>Attendance Rate %</th>
                </tr>
              </thead>
              <tbody>
                {driverPerfData.drivers.map((d) => (
                  <tr key={d.driver_id}>
                    <td>
                      <strong>{d.driver_name || 'Driver'}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.email}</div>
                    </td>
                    <td>{d.license_number || 'N/A'}</td>
                    <td>{d.trips_completed}</td>
                    <td>{d.total_delivered_shipments}</td>
                    <td>
                      {d.on_time_rate_pct != null ? (
                        <span className="status-pill status-active">{d.on_time_rate_pct}%</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No data yet</span>
                      )}
                    </td>
                    <td>
                      {d.attendance_rate_pct != null ? (
                        <span className="status-pill status-active">{d.attendance_rate_pct}%</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No data yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Shipments Needing Attention */}
        <div className="ff-card dash-section" style={{ marginTop: '24px' }}>
          <h2>
            <AlertTriangle size={18} color="#ef4444" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Shipments Needing Attention (Delayed / Cancelled)
          </h2>
          <p className="dash-sub">Exceptions requiring dispatcher intervention</p>
          {attentionShipments.length === 0 ? (
            <div className="no-data-placeholder">No delayed or cancelled shipments</div>
          ) : (
            <table className="ff-table" style={{ marginTop: '14px' }}>
              <thead>
                <tr>
                  <th>Tracking Number</th>
                  <th>Source to Destination</th>
                  <th>Customer</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attentionShipments.slice(0, 5).map((s) => (
                  <tr key={s.shipment_id}>
                    <td>
                      <strong>{s.tracking_number}</strong>
                    </td>
                    <td>
                      {s.source} → {s.destination}
                    </td>
                    <td>{s.customer_name || 'N/A'}</td>
                    <td>
                      <span className="status-pill status-inactive">{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
