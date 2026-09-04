import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  getMaintenance, 
  getMaintenanceStats, 
  createMaintenance, 
  updateMaintenanceStatus, 
  deleteMaintenance,
  triggerMaintenanceAlerts
} from '../api/maintenance';
import { getVehicles } from '../api/vehicles';
import { toast } from 'react-toastify';
import { 
  Wrench, 
  Plus, 
  RotateCw, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  Trash2, 
  CheckSquare, 
  X,
  BellRing,
  ShieldAlert
} from 'lucide-react';
import './MaintenancePage.css';

export default function MaintenancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(currentTab);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState({ total_records: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0, total_cost: 0 });
  const [loading, setLoading] = useState(true);
  const [triggeringAlerts, setTriggeringAlerts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    vehicle_id: '',
    service_type: 'Oil & Filter Change',
    description: '',
    cost: 150.0,
    service_date: new Date().toISOString().slice(0, 10),
    next_service_date: '',
    status: 'Scheduled',
    service_center: '',
    performed_by: '',
  });

  const canManage = user?.role === 'Admin' || user?.role === 'FleetManager';
  const isDispatcher = user?.role === 'Dispatcher';
  const isDriver = user?.role === 'Driver';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let params = {};
      if (activeTab === 'scheduled') params.status = 'Scheduled';
      else if (activeTab === 'in_progress') params.status = 'In Progress';
      else if (activeTab === 'completed') params.status = 'Completed';

      const [maintRes, vehRes] = await Promise.all([
        getMaintenance(params),
        getVehicles(),
      ]);

      let recordList = maintRes.data || [];

      // If Driver, filter records for driver's assigned vehicle if available
      if (isDriver && user?.assigned_vehicle_id) {
        recordList = recordList.filter(r => r.vehicle_id === user.assigned_vehicle_id);
      }

      setRecords(recordList);
      setVehicles(vehRes.data || []);

      if (canManage) {
        const statsRes = await getMaintenanceStats();
        setStats(statsRes.data || {});
      }
    } catch (err) {
      toast.error('Failed to load maintenance records.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, canManage, isDriver, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!modalForm.vehicle_id) {
      toast.warning('Please select a vehicle.');
      return;
    }
    try {
      const payload = {
        ...modalForm,
        cost: parseFloat(modalForm.cost) || 0,
        next_service_date: modalForm.next_service_date || null,
      };
      await createMaintenance(payload);
      toast.success('Maintenance record created.');
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create record.');
    }
  };

  const handleStatusUpdate = async (maintenance_id, newStatus) => {
    if (!canManage) return;
    try {
      await updateMaintenanceStatus(maintenance_id, newStatus);
      toast.success(`Status updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const handleDelete = async (maintenance_id) => {
    if (!canManage) return;
    if (!window.confirm('Delete this maintenance record?')) return;
    try {
      await deleteMaintenance(maintenance_id);
      toast.info('Record deleted.');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete record.');
    }
  };

  const handleAlertTrigger = async () => {
    if (!canManage) return;
    setTriggeringAlerts(true);
    try {
      const res = await triggerMaintenanceAlerts();
      toast.info(res.data.message || 'Alert check completed.');
      fetchData();
    } catch (err) {
      toast.error('Failed to trigger maintenance alerts.');
    } finally {
      setTriggeringAlerts(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const term = searchTerm.toLowerCase();
      const typeStr = (r.service_type || '').toLowerCase();
      const descStr = (r.description || '').toLowerCase();
      const regStr = (r.registration_number || r.vehicle_registration || '').toLowerCase();
      return typeStr.includes(term) || descStr.includes(term) || regStr.includes(term);
    });
  }, [records, searchTerm]);

  return (
    <div className="maintenance-page-wrapper">
      <main className="page-container">
        {/* Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Fleet Maintenance & Service Management</h1>
            <p>
              {isDispatcher || isDriver ? 'Read-only view of vehicle maintenance records & service status' : 'Schedule preventive care, track repairs, and monitor maintenance costs'}
            </p>
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary" onClick={fetchData} title="Refresh Records">
              <RotateCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            {canManage && (
              <>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleAlertTrigger} 
                  disabled={triggeringAlerts} 
                  title="Check Odometer & Due Dates for Service Alerts"
                >
                  <BellRing size={16} className={triggeringAlerts ? 'spin' : ''} />
                  <span>Check Service Alerts</span>
                </button>

                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={16} />
                  <span>Log Service</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Internal Tabs */}
        <div className="dashboard-nav-tabs">
          <button className={`dash-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => handleTabChange('overview')}>
            Overview
          </button>
          <button className={`dash-tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`} onClick={() => handleTabChange('scheduled')}>
            Scheduled
          </button>
          <button className={`dash-tab-btn ${activeTab === 'in_progress' ? 'active' : ''}`} onClick={() => handleTabChange('in_progress')}>
            In Progress
          </button>
          <button className={`dash-tab-btn ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => handleTabChange('completed')}>
            Completed
          </button>
          <button className={`dash-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabChange('history')}>
            History
          </button>
        </div>

        {/* Overview Stat Cards (Shown on Overview tab) */}
        {activeTab === 'overview' && canManage && (
          <div className="kpi-cards-grid">
            <div className="kpi-card ff-card">
              <span className="kpi-label">Total Records</span>
              <strong className="kpi-number">{stats.total_records || 0}</strong>
            </div>
            <div className="kpi-card ff-card">
              <span className="kpi-label">Scheduled Services</span>
              <strong className="kpi-number" style={{ color: '#38bdf8' }}>{stats.scheduled || 0}</strong>
            </div>
            <div className="kpi-card ff-card">
              <span className="kpi-label">In Progress Repairs</span>
              <strong className="kpi-number" style={{ color: '#f59e0b' }}>{stats.in_progress || 0}</strong>
            </div>
            <div className="kpi-card ff-card">
              <span className="kpi-label">Completed Services</span>
              <strong className="kpi-number" style={{ color: '#22c55e' }}>{stats.completed || 0}</strong>
            </div>
          </div>
        )}

        {/* Read-only Notice for Dispatcher and Driver */}
        {(isDispatcher || isDriver) && (
          <div className="dashboard-alert-banner" style={{ marginBottom: '1rem' }}>
            <ShieldAlert size={20} />
            <div>
              <strong>Read-Only Access:</strong>
              <p>{isDriver ? 'Displaying maintenance records for your assigned vehicle.' : 'Dispatcher view is restricted to read-only maintenance monitoring.'}</p>
            </div>
          </div>
        )}

        {/* Toolbar Search */}
        <div className="table-controls-card ff-card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
          <div className="search-box">
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search service type, registration, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Records Table */}
        <div className="ff-table-wrapper">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading maintenance logs...</div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
              <Wrench size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>No maintenance records found matching your filters.</p>
            </div>
          ) : (
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Service Type</th>
                  <th>Service Date</th>
                  <th>Cost</th>
                  <th>Status</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.maintenance_id || r.id}>
                    <td>
                      <strong>{r.registration_number || r.vehicle_registration || 'Vehicle'}</strong>
                    </td>
                    <td>
                      <div>{r.service_type}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{r.description || 'Routine check'}</div>
                    </td>
                    <td>{r.service_date}</td>
                    <td className="font-semibold" style={{ color: '#f59e0b' }}>${r.cost}</td>
                    <td>
                      <span className={`status-pill status-${(r.status || '').toLowerCase().replace(/\s+/g, '')}`}>
                        {r.status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {r.status === 'Scheduled' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleStatusUpdate(r.maintenance_id, 'In Progress')}>
                              Start
                            </button>
                          )}
                          {r.status === 'In Progress' && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(r.maintenance_id, 'Completed')}>
                              Complete
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.maintenance_id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Log Service Modal (Only for Admin/Manager) */}
      {showModal && canManage && (
        <div className="modal-overlay">
          <div className="modal-content ff-card">
            <div className="modal-header">
              <h2>Log Maintenance Service</h2>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Vehicle *</label>
                <select
                  className="form-select"
                  value={modalForm.vehicle_id}
                  onChange={(e) => setModalForm({ ...modalForm, vehicle_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.registration_number} ({v.brand || ''} {v.model || v.vehicle_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Service Type *</label>
                <input
                  type="text"
                  className="form-input"
                  value={modalForm.service_type}
                  onChange={(e) => setModalForm({ ...modalForm, service_type: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Cost ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={modalForm.cost}
                    onChange={(e) => setModalForm({ ...modalForm, cost: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={modalForm.service_date}
                    onChange={(e) => setModalForm({ ...modalForm, service_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Description / Remarks</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={modalForm.description}
                  onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
