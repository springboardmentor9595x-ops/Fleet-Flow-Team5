import React, { useEffect, useState } from 'react';
import { getFleetUtilization, getFuelEfficiency } from '../api/analytics';
import { getVehicles } from '../api/vehicles';
import { getMaintenance } from '../api/maintenance';
import { toast } from 'react-toastify';
import {
  Truck,
  Fuel,
  Wrench,
  Activity,
  AlertTriangle,
  RotateCw,
  PieChart as PieIcon,
  BarChart2
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import './FleetDashboard.css';

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  Available: '#22c55e',
  Assigned: '#a855f7',
  'In Transit': '#22d3ee',
  Maintenance: '#f59e0b',
  'Out of Service': '#ef4444',
};

export default function FleetDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [utilizationData, setUtilizationData] = useState(null);

  useEffect(() => {
    if (user && user.role !== 'Admin' && user.role !== 'FleetManager') {
      toast.error('Access forbidden: Fleet Analytics is restricted to Admin and Fleet Managers.');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);
  const [fuelData, setFuelData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [utilRes, fuelRes, vehRes, maintRes] = await Promise.all([
        getFleetUtilization(),
        getFuelEfficiency(),
        getVehicles(),
        getMaintenance(),
      ]);

      setUtilizationData(utilRes.data || null);
      setFuelData(fuelRes.data || null);
      setVehicles(vehRes.data || []);
      setMaintenanceRecords(maintRes.data || []);
    } catch (err) {
      toast.error('Failed to load Fleet Analytics Dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Pie chart data
  const pieChartData = utilizationData
    ? Object.entries(utilizationData.status_counts || {}).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  // Vehicle fuel efficiency bar chart data
  const fuelBarData = (fuelData?.vehicles || []).map((v) => ({
    name: v.registration_number || 'Vehicle',
    efficiency: v.fuel_efficiency_km_per_liter,
    cost: v.total_fuel_cost,
  }));

  // Maintenance summary
  const overdueMaint = maintenanceRecords.filter(
    (m) => m.status?.toLowerCase() === 'overdue' || m.status?.toLowerCase() === 'scheduled'
  );

  return (
    <div className="fleet-dash-wrapper">
      <main className="page-container">
        <div className="page-header">
          <div className="page-title-group">
            <h1>Fleet Operational Analytics</h1>
            <p>Real-time fleet utilization, fuel efficiency metrics, and maintenance scheduling</p>
          </div>
          <button className="btn btn-secondary" onClick={fetchDashboardData} disabled={loading}>
            <RotateCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="fleet-dash-kpi-grid">
          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box total-box">
                <Truck size={22} />
              </div>
              <span className="kpi-badge">Total Assets</span>
            </div>
            <span className="kpi-label">Active Registered Vehicles</span>
            <strong className="kpi-number">{vehicles.length}</strong>
            <div className="kpi-sub-stats">
              <span>{utilizationData?.status_counts?.['Available'] ?? 0} Available</span> •{' '}
              <span>{utilizationData?.status_counts?.['In Transit'] ?? 0} In Transit</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box ship-box" style={{ background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee' }}>
                <Activity size={22} />
              </div>
              <span className="kpi-badge">Utilization</span>
            </div>
            <span className="kpi-label">Fleet Utilization %</span>
            <strong className="kpi-number">
              {utilizationData && (utilizationData.status_percentages?.['In Transit'] !== undefined || utilizationData.status_percentages?.['Assigned'] !== undefined)
                ? `${(
                    (utilizationData.status_percentages['In Transit'] || 0) +
                    (utilizationData.status_percentages['Assigned'] || 0)
                  ).toFixed(1)}%`
                : 'No data yet'}
            </strong>
            <div className="kpi-sub-stats">
              <span>Active Dispatches vs Fleet Size</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box trip-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                <Fuel size={22} />
              </div>
              <span className="kpi-badge">Fuel Metric</span>
            </div>
            <span className="kpi-label">Fleet Avg Efficiency</span>
            <strong className="kpi-number">
              {fuelData?.fleet_avg_km_per_liter != null
                ? `${fuelData.fleet_avg_km_per_liter} km/L`
                : 'No data yet'}
            </strong>
            <div className="kpi-sub-stats">
              <span>Total Distance / Logged Fuel</span>
            </div>
          </div>

          <div className="kpi-card ff-card">
            <div className="kpi-top">
              <div className="kpi-icon-box alert-box">
                <Wrench size={22} />
              </div>
              <span className="kpi-badge">Service Alerts</span>
            </div>
            <span className="kpi-label">Upcoming / Overdue Maintenance</span>
            <strong className="kpi-number">{overdueMaint.length}</strong>
            <div className="kpi-sub-stats">
              <span>Pending Service Visits</span>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="charts-grid-layout">
          {/* Vehicle Status Pie Chart */}
          <div className="ff-card chart-card">
            <div className="chart-header">
              <h2>
                <PieIcon size={18} color="#22d3ee" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Vehicle Status Breakdown
              </h2>
              <p className="dash-sub">Distribution of fleet vehicles by current operational status</p>
            </div>
            {pieChartData.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieChartData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#141830', borderColor: '#283056', color: '#f8fafc' }} />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '0.85rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="no-data-placeholder">No data yet</div>
            )}
          </div>

          {/* Vehicle Fuel Efficiency Bar Chart */}
          <div className="ff-card chart-card">
            <div className="chart-header">
              <h2>
                <BarChart2 size={18} color="#c084fc" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Vehicle Fuel Efficiency (km/L)
              </h2>
              <p className="dash-sub">Distance traveled vs fuel consumed breakdown per vehicle</p>
            </div>
            {fuelBarData.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={fuelBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222948" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#141830', borderColor: '#283056', color: '#f8fafc' }} />
                    <Bar dataKey="efficiency" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Efficiency (km/L)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="no-data-placeholder">No data yet</div>
            )}
          </div>
        </div>

        {/* Maintenance & Vehicle List */}
        <div className="dashboard-grid-layout" style={{ marginTop: '24px' }}>
          <div className="ff-card dash-section" style={{ flex: 1 }}>
            <h2>Upcoming & Pending Maintenance Services</h2>
            <p className="dash-sub">Vehicles scheduled for preventative maintenance or inspection</p>
            {overdueMaint.length === 0 ? (
              <div className="no-data-placeholder">No pending maintenance visits</div>
            ) : (
              <table className="ff-table" style={{ marginTop: '14px' }}>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Service Type</th>
                    <th>Scheduled Date</th>
                    <th>Status</th>
                    <th>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueMaint.slice(0, 5).map((m) => (
                    <tr key={m.maintenance_id}>
                      <td>
                        <strong>{m.registration_number || 'Vehicle'}</strong>
                      </td>
                      <td>{m.service_type}</td>
                      <td>{m.scheduled_date || 'N/A'}</td>
                      <td>
                        <span className="status-pill status-leave">{m.status}</span>
                      </td>
                      <td>${m.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
