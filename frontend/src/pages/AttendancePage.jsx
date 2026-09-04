import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getFleetAttendance,
  getDriverAttendanceHistory,
  getDriverAttendanceSummary,
  getMyAttendanceSummary,
  getMyAttendanceHistory,
  markAttendance,
  markMyAttendance
} from '../api/attendance';
import { getDrivers } from '../api/drivers';
import AttendanceModal from '../components/attendance/AttendanceModal';
import { toast } from 'react-toastify';
import {
  CalendarCheck,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  RotateCw,
  Search,
  Filter,
  Plus,
  TrendingUp,
  Award,
  AlertCircle
} from 'lucide-react';
import './AttendancePage.css';

export default function AttendancePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const role = user?.role || 'Driver';
  const isAdminOrManager = role === 'Admin' || role === 'FleetManager';
  const isDriver = role === 'Driver';

  // Default active tab based on role
  const initialTab = searchParams.get('tab') || (isDriver ? 'my_attendance' : 'overview');
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync state with URL search param
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  // Common State
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  
  // Data States
  const [fleetAttendance, setFleetAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverHistory, setDriverHistory] = useState([]);
  const [driverSummary, setDriverSummary] = useState(null);
  
  // Driver Personal Attendance States
  const [myHistory, setMyHistory] = useState([]);
  const [mySummary, setMySummary] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [targetDriverForMark, setTargetDriverForMark] = useState(null);

  // Fetch Drivers list for Admin/Manager dropdown
  useEffect(() => {
    if (isAdminOrManager) {
      getDrivers()
        .then((res) => {
          const list = res.data || [];
          setDrivers(list);
          if (list.length > 0 && !selectedDriverId) {
            setSelectedDriverId(list[0].driver_id || list[0].id);
          }
        })
        .catch((err) => console.error('Failed to fetch drivers', err));
    }
  }, [isAdminOrManager]);

  // Main Data Fetcher based on Active Tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdminOrManager) {
        if (activeTab === 'overview' || activeTab === 'daily') {
          const res = await getFleetAttendance({ date: selectedDate });
          setFleetAttendance(res.data || []);
        } else if (activeTab === 'history' && selectedDriverId) {
          const [histRes, sumRes] = await Promise.all([
            getDriverAttendanceHistory(selectedDriverId),
            getDriverAttendanceSummary(selectedDriverId)
          ]);
          setDriverHistory(histRes.data || []);
          setDriverSummary(sumRes.data || null);
        }
      } else if (isDriver) {
        const [myHistRes, mySumRes] = await Promise.all([
          getMyAttendanceHistory(),
          getMyAttendanceSummary()
        ]);
        setMyHistory(myHistRes.data || []);
        setMySummary(mySumRes.data || null);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, isAdminOrManager, isDriver, selectedDate, selectedDriverId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Metrics for Admin/Manager Overview
  const totalFleetCount = drivers.length || fleetAttendance.length;
  const presentCount = fleetAttendance.filter(a => a.status === 'Present' || a.status === 'On Time').length;
  const absentCount = fleetAttendance.filter(a => a.status === 'Absent').length;
  const leaveCount = fleetAttendance.filter(a => a.status === 'Leave' || a.status === 'Approved Leave').length;
  const attendanceRate = totalFleetCount > 0 ? Math.round((presentCount / totalFleetCount) * 100) : 0;

  // Filtered Daily Attendance Table
  const filteredDailyAttendance = fleetAttendance.filter(record => {
    const nameMatch = (record.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === 'ALL' || record.status?.toUpperCase() === statusFilter.toUpperCase();
    return nameMatch && statusMatch;
  });

  const handleDriverCheckIn = async () => {
    try {
      await markMyAttendance({ status_val: 'Present', remarks: 'Self check-in via FleetFlow' });
      toast.success('Successfully marked Present for today!');
      fetchData();
    } catch (err) {
      console.error('Failed to mark attendance:', err);
      toast.error(err.response?.data?.detail || 'Failed to mark attendance for today.');
    }
  };

  return (
    <div className="attendance-page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CalendarCheck className="title-icon" size={28} />
            Attendance Management
          </h1>
          <p className="page-subtitle">Track and manage driver attendance records, daily status, and leave reflections.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isDriver && (
            <button className="btn btn-primary" onClick={handleDriverCheckIn} title="Mark Present for Today">
              <UserCheck size={18} />
              <span>Check In Today</span>
            </button>
          )}
          {isAdminOrManager && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setTargetDriverForMark(null);
                setIsMarkModalOpen(true);
              }}
              title="Log Driver Attendance"
            >
              <Plus size={18} />
              <span>Log Attendance</span>
            </button>
          )}
          <button className="refresh-btn" onClick={fetchData} title="Refresh Attendance Data">
            <RotateCw size={18} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Internal Tabs Navigation */}
      <div className="attendance-tabs-bar">
        {isAdminOrManager && (
          <>
            <button
              className={`att-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => handleTabChange('overview')}
            >
              Overview
            </button>
            <button
              className={`att-tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
              onClick={() => handleTabChange('daily')}
            >
              Daily Attendance
            </button>
            <button
              className={`att-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => handleTabChange('history')}
            >
              Driver History
            </button>
          </>
        )}

        {isDriver && (
          <button
            className={`att-tab-btn ${activeTab === 'my_attendance' ? 'active' : ''}`}
            onClick={() => handleTabChange('my_attendance')}
          >
            My Attendance
          </button>
        )}
      </div>

      {/* Tab Contents */}

      {/* 1. ADMIN / MANAGER OVERVIEW TAB */}
      {isAdminOrManager && activeTab === 'overview' && (
        <div className="att-tab-content">
          {/* Stat Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon-wrapper blue">
                <UserCheck size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-label">Present Today</span>
                <span className="stat-value">{presentCount}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper red">
                <UserX size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-label">Absent Today</span>
                <span className="stat-value">{absentCount}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper orange">
                <Calendar size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-label">On Leave Today</span>
                <span className="stat-value">{leaveCount}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper green">
                <TrendingUp size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-label">Fleet Attendance Rate</span>
                <span className="stat-value">{attendanceRate}%</span>
              </div>
            </div>
          </div>

          {/* Today's Overview Table */}
          <div className="att-section-card">
            <div className="section-card-header">
              <h3>Today's Attendance Status ({selectedDate})</h3>
            </div>
            {loading ? (
              <div className="att-loading">Loading attendance summary...</div>
            ) : fleetAttendance.length === 0 ? (
              <div className="att-empty">No attendance records logged for today yet.</div>
            ) : (
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Driver Name</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                  </tr>
                </thead>
                <tbody>
                  {fleetAttendance.slice(0, 8).map((rec, idx) => (
                    <tr key={rec.id || idx}>
                      <td className="font-semibold">{rec.driver_name || 'Driver'}</td>
                      <td>{rec.date}</td>
                      <td>
                        <span className={`status-badge badge-${(rec.status || 'absent').toLowerCase()}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>{rec.check_in || '--:--'}</td>
                      <td>{rec.check_out || '--:--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 2. ADMIN / MANAGER DAILY ATTENDANCE TAB */}
      {isAdminOrManager && activeTab === 'daily' && (
        <div className="att-tab-content">
          <div className="att-toolbar">
            <div className="toolbar-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search driver by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="toolbar-controls">
              <input
                type="date"
                className="date-picker-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="LEAVE">On Leave</option>
              </select>
            </div>
          </div>

          <div className="att-section-card">
            {loading ? (
              <div className="att-loading">Fetching attendance records...</div>
            ) : filteredDailyAttendance.length === 0 ? (
              <div className="att-empty">No records found matching your filters.</div>
            ) : (
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Driver Name</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDailyAttendance.map((rec) => (
                    <tr key={rec.id || rec.driver_id}>
                      <td className="font-semibold">{rec.driver_name || 'Driver'}</td>
                      <td>{rec.date}</td>
                      <td>
                        <span className={`status-badge badge-${(rec.status || 'absent').toLowerCase()}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>{rec.remarks || 'Database record'}</td>
                      <td>
                        <button
                          className="btn-action-sm"
                          onClick={() => {
                            setTargetDriverForMark({
                              driver_id: rec.driver_id,
                              full_name: rec.driver_name
                            });
                            setIsMarkModalOpen(true);
                          }}
                        >
                          Log / Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 3. ADMIN / MANAGER DRIVER HISTORY TAB */}
      {isAdminOrManager && activeTab === 'history' && (
        <div className="att-tab-content">
          <div className="driver-selector-bar">
            <label htmlFor="driver-select" className="font-semibold">Select Driver:</label>
            <select
              id="driver-select"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="driver-select-dropdown"
            >
              {drivers.map((d) => (
                <option key={d.driver_id || d.id} value={d.driver_id || d.id}>
                  {d.full_name || d.user?.full_name || 'Unknown Driver'}
                </option>
              ))}
            </select>
          </div>

          {/* Driver Summary Metrics */}
          {driverSummary && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Total Days Recorded</span>
                  <span className="stat-value">{driverSummary.total_days || 0}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Days Present</span>
                  <span className="stat-value">{driverSummary.present_days || 0}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-details">
                  <span className="stat-label">Days On Leave</span>
                  <span className="stat-value">{driverSummary.leave_days || 0}</span>
                </div>
              </div>
            </div>
          )}

          <div className="att-section-card">
            <h3>Attendance Log History</h3>
            {loading ? (
              <div className="att-loading">Loading driver history...</div>
            ) : driverHistory.length === 0 ? (
              <div className="att-empty">No historical records found for this driver.</div>
            ) : (
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Hours Recorded</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {driverHistory.map((h, i) => (
                    <tr key={h.id || i}>
                      <td>{h.date}</td>
                      <td>
                        <span className={`status-badge badge-${(h.status || 'absent').toLowerCase()}`}>
                          {h.status}
                        </span>
                      </td>
                      <td>{h.hours_worked || '--'} hrs</td>
                      <td>{h.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 4. DRIVER MY ATTENDANCE TAB */}
      {isDriver && activeTab === 'my_attendance' && (
        <div className="att-tab-content">
          {/* Driver Personal Summary */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon-wrapper blue">
                <UserCheck size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-label">Present Days</span>
                <span className="stat-value">{mySummary?.present_days || 0}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper orange">
                <Calendar size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-label">Approved Leave Days</span>
                <span className="stat-value">{mySummary?.leave_days || 0}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-wrapper green">
                <Award size={24} />
              </div>
              <div className="stat-details">
                <span className="stat-label">Attendance Rate</span>
                <span className="stat-value">{mySummary?.attendance_rate || 100}%</span>
              </div>
            </div>
          </div>

          <div className="att-section-card">
            <h3>My Attendance History</h3>
            {loading ? (
              <div className="att-loading">Loading your attendance records...</div>
            ) : myHistory.length === 0 ? (
              <div className="att-empty">No attendance records found for your profile.</div>
            ) : (
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {myHistory.map((rec, i) => (
                    <tr key={rec.id || i}>
                      <td className="font-semibold">{rec.date}</td>
                      <td>
                        <span className={`status-badge badge-${(rec.status || 'absent').toLowerCase()}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>{rec.check_in || '--:--'}</td>
                      <td>{rec.check_out || '--:--'}</td>
                      <td>{rec.remarks || (rec.status === 'Leave' ? 'Approved Leave' : 'Standard Log')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* DISPATCHER RESTRICTED VIEW */}
      {!isAdminOrManager && !isDriver && (
        <div className="att-restricted-box">
          <AlertCircle size={36} color="#f59e0b" />
          <h2>Attendance Management Restricted</h2>
          <p>Attendance tracking and management is restricted to Fleet Managers, Admins, and Drivers for personal records.</p>
        </div>
      )}

      {/* Attendance Logging Modal */}
      {isMarkModalOpen && (
        <AttendanceModal
          isOpen={isMarkModalOpen}
          onClose={() => {
            setIsMarkModalOpen(false);
            setTargetDriverForMark(null);
          }}
          preselectedDriver={targetDriverForMark}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
