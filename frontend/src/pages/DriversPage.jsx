import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DriverModal from '../components/drivers/DriverModal';
import AttendanceModal from '../components/attendance/AttendanceModal';
import { getDrivers } from '../api/drivers';
import { getVehicles, assignDriver } from '../api/vehicles';
import { getDriverAttendanceSummary } from '../api/attendance';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  UserCheck, 
  Plus, 
  Search, 
  Edit3, 
  RotateCw, 
  Shield, 
  Award, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  CalendarCheck
} from 'lucide-react';
import './DriversPage.css';

export default function DriversPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assigningDriverId, setAssigningDriverId] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const [isAttModalOpen, setIsAttModalOpen] = useState(false);
  const [attDriver, setAttDriver] = useState(null);

  const canManage = user?.role === 'Admin' || user?.role === 'FleetManager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [driversRes, vehiclesRes] = await Promise.all([
        getDrivers(),
        canManage ? getVehicles() : Promise.resolve({ data: [] }),
      ]);
      const driverList = driversRes.data || [];
      setDrivers(driverList);
      setVehicles(vehiclesRes.data || []);

      // Fetch attendance summary for each driver (Admin/FleetManager only)
      if (canManage) {
        const summaries = {};
        await Promise.all(
          driverList.map(async (d) => {
            try {
              const sumRes = await getDriverAttendanceSummary(d.driver_id);
              if (sumRes.data) {
                summaries[d.driver_id] = sumRes.data;
              }
            } catch (err) {
              // Ignore summary error if no records
            }
          })
        );
        setAttendanceSummaries(summaries);
      }
    } catch (err) {
      toast.error('Failed to load driver roster.');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVehicleAssignment = async (driver, targetVehicleId) => {
    setAssigningDriverId(driver.driver_id);
    try {
      if (targetVehicleId === 'UNASSIGN') {
        if (driver.assigned_vehicle_id) {
          await assignDriver(driver.assigned_vehicle_id, null);
          toast.success(`Driver ${driver.full_name || 'profile'} unassigned from vehicle.`);
        }
      } else {
        await assignDriver(targetVehicleId, driver.driver_id);
        const veh = vehicles.find((v) => v.vehicle_id === targetVehicleId);
        toast.success(`Assigned ${driver.full_name || 'driver'} to ${veh ? veh.registration_number : 'vehicle'}.`);
      }
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to update vehicle assignment.';
      toast.error(msg);
    } finally {
      setAssigningDriverId(null);
    }
  };

  const handleMarkAttendanceClick = (driver = null) => {
    if (!canManage) {
      toast.error('Access forbidden: Only Admin and Fleet Manager can mark attendance.');
      return;
    }
    setAttDriver(driver);
    setIsAttModalOpen(true);
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const term = searchTerm.toLowerCase();
      const name = (d.full_name || '').toLowerCase();
      const email = (d.email || '').toLowerCase();
      const license = (d.license_number || '').toLowerCase();
      const address = (d.address || '').toLowerCase();
      const matchSearch = name.includes(term) || email.includes(term) || license.includes(term) || address.includes(term);

      if (statusFilter === 'ALL') return matchSearch;
      return matchSearch && (d.status || 'Active').toLowerCase() === statusFilter.toLowerCase();
    });
  }, [drivers, searchTerm, statusFilter]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = drivers.length;
    const active = drivers.filter((d) => (d.status || 'Active').toLowerCase() === 'active').length;
    const assigned = drivers.filter((d) => d.assigned_vehicle_id).length;
    const unassigned = total - assigned;
    return { total, active, assigned, unassigned };
  }, [drivers]);

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'status-active';
    if (s === 'on leave') return 'status-leave';
    return 'status-inactive';
  };

  return (
    <div className="drivers-page-wrapper">
      <main className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Driver Roster & Vehicle Assignments</h1>
            <p>Manage driver profiles, experience credentials, and vehicle dispatch assignments</p>
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
              <RotateCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            {canManage && (
              <>
                <button className="btn btn-secondary" onClick={() => handleMarkAttendanceClick(null)}>
                  <CalendarCheck size={16} />
                  <span>Mark Attendance</span>
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSelectedDriver(null);
                    setIsModalOpen(true);
                  }}
                >
                  <Plus size={18} />
                  <span>Register Driver</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Metric Cards */}
        <div className="drivers-stats-grid">
          <div className="stat-card">
            <div className="stat-icon total-icon">
              <UserCheck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total Drivers</span>
              <span className="stat-value">{stats.total}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon active-icon">
              <CheckCircle2 size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Active Status</span>
              <span className="stat-value">{stats.active}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon assigned-icon">
              <Truck size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Assigned Vehicles</span>
              <span className="stat-value">{stats.assigned}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon unassigned-icon">
              <Clock size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-label">Unassigned</span>
              <span className="stat-value">{stats.unassigned}</span>
            </div>
          </div>
        </div>

        {/* Controls and Search Bar */}
        <div className="table-controls-card ff-card">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search drivers by name, license #, email, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-pill-group">
            {['ALL', 'Active', 'On Leave', 'Inactive'].map((f) => (
              <button
                key={f}
                className={`filter-pill ${statusFilter === f ? 'active' : ''}`}
                onClick={() => setStatusFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Drivers Table */}
        <div className="ff-table-wrapper">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading driver records...
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <UserCheck size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p>No driver profiles found matching the criteria.</p>
            </div>
          ) : (
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Driver Profile</th>
                  <th>License Number</th>
                  <th>Experience</th>
                  <th>Status</th>
                  <th>Assigned Vehicle</th>
                  <th>Monthly Attendance</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((d) => {
                  const isAssigning = assigningDriverId === d.driver_id;
                  const summary = attendanceSummaries[d.driver_id];

                  return (
                    <tr key={d.driver_id}>
                      <td>
                        <div className="user-cell-meta">
                          <div className="driver-avatar-sm">
                            {d.full_name?.charAt(0).toUpperCase() || 'D'}
                          </div>
                          <div>
                            <span className="user-name-title">{d.full_name || 'Driver User'}</span>
                            <span className="user-id-sub">{d.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="license-badge">{d.license_number || 'Pending'}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>
                          <Award size={13} style={{ display: 'inline', marginRight: '4px', color: '#22d3ee' }} />
                          {d.experience_years ?? 0} Yrs
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${getStatusClass(d.status)}`}>
                          {d.status || 'Active'}
                        </span>
                      </td>
                      <td>
                        {canManage ? (
                          <select
                            className="vehicle-assign-select"
                            value={d.assigned_vehicle_id || 'UNASSIGN'}
                            disabled={isAssigning}
                            onChange={(e) => handleVehicleAssignment(d, e.target.value)}
                          >
                            <option value="UNASSIGN">-- Unassigned --</option>
                            {vehicles.map((v) => (
                              <option key={v.vehicle_id} value={v.vehicle_id}>
                                {v.registration_number} ({v.brand || ''} {v.model || ''})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="assigned-veh-tag">
                            {d.assigned_vehicle_registration ? (
                              <>
                                <Truck size={12} /> {d.assigned_vehicle_registration}
                              </>
                            ) : (
                              'Unassigned'
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        {summary && summary.total_days > 0 ? (
                          <div 
                            className="attendance-summary-badge" 
                            title={`Present: ${summary.present_days}, Leave: ${summary.leave_days}, Absent: ${summary.absent_days}`}
                          >
                            <CalendarCheck size={13} style={{ color: '#22d3ee' }} />
                            <span>{summary.present_days}/{summary.total_days} Days Present ({summary.attendance_rate_pct}%)</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No logs this month</span>
                        )}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="action-icon-btn edit-btn"
                              title="Mark Attendance for Driver"
                              onClick={() => handleMarkAttendanceClick(d)}
                            >
                              <CalendarCheck size={16} />
                            </button>
                            <button
                              className="action-icon-btn edit-btn"
                              title="Edit Driver Profile"
                              onClick={() => {
                                setSelectedDriver(d);
                                setIsModalOpen(true);
                              }}
                            >
                              <Edit3 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Driver Registration / Edit Modal */}
      <DriverModal
        isOpen={isModalOpen}
        driver={selectedDriver}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDriver(null);
        }}
        onSaved={fetchData}
      />

      {/* Attendance Marking Modal */}
      <AttendanceModal
        isOpen={isAttModalOpen}
        preselectedDriver={attDriver}
        onClose={() => {
          setIsAttModalOpen(false);
          setAttDriver(null);
        }}
        onSaved={fetchData}
      />
    </div>
  );
}

