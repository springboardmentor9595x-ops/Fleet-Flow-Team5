import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVehicleStats, getVehicles } from '../api/vehicles';
import { getShipments, getDelayedAlerts } from '../api/shipments';
import { getTrips } from '../api/trips';
import {
  getMyAttendanceSummary,
  getMyAttendanceHistory,
  getMyTodayAttendance,
  checkInDriver,
  checkOutDriver
} from '../api/attendance';
import {
  getDriverPerformance,
  getDeliveryPerformance,
  getMaintenanceAnalytics,
  getOperationalSummary,
  getFleetUtilization,
  getFuelEfficiency
} from '../api/analytics';
import { getMaintenance } from '../api/maintenance';
import { getFuelRecords, getFuelStatsAndTrends } from '../api/fuel';
import { getNotifications } from '../api/notifications';
import { getLeaveRequests } from '../api/leave';
import { getLatestLocations } from '../api/socket';
import { toast } from 'react-toastify';

import {
  Truck,
  Package,
  Navigation,
  AlertTriangle,
  MapPin,
  ArrowRight,
  Radio,
  Users,
  Wrench,
  Fuel,
  CalendarCheck,
  Award,
  TrendingUp,
  BarChart2,
  Clock,
  RotateCw,
  Activity,
  Zap,
  PieChart as PieIcon,
  Server,
  Layers,
  ShieldAlert,
  CheckCircle2,
  FileText,
  UserCheck
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
  Legend,
  ResponsiveContainer
} from 'recharts';
import './Dashboard.css';

const STATUS_COLORS = {
  Available: '#22c55e',
  Assigned: '#a855f7',
  'In Transit': '#22d3ee',
  Maintenance: '#f59e0b',
  'Out of Service': '#ef4444',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role || 'Admin';
  const isAdmin = role === 'Admin';
  const isFleetManager = role === 'FleetManager';
  const isDispatcher = role === 'Dispatcher';
  const isDriver = role === 'Driver';

  // Exact 4 Admin Dashboard Internal Tabs Architecture
  const roleTabs = (isAdmin || isFleetManager)
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'logistics_dashboard', label: 'Logistics Dashboard' },
        { id: 'admin_insights', label: 'Admin Insights' },
        { id: 'fleet_analytics', label: 'Fleet Analytics' },
      ]
    : isDispatcher
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'logistics_dashboard', label: 'Logistics Dashboard' },
      ]
    : [
        { id: 'overview', label: 'Overview' },
        { id: 'my_trip', label: 'My Trip' },
        { id: 'my_perf', label: 'My Performance' },
        { id: 'my_att', label: 'My Attendance' },
        { id: 'my_vehicle', label: 'My Vehicle' },
      ];

  const validTabIds = roleTabs.map(t => t.id);
  const rawParamTab = searchParams.get('tab');

  // URL Query Sync with legacy aliases
  let targetTab = rawParamTab;
  if (rawParamTab === 'fleet') targetTab = 'fleet_analytics';
  if (rawParamTab === 'logistics') targetTab = 'logistics_dashboard';
  if (rawParamTab === 'admin_analytics' || rawParamTab === 'analytics') targetTab = 'admin_insights';
  if (rawParamTab === 'system' || rawParamTab === 'alerts') targetTab = 'admin_insights';

  const activeTab = validTabIds.includes(targetTab) ? targetTab : 'overview';

  const handleTabSelect = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // Data States
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState(false);

  // Fleet States
  const [vehiclesList, setVehiclesList] = useState([]);
  const [vehicleStats, setVehicleStats] = useState({ total: 0, available: 0, in_transit: 0, maintenance: 0, out_of_service: 0 });
  const [utilizationData, setUtilizationData] = useState(null);
  const [utilizationLoading, setUtilizationLoading] = useState(true);
  const [utilizationError, setUtilizationError] = useState(false);
  const [fuelEfficiency, setFuelEfficiency] = useState(null);
  const [fuelStats, setFuelStats] = useState(null);
  const [fuelRecords, setFuelRecords] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);

  // Logistics States
  const [shipments, setShipments] = useState([]);
  const [trips, setTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [deliveryPerf, setDeliveryPerf] = useState(null);

  // Admin States
  const [operationalData, setOperationalData] = useState(null);
  const [driverPerfData, setDriverPerfData] = useState(null);
  const [maintenanceData, setMaintenanceData] = useState(null);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState([]);

  // Driver Personal Dashboard States
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);
  const [driverShipments, setDriverShipments] = useState([]);
  const [driverVehicles, setDriverVehicles] = useState([]);
  const [driverLeaves, setDriverLeaves] = useState([]);
  const [driverNotifications, setDriverNotifications] = useState([]);

  // Scoped Data Fetching - Only calls authorized endpoints for active tab & role
  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setGlobalError(false);

    try {
      if (isAdmin || isFleetManager) {
        // Tab 1: Overview
        if (activeTab === 'overview') {
          setUtilizationLoading(true);
          setUtilizationError(false);
          const [vStatsRes, utilRes, shipRes, tripRes, delayedRes, leaveRes, maintRes, notifRes] = await Promise.all([
            getVehicleStats().catch(() => ({ data: {} })),
            getFleetUtilization().catch((err) => {
              console.error('Failed to load fleet utilization:', err);
              setUtilizationError(true);
              return { data: null };
            }),
            getShipments({ limit: 100 }).catch(() => ({ data: [] })),
            getTrips({ limit: 100 }).catch(() => ({ data: [] })),
            getDelayedAlerts().catch(() => ({ data: [] })),
            getLeaveRequests({ status: 'Pending' }).catch(() => ({ data: [] })),
            getMaintenance().catch(() => ({ data: [] })),
            getNotifications({ limit: 5 }).catch(() => ({ data: [] }))
          ]);
          setVehicleStats(vStatsRes.data || {});
          if (utilRes?.data) {
            setUtilizationData(utilRes.data);
            setUtilizationError(false);
          }
          setUtilizationLoading(false);
          setShipments(shipRes.data || []);
          setTrips(tripRes.data || []);
          setAlerts(delayedRes.data || []);
          setPendingLeaveRequests(leaveRes.data || []);
          setMaintenanceRecords(maintRes.data || []);
          setSystemNotifications(notifRes.data || []);
        }

        // Tab 2: Logistics Dashboard
        if (activeTab === 'logistics_dashboard') {
          const [shipRes, tripRes, delivRes, delayedRes] = await Promise.all([
            getShipments({ limit: 100 }).catch(() => ({ data: [] })),
            getTrips({ limit: 100 }).catch(() => ({ data: [] })),
            getDeliveryPerformance().catch(() => ({ data: null })),
            getDelayedAlerts().catch(() => ({ data: [] }))
          ]);
          setShipments(shipRes.data || []);
          setTrips(tripRes.data || []);
          setDeliveryPerf(delivRes.data || null);
          setAlerts(delayedRes.data || []);
        }

        // Tab 3: Admin Insights
        if (activeTab === 'admin_insights') {
          const [opsRes, drvPerfRes, maintAnalyticsRes, notifRes, leaveRes, delivRes] = await Promise.all([
            getOperationalSummary().catch(() => ({ data: null })),
            getDriverPerformance().catch(() => ({ data: null })),
            getMaintenanceAnalytics().catch(() => ({ data: null })),
            getNotifications({ limit: 10 }).catch(() => ({ data: [] })),
            getLeaveRequests({ status: 'Pending' }).catch(() => ({ data: [] })),
            getDeliveryPerformance().catch(() => ({ data: null }))
          ]);
          setOperationalData(opsRes.data || null);
          setDriverPerfData(drvPerfRes.data || null);
          setMaintenanceData(maintAnalyticsRes.data || null);
          setSystemNotifications(notifRes.data || []);
          setPendingLeaveRequests(leaveRes.data || []);
          setDeliveryPerf(delivRes.data || null);
        }

        // Tab 4: Fleet Analytics
        if (activeTab === 'fleet_analytics') {
          setUtilizationLoading(true);
          setUtilizationError(false);
          const [vRes, vStatsRes, utilRes, fuelEffRes, fuelStatsRes, fuelRecsRes, maintRes] = await Promise.all([
            getVehicles().catch(() => ({ data: [] })),
            getVehicleStats().catch(() => ({ data: {} })),
            getFleetUtilization().catch((err) => {
              console.error('Failed to load fleet utilization API:', err);
              setUtilizationError(true);
              return { data: null };
            }),
            getFuelEfficiency().catch(() => ({ data: null })),
            getFuelStatsAndTrends().catch(() => ({ data: null })),
            getFuelRecords({ limit: 100 }).catch(() => ({ data: [] })),
            getMaintenance().catch(() => ({ data: [] }))
          ]);
          setVehiclesList(vRes.data || []);
          setVehicleStats(vStatsRes.data || {});
          if (utilRes?.data) {
            setUtilizationData(utilRes.data);
            setUtilizationError(false);
          }
          setUtilizationLoading(false);
          setFuelEfficiency(fuelEffRes.data || null);
          setFuelStats(fuelStatsRes.data || null);
          setFuelRecords(fuelRecsRes.data || []);
          setMaintenanceRecords(maintRes.data || []);
        }
      } else if (isDispatcher) {
        if (activeTab === 'overview' || activeTab === 'logistics_dashboard') {
          const [shipRes, tripRes, delivRes, delayedRes] = await Promise.all([
            getShipments({ limit: 100 }).catch(() => ({ data: [] })),
            getTrips({ limit: 100 }).catch(() => ({ data: [] })),
            getDeliveryPerformance().catch(() => ({ data: null })),
            getDelayedAlerts().catch(() => ({ data: [] }))
          ]);
          setShipments(shipRes.data || []);
          setTrips(tripRes.data || []);
          setDeliveryPerf(delivRes.data || null);
          setAlerts(delayedRes.data || []);
        }
      } else if (isDriver) {
        const [todayAttRes, attSumRes, attHistRes, tripRes, shipRes, vehRes, leaveRes, notifRes] = await Promise.all([
          getMyTodayAttendance().catch(() => ({ data: null })),
          getMyAttendanceSummary().catch(() => ({ data: null })),
          getMyAttendanceHistory().catch(() => ({ data: [] })),
          getTrips({ limit: 100 }).catch(() => ({ data: [] })),
          getShipments({ limit: 100 }).catch(() => ({ data: [] })),
          getVehicles({ limit: 10 }).catch(() => ({ data: [] })),
          getLeaveRequests().catch(() => ({ data: [] })),
          getNotifications({ limit: 50 }).catch(() => ({ data: [] }))
        ]);
        setTodayAttendance(todayAttRes?.data || null);
        setAttendanceSummary(attSumRes?.data || null);
        setAttendanceHistory(attHistRes?.data || []);
        setDriverTrips(tripRes?.data || []);
        setDriverShipments(shipRes?.data || []);
        setDriverVehicles(vehRes?.data || []);
        setDriverLeaves(leaveRes?.data || []);
        setDriverNotifications(notifRes?.data || []);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isFleetManager, isDispatcher, isDriver, activeTab]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleDriverCheckIn = async () => {
    try {
      const res = await checkInDriver();
      toast.success(`Checked in successfully at ${res.data.check_in || 'now'}!`);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to check in:', err);
      toast.error(err.response?.data?.detail || 'Failed to check in.');
    }
  };

  const handleDriverCheckOut = async () => {
    try {
      const res = await checkOutDriver();
      toast.success(`Checked out successfully at ${res.data.check_out || 'now'}!`);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to check out:', err);
      toast.error(err.response?.data?.detail || 'Failed to check out.');
    }
  };

  const renderDriverDashboard = () => {
    const activeTrip = driverTrips.find(t => ['in transit', 'assigned', 'dispatched', 'active'].includes((t.status || '').toLowerCase()));
    const activeShipment = driverShipments.find(s => ['in transit', 'assigned'].includes((s.status || '').toLowerCase()));
    const assignedVehicle = driverVehicles.find(v => v.assigned_driver) || (driverVehicles.length > 0 ? driverVehicles[0] : null);

    const isCheckedIn = !!todayAttendance?.check_in;
    const isCheckedOut = !!todayAttendance?.check_out;
    const todayStatus = todayAttendance?.status || 'Not Logged';

    const completedTripsCount = driverTrips.filter(t => (t.status || '').toLowerCase() === 'completed').length;
    const deliveredShipmentsCount = driverShipments.filter(s => (s.status || '').toLowerCase() === 'delivered').length;
    const totalAssignedTrips = driverTrips.length;
    const onTimeRate = (totalAssignedTrips > 0 && deliveredShipmentsCount > 0)
      ? Math.round((deliveredShipmentsCount / totalAssignedTrips) * 100)
      : null;
    const attRate = attendanceSummary?.attendance_rate_pct ?? null;

    return (
      <div className="driver-dashboard-container">
        {/* Header */}
        <div className="driver-header-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div>
            <h1 className="driver-dashboard-title" style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>Driver Dashboard</h1>
            <p className="driver-dashboard-welcome" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
              Welcome back, <strong style={{ color: 'var(--accent-primary)' }}>{user?.full_name || 'Driver'}</strong>
            </p>
          </div>
          <button className="refresh-btn" onClick={fetchDashboardData} title="Refresh My Dashboard">
            <RotateCw size={18} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Top 2 Cards Row: Today's Attendance & Current Assignment */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          
          {/* 1. TODAY'S ATTENDANCE */}
          <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={22} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Today's Attendance</h3>
              </div>
              <span className={`status-badge badge-${todayStatus.toLowerCase()}`}>
                {todayStatus}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Date</span>
                <strong style={{ fontSize: '0.9rem' }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Check-in</span>
                <strong style={{ fontSize: '0.9rem', color: isCheckedIn ? '#22c55e' : 'var(--text-muted)' }}>
                  {todayAttendance?.check_in || 'Not checked in'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Check-out</span>
                <strong style={{ fontSize: '0.9rem', color: isCheckedOut ? '#a855f7' : 'var(--text-muted)' }}>
                  {todayAttendance?.check_out || 'Not checked out'}
                </strong>
              </div>
            </div>

            {todayAttendance?.working_hours && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                ⏱️ Working time: <strong style={{ color: 'var(--text-primary)' }}>{todayAttendance.working_hours}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {!isCheckedIn ? (
                <button className="btn btn-primary" onClick={handleDriverCheckIn} style={{ flex: 1, width: '100%' }}>
                  <UserCheck size={18} />
                  <span>Check In</span>
                </button>
              ) : !isCheckedOut ? (
                <button className="btn btn-warning" onClick={handleDriverCheckOut} style={{ flex: 1, width: '100%', backgroundColor: '#f59e0b', color: '#fff', border: 'none' }}>
                  <Clock size={18} />
                  <span>Check Out</span>
                </button>
              ) : (
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, width: '100%', textAlign: 'center' }}>
                  ✓ Shift Completed ({todayAttendance?.working_hours})
                </div>
              )}
            </div>
          </div>

          {/* 2. CURRENT ASSIGNMENT */}
          <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem', borderLeft: '4px solid #22d3ee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={22} color="#22d3ee" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Current Assignment</h3>
              </div>
              {(activeTrip || activeShipment) && (
                <span className="status-badge badge-in-transit">
                  {activeTrip?.status || activeShipment?.status || 'Active'}
                </span>
              )}
            </div>

            {activeTrip || activeShipment ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shipment / Trip</span>
                    <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {activeShipment?.tracking_number || (activeTrip ? `#${String(activeTrip.trip_id).slice(0, 8)}` : 'N/A')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Vehicle</span>
                    <div style={{ fontWeight: 600 }}>
                      {assignedVehicle?.registration_number || activeTrip?.vehicle_id || 'Assigned Truck'}
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <MapPin size={16} color="#22c55e" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>From: {activeShipment?.source || activeTrip?.start_location || 'Origin'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} color="#ef4444" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>To: {activeShipment?.destination || activeTrip?.destination || 'Destination'}</span>
                  </div>
                </div>

                {activeShipment?.tracking_number && (
                  <Link to={`/tracking/${activeShipment.tracking_number}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    <Radio size={18} />
                    <span>Track Live</span>
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                <Package size={36} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontWeight: 500 }}>No active assignment</p>
                <span style={{ fontSize: '0.8rem' }}>You currently have no pending or in-transit dispatches.</span>
              </div>
            )}
          </div>
        </div>

        {/* Middle Row: My Trips & My Shipments */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          
          {/* 3. MY TRIPS */}
          <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>My Trips</h3>
              </div>
              <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{driverTrips.length} Total</span>
            </div>

            {driverTrips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No trips assigned yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Trip ID</th>
                      <th>Route</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverTrips.slice(0, 5).map((t) => (
                      <tr key={t.trip_id}>
                        <td style={{ fontWeight: 600 }}>#{String(t.trip_id).slice(0, 8)}</td>
                        <td>{t.start_location || 'Origin'} → {t.destination || 'Dest'}</td>
                        <td>
                          <span className={`status-badge badge-${(t.status || 'scheduled').toLowerCase().replace(' ', '-')}`}>
                            {t.status}
                          </span>
                        </td>
                        <td>
                          <Link to="/trips" className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>View Trip</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. MY SHIPMENTS */}
          <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} color="#a855f7" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>My Shipments</h3>
              </div>
              <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{driverShipments.length} Total</span>
            </div>

            {driverShipments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No shipments assigned yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Tracking #</th>
                      <th>Destination</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverShipments.slice(0, 5).map((s) => (
                      <tr key={s.shipment_id}>
                        <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{s.tracking_number}</td>
                        <td>{s.destination}</td>
                        <td>
                          <span className={`status-badge badge-${(s.status || 'created').toLowerCase().replace(' ', '-')}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Lower Row: My Vehicle & My Leave & My Performance */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>

          {/* 5. MY VEHICLE */}
          <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Truck size={20} color="#22c55e" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>My Vehicle</h3>
            </div>

            {assignedVehicle ? (
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--accent-primary)' }}>{assignedVehicle.registration_number}</strong>
                  <span className={`status-badge badge-${(assignedVehicle.status || 'available').toLowerCase().replace(' ', '-')}`}>
                    {assignedVehicle.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  {assignedVehicle.brand} {assignedVehicle.model} ({assignedVehicle.vehicle_type})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div>Fuel: <strong>{assignedVehicle.fuel_type || 'Diesel'}</strong></div>
                  <div>Capacity: <strong>{assignedVehicle.capacity ? `${assignedVehicle.capacity} kg` : 'Standard'}</strong></div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No vehicle currently assigned.
              </div>
            )}
          </div>

          {/* 6. MY LEAVE */}
          <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarCheck size={20} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>My Leave Requests</h3>
              </div>
              <Link to="/leave-requests" className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem' }}>Request Leave</Link>
            </div>

            {driverLeaves.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No leave requests found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {driverLeaves.slice(0, 3).map((l) => (
                  <div key={l.leave_id} style={{ background: 'var(--bg-secondary)', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{l.leave_type}</span>
                      <span className={`status-badge badge-${(l.status || 'pending').toLowerCase()}`}>{l.status}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {l.start_date} → {l.end_date}
                    </div>
                    {l.rejection_reason && (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>
                        Reason: {l.rejection_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. MY PERFORMANCE */}
          <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Award size={20} color="#3b82f6" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>My Performance</h3>
            </div>

            {completedTripsCount === 0 && deliveredShipmentsCount === 0 && attRate === null ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No performance data available yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trips Completed</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{completedTripsCount}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delivered</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22c55e' }}>{deliveredShipmentsCount}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attendance Rate</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{attRate !== null ? `${attRate}%` : 'N/A'}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>On-Time Rate</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a855f7' }}>{onTimeRate !== null ? `${onTimeRate}%` : '100%'}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 8. MY NOTIFICATIONS CENTER */}
        <div className="dashboard-card shadow-sm" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Notifications</h3>
            </div>
            <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              {driverNotifications.filter(n => !n.is_read).length} Unread
            </span>
          </div>

          {driverNotifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No notifications yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {driverNotifications.slice(0, 5).map((n) => (
                <div key={n.notification_id} style={{ background: n.is_read ? 'var(--bg-secondary)' : 'rgba(59, 130, 246, 0.08)', padding: '0.75rem 1rem', borderRadius: '6px', borderLeft: n.is_read ? '3px solid transparent' : '3px solid var(--accent-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.85rem' }}>
                    <span>{n.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Derived Metrics
  const activeShipmentsCount = shipments.filter(s =>
    ['created', 'assigned', 'in transit', 'delayed'].includes((s.status || '').toLowerCase())
  ).length;

  const deliveredShipmentsCount = shipments.filter(s => (s.status || '').toLowerCase() === 'delivered').length;
  const activeTripsCount = trips.filter(t => (t.status || '').toLowerCase().includes('transit')).length;

  const upcomingMaintenanceCount = maintenanceRecords.filter(m =>
    ['scheduled', 'in progress', 'pending'].includes((m.status || '').toLowerCase())
  ).length;

  const myActiveTrip = trips.find(t => (t.status || '').toLowerCase().includes('transit') || (t.status || '').toLowerCase() === 'assigned');

  // Chart Data Constructions
  const statusPieData = [
    { name: 'Available', value: vehicleStats.available || 0 },
    { name: 'Assigned', value: vehicleStats.assigned || 0 },
    { name: 'In Transit', value: vehicleStats.in_transit || 0 },
    { name: 'Maintenance', value: vehicleStats.maintenance || 0 },
    { name: 'Out of Service', value: vehicleStats.out_of_service || 0 },
  ].filter(d => d.value > 0);

  const vehicleTypeCounts = vehiclesList.reduce((acc, v) => {
    const type = v.vehicle_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const standardShipmentStatuses = ['Created', 'Assigned', 'In Transit', 'Delayed', 'Delivered', 'Cancelled'];

  const shipmentStatusCounts = standardShipmentStatuses.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  shipments.forEach((s) => {
    const st = (s.status || '').trim();
    const matchedKey = standardShipmentStatuses.find(k => k.toLowerCase() === st.toLowerCase());
    if (matchedKey) {
      shipmentStatusCounts[matchedKey] += 1;
    } else if (st) {
      shipmentStatusCounts[st] = (shipmentStatusCounts[st] || 0) + 1;
    }
  });

  const statusChartData = Object.entries(shipmentStatusCounts).map(([status, count]) => ({
    name: status,
    count: count
  }));

  if (loading) {
    return <div className="status" style={{ padding: '2rem', color: '#94a3b8' }}>Loading FleetFlow Dashboard...</div>;
  }

  if (globalError) {
    return (
      <div className="dashboard-container" style={{ padding: '3rem', textAlign: 'center' }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem', display: 'inline-block' }} />
        <h2 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Unable to load dashboard data. Please try again.</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>A network error or authorization issue occurred while connecting to FleetFlow API.</p>
        <button className="btn btn-primary" onClick={() => fetchDashboardData()} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <RotateCw size={16} /> Retry
        </button>
      </div>
    );
  }

  if (isDriver) {
    return (
      <div className="dashboard-container">
        {renderDriverDashboard()}
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dash-header">
        <div>
          <h1 className="dash-title">FleetFlow Unified Dashboard</h1>
          <p className="dash-subtitle">
            Role: <span style={{ color: '#38bdf8', fontWeight: '600' }}>{role}</span> | Real-time operations & fleet intelligence
          </p>
        </div>
      </header>

      <main className="dash-content">
        {/* Top Operational Quick Links */}
        <div className="ff-card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="font-semibold" style={{ color: '#94a3b8', marginRight: '0.5rem' }}>Navigation:</span>
            <Link to="/shipments" className="btn btn-secondary btn-sm"><Package size={16} /> Manage Shipments</Link>
            <Link to="/trips" className="btn btn-secondary btn-sm"><Navigation size={16} /> Trip Dispatcher</Link>
            <Link to="/live-map" className="btn btn-secondary btn-sm"><Radio size={16} /> Live GPS Map</Link>
            <Link to="/vehicles" className="btn btn-secondary btn-sm"><Truck size={16} /> Vehicles</Link>
            <Link to="/maintenance" className="btn btn-secondary btn-sm"><Wrench size={16} /> Maintenance</Link>
            <Link to="/reports" className="btn btn-secondary btn-sm"><FileText size={16} /> Reports</Link>
          </div>
        </div>

        {/* Role-Aware Internal Tabs Navigation Bar */}
        <div className="dashboard-nav-tabs">
          {roleTabs.map((tab) => (
            <button
              key={tab.id}
              className={`dash-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabSelect(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================================================
            1. OVERVIEW TAB (Executive Snapshot Only)
            ================================================== */}
        {activeTab === 'overview' && (
          <div className="tab-content-area">
            {/* KPI Summary Grid */}
            <div className="kpi-cards-grid">
              {(isAdmin || isFleetManager) && (
                <>
                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box total-box"><Truck size={22} /></div>
                      <span className="kpi-badge">{vehicleStats.total || 0} Registered</span>
                    </div>
                    <span className="kpi-label">Active Fleet Vehicles</span>
                    <strong className="kpi-number">{vehicleStats.total || 0}</strong>
                    <span className="kpi-sub-stats">
                      {vehicleStats.available || 0} Available, {(vehicleStats.in_transit || 0) + (vehicleStats.assigned || 0)} Utilized
                    </span>
                  </div>

                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box ship-box" style={{ background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee' }}><Activity size={22} /></div>
                      <span className="kpi-badge active-badge">
                        {utilizationLoading
                          ? 'Loading'
                          : utilizationError
                          ? 'Error'
                          : `${utilizationData?.utilized_vehicles ?? 0}/${utilizationData?.total_active_vehicles ?? 0} Active`}
                      </span>
                    </div>
                    <span className="kpi-label">Fleet Utilization</span>
                    <strong className="kpi-number">
                      {utilizationLoading
                        ? 'Loading...'
                        : utilizationError
                        ? 'Unavailable'
                        : `${utilizationData?.fleet_utilization_rate_pct ?? 0}%`}
                    </strong>
                    <span className="kpi-sub-stats">
                      {utilizationLoading
                        ? 'Fetching active vehicle utilization...'
                        : utilizationError
                        ? 'Telemetry unavailable'
                        : `${utilizationData?.utilized_vehicles ?? 0} of ${utilizationData?.total_active_vehicles ?? 0} active vehicles utilized`}
                    </span>
                  </div>
                </>
              )}

              {(isAdmin || isFleetManager || isDispatcher) && (
                <>
                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box ship-box"><Package size={22} /></div>
                      <span className="kpi-badge">{activeShipmentsCount} Active</span>
                    </div>
                    <span className="kpi-label">Total Active Shipments</span>
                    <strong className="kpi-number">{shipments.length}</strong>
                    <span className="kpi-sub-stats">{activeShipmentsCount} loads in dispatch / transit</span>
                  </div>

                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box ship-box" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}><Navigation size={22} /></div>
                      <span className="kpi-badge">{activeTripsCount} Active</span>
                    </div>
                    <span className="kpi-label">Active Trips</span>
                    <strong className="kpi-number">{activeTripsCount}</strong>
                    <span className="kpi-sub-stats">Trips currently executing on road</span>
                  </div>

                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box ship-box" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}><CheckCircle2 size={22} /></div>
                      <span className="kpi-badge">{deliveredShipmentsCount} Completed</span>
                    </div>
                    <span className="kpi-label">Delivered Shipments</span>
                    <strong className="kpi-number" style={{ color: '#22c55e' }}>{deliveredShipmentsCount}</strong>
                    <span className="kpi-sub-stats">Successfully delivered loads</span>
                  </div>

                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}><AlertTriangle size={22} /></div>
                      <span className="kpi-badge">{alerts.length} Pending</span>
                    </div>
                    <span className="kpi-label">Delayed Alerts</span>
                    <strong className="kpi-number" style={{ color: alerts.length > 0 ? '#ef4444' : '#22c55e' }}>{alerts.length}</strong>
                    <span className="kpi-sub-stats">{alerts.length} exception alerts requiring attention</span>
                  </div>
                </>
              )}

              {(isAdmin || isFleetManager) && (
                <>
                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}><Users size={22} /></div>
                      <span className="kpi-badge">{pendingLeaveRequests.length} Pending</span>
                    </div>
                    <span className="kpi-label">Pending Leave Requests</span>
                    <strong className="kpi-number" style={{ color: pendingLeaveRequests.length > 0 ? '#f59e0b' : '#38bdf8' }}>
                      {pendingLeaveRequests.length}
                    </strong>
                    <span className="kpi-sub-stats">{pendingLeaveRequests.length} driver leave requests awaiting review</span>
                  </div>

                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}><Wrench size={22} /></div>
                      <span className="kpi-badge">{upcomingMaintenanceCount} Active</span>
                    </div>
                    <span className="kpi-label">Upcoming Maintenance</span>
                    <strong className="kpi-number">{upcomingMaintenanceCount}</strong>
                    <span className="kpi-sub-stats">Vehicles queued for service inspection</span>
                  </div>
                </>
              )}

              {isDriver && (
                <>
                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box ship-box"><Navigation size={22} /></div>
                    </div>
                    <span className="kpi-label">My Active Trip Status</span>
                    <strong className="kpi-number" style={{ fontSize: '1.2rem' }}>{myActiveTrip ? myActiveTrip.status : 'No Active Trip'}</strong>
                  </div>

                  <div className="kpi-card ff-card">
                    <div className="kpi-top">
                      <div className="kpi-icon-box total-box"><CalendarCheck size={22} /></div>
                    </div>
                    <span className="kpi-label">Days Present</span>
                    <strong className="kpi-number">{attendanceSummary?.present_days || 0}</strong>
                  </div>
                </>
              )}
            </div>

            {/* Operational Exception Highlights Snapshot */}
            <div className="dashboard-grid-2" style={{ marginTop: '1.5rem' }}>
              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Operational Exception Warnings</h3>
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {alerts.length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>No active route delays reported.</p>
                  ) : (
                    alerts.slice(0, 4).map((a, i) => (
                      <div key={a.shipment_id || i} style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.08)', borderRadius: '0.5rem', borderLeft: '3px solid #ef4444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="font-semibold" style={{ color: '#f87171' }}>{a.shipment_code || 'Delayed Load'}</span>
                          <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>{a.status}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0.2rem 0 0 0' }}>
                          {a.origin} &rarr; {a.destination} | Reason: {a.delay_reason || 'Route congestion'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Quick Operations Shortcuts</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Access core FleetFlow modules for management and workflow operations:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  <Link to="/shipments" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Package size={16} /> Manage Shipments & Loads</Link>
                  <Link to="/trips" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Navigation size={16} /> Open Trip Dispatcher</Link>
                  <Link to="/maintenance" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Wrench size={16} /> Fleet Vehicle Maintenance</Link>
                  <Link to="/leave-requests" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Users size={16} /> Review Pending Driver Leaves ({pendingLeaveRequests.length})</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            2. LOGISTICS DASHBOARD TAB
            ================================================== */}
        {(isAdmin || isFleetManager || isDispatcher) && activeTab === 'logistics_dashboard' && (
          <div className="tab-content-area">
            {/* Logistics Performance Metrics */}
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Total Shipments</span>
                  <span className="stat-value">{deliveryPerf?.total_shipments ?? shipments.length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">On-Time Delivery Rate</span>
                  <span className="stat-value" style={{ color: '#22c55e' }}>{deliveryPerf?.on_time_rate_pct ?? 100}%</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Delayed Rate</span>
                  <span className="stat-value" style={{ color: '#ef4444' }}>{deliveryPerf?.delayed_rate_pct ?? 0}%</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Avg Delivery Time</span>
                  <span className="stat-value">{deliveryPerf?.average_delivery_time_hours ?? 0} hrs</span>
                </div>
              </div>
            </div>

            <div className="dashboard-grid-2" style={{ marginBottom: '1.5rem' }}>
              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Shipment Status Breakdown</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Live GPS Tracking Snapshot</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Monitor active dispatch routes, real-time vehicle GPS feeds, and trip telemetry.
                </p>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className="font-semibold">Active Operational Dispatches:</span>
                    <span style={{ color: '#22d3ee', fontWeight: 'bold' }}>{activeTripsCount} Trips</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="font-semibold">Delayed Shipment Exceptions:</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{alerts.length} Pending</span>
                  </div>
                </div>
                <Link to="/live-map" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Radio size={16} /> Open Interactive Live GPS Map
                </Link>
              </div>
            </div>

            {/* Active Trips & Delayed Shipments Tables */}
            <div className="ff-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3>Active Operational Shipments</h3>
              <table className="att-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>Tracking / Code</th>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.slice(0, 8).map((s) => (
                    <tr key={s.shipment_id || s.id}>
                      <td className="font-semibold">{s.shipment_code || s.tracking_number}</td>
                      <td>{s.origin}</td>
                      <td>{s.destination}</td>
                      <td><span className={`status-badge badge-${(s.status || '').toLowerCase().replace(/\s+/g, '')}`}>{s.status}</span></td>
                      <td>
                        <Link to={`/live-map?shipmentId=${s.shipment_id || s.id}`} className="btn-action-sm">Track Live</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================
            3. ADMIN INSIGHTS TAB (Admin & Analytics)
            ================================================== */}
        {(isAdmin || isFleetManager) && activeTab === 'admin_insights' && (
          <div className="tab-content-area">
            {/* Operational Summary Overview */}
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Total Operations Shipments</span>
                  <span className="stat-value">{operationalData?.period_total_shipments || shipments.length}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Active Dispatches Count</span>
                  <span className="stat-value" style={{ color: '#38bdf8' }}>{operationalData?.active_dispatches_count || activeTripsCount}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Total Maintenance Cost</span>
                  <span className="stat-value" style={{ color: '#f59e0b' }}>${maintenanceData?.total_maintenance_cost || 0}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Pending Leave Requests</span>
                  <span className="stat-value" style={{ color: '#a855f7' }}>{pendingLeaveRequests.length}</span>
                </div>
              </div>
            </div>

            {/* Driver Performance Table */}
            <div className="ff-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3>Driver Performance Insights</h3>
              {driverPerfData?.drivers && driverPerfData.drivers.length > 0 ? (
                <table className="att-table" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th>Driver Name</th>
                      <th>Email</th>
                      <th>Trips Completed</th>
                      <th>Delivered Shipments</th>
                      <th>On-Time Rate</th>
                      <th>Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverPerfData.drivers.map((d) => (
                      <tr key={d.driver_id}>
                        <td className="font-semibold">{d.driver_name}</td>
                        <td>{d.email}</td>
                        <td>{d.trips_completed}</td>
                        <td>{d.total_delivered_shipments}</td>
                        <td>
                          {d.on_time_rate_pct !== null ? `${d.on_time_rate_pct}%` : 'N/A'}
                        </td>
                        <td>
                          {d.attendance_rate_pct !== null ? `${d.attendance_rate_pct}%` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#94a3b8', marginTop: '1rem' }}>No driver performance records calculated yet.</p>
              )}
            </div>

            {/* Maintenance & Operational Cost Analytics */}
            <div className="ff-card" style={{ padding: '1.5rem' }}>
              <h3>Fleet Maintenance Cost & Service Analytics</h3>
              <div className="stats-grid" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <div className="stat-card">
                  <div className="stat-details">
                    <span className="stat-label">Total Maintenance Cost</span>
                    <span className="stat-value" style={{ color: '#f59e0b' }}>${maintenanceData?.total_maintenance_cost || 0}</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-details">
                    <span className="stat-label">Serviced Records Count</span>
                    <span className="stat-value">{maintenanceData?.total_maintenance_records || 0}</span>
                  </div>
                </div>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                Track detailed per-vehicle service history and maintenance invoices in the dedicated <Link to="/maintenance" style={{ color: '#38bdf8' }}>Maintenance Module</Link>.
              </p>
            </div>
          </div>
        )}

        {/* ==================================================
            4. FLEET ANALYTICS TAB
            ================================================== */}
        {(isAdmin || isFleetManager) && activeTab === 'fleet_analytics' && (
          <div className="tab-content-area">
            {/* Status & Type Distribution Grid */}
            <div className="dashboard-grid-2" style={{ marginBottom: '1.5rem' }}>
              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Fleet Vehicle Status Overview</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Vehicle Type Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  {Object.keys(vehicleTypeCounts).length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>No vehicle type records found.</p>
                  ) : (
                    Object.entries(vehicleTypeCounts).map(([type, count]) => (
                      <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem' }}>
                        <span className="font-semibold">{type}</span>
                        <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{count} vehicles</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Fuel Efficiency & Maintenance Analytics */}
            <div className="dashboard-grid-2">
              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Fuel Consumption & Efficiency</h3>
                <div style={{ marginTop: '1rem' }}>
                  <p><strong>Fleet Average Efficiency:</strong> {fuelEfficiency?.fleet_avg_km_per_liter ? `${fuelEfficiency.fleet_avg_km_per_liter} km/L` : 'Data being compiled'}</p>
                  <p><strong>Total Logged Fuel Records:</strong> {fuelRecords.length}</p>
                </div>
              </div>

              <div className="ff-card" style={{ padding: '1.5rem' }}>
                <h3>Fleet Vehicle Maintenance Schedule</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Upcoming and in-progress vehicle maintenance records:
                </p>
                {maintenanceRecords.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No vehicle maintenance records scheduled.</p>
                ) : (
                  <table className="att-table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceRecords.slice(0, 5).map((m) => (
                        <tr key={m.maintenance_id || m.id}>
                          <td className="font-semibold">{m.vehicle_id?.slice(0, 8) || 'Vehicle'}</td>
                          <td>{m.service_type || 'General Service'}</td>
                          <td><span className="status-badge badge-assigned">{m.status}</span></td>
                          <td>${m.cost || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            5. DRIVER SPECIFIC DASHBOARD TABS
            ================================================== */}
        {isDriver && activeTab === 'my_trip' && (
          <div className="tab-content-area">
            <div className="ff-card" style={{ padding: '1.5rem' }}>
              <h3>My Active Assigned Trip</h3>
              {myActiveTrip ? (
                <div style={{ marginTop: '1rem' }}>
                  <p><strong>Code:</strong> {myActiveTrip.shipment_code}</p>
                  <p><strong>Route:</strong> {myActiveTrip.origin} &rrarr; {myActiveTrip.destination}</p>
                  <p><strong>Status:</strong> {myActiveTrip.status}</p>
                  <Link to={`/live-map?shipmentId=${myActiveTrip.shipment_id}`} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    View Live Route Map
                  </Link>
                </div>
              ) : (
                <p style={{ color: '#94a3b8', marginTop: '1rem' }}>No active trip assigned to you currently.</p>
              )}
            </div>
          </div>
        )}

        {isDriver && activeTab === 'my_perf' && (
          <div className="tab-content-area">
            <div className="ff-card" style={{ padding: '1.5rem' }}>
              <h3>My Delivery & Driving Performance Score</h3>
              <div className="stats-grid" style={{ marginTop: '1rem' }}>
                <div className="stat-card">
                  <div className="stat-details">
                    <span className="stat-label">On-Time Rate</span>
                    <span className="stat-value">{driverPerfData?.on_time_pct || 100}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isDriver && activeTab === 'my_att' && (
          <div className="tab-content-area">
            <div className="ff-card" style={{ padding: '1.5rem' }}>
              <h3>My Attendance Summary</h3>
              <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                For detailed log records, visit the dedicated <Link to="/attendance" style={{ color: '#38bdf8' }}>Attendance Page</Link>.
              </p>
            </div>
          </div>
        )}

        {isDriver && activeTab === 'my_vehicle' && (
          <div className="tab-content-area">
            <div className="ff-card" style={{ padding: '1.5rem' }}>
              <h3>My Assigned Vehicle Information</h3>
              <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
                Check assigned vehicle maintenance logs and specifications.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
