import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFuelRecords, getFuelStatsAndTrends, createFuelRecord } from '../api/fuel';
import { getVehicles } from '../api/vehicles';
import { toast } from 'react-toastify';
import { 
  Fuel, 
  Plus, 
  RotateCw, 
  Search, 
  DollarSign, 
  TrendingUp, 
  Gauge, 
  FileText, 
  Truck, 
  Calendar, 
  X,
  Zap
} from 'lucide-react';
import './FuelPage.css';

export default function FuelPage() {
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
  const [stats, setStats] = useState({
    total_fuel_records: 0,
    total_liters_consumed: 0,
    total_fuel_cost: 0,
    average_cost_per_liter: 0,
    monthly_trends: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [modalForm, setModalForm] = useState({
    vehicle_id: '',
    liters: 50.0,
    cost: 85.0,
    odometer_km: 10000.0,
    fuel_type: 'Diesel',
    fuel_station: '',
    receipt_number: '',
    fuel_date: new Date().toISOString().slice(0, 16),
  });

  const isDispatcher = user?.role === 'Dispatcher';
  const canViewAnalytics = user?.role === 'Admin' || user?.role === 'FleetManager';

  useEffect(() => {
    if (isDispatcher) {
      toast.error('Access forbidden: Fuel Management is restricted from Dispatchers.');
      navigate('/dashboard', { replace: true });
    }
  }, [isDispatcher, navigate]);

  const fetchData = useCallback(async () => {
    if (isDispatcher) return;
    setLoading(true);
    try {
      const [fuelRes, vehRes] = await Promise.all([
        getFuelRecords(),
        getVehicles(),
      ]);
      setRecords(fuelRes.data || []);
      setVehicles(vehRes.data || []);

      if (canViewAnalytics) {
        const statsRes = await getFuelStatsAndTrends();
        setStats(statsRes.data || {});
      }
    } catch (err) {
      toast.error('Failed to load fuel records.');
    } finally {
      setLoading(false);
    }
  }, [isDispatcher, canViewAnalytics]);

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
        liters: parseFloat(modalForm.liters) || 0,
        cost: parseFloat(modalForm.cost) || 0,
        odometer_km: parseFloat(modalForm.odometer_km) || 0,
      };
      await createFuelRecord(payload);
      toast.success('Fuel log added successfully.');
      fetchData();
      handleTabChange('history');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add fuel record.');
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const term = searchTerm.toLowerCase();
      const stn = (r.fuel_station || '').toLowerCase();
      const rec = (r.receipt_number || '').toLowerCase();
      const reg = (r.registration_number || r.vehicle_registration || '').toLowerCase();
      return stn.includes(term) || rec.includes(term) || reg.includes(term);
    });
  }, [records, searchTerm]);

  return (
    <div className="fuel-page-wrapper">
      <main className="page-container">
        {/* Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Fuel Consumption & Expenses</h1>
            <p>Track refuels, log expenses, and analyze fuel efficiency trends.</p>
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary" onClick={fetchData} title="Refresh Data">
              <RotateCw size={16} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Internal Tabs */}
        <div className="dashboard-nav-tabs">
          <button className={`dash-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => handleTabChange('overview')}>
            Overview
          </button>
          <button className={`dash-tab-btn ${activeTab === 'add_log' ? 'active' : ''}`} onClick={() => handleTabChange('add_log')}>
            Add Fuel Log
          </button>
          <button className={`dash-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabChange('history')}>
            History ({records.length})
          </button>
        </div>

        {/* ==================================================
            TAB 1: OVERVIEW
            ================================================== */}
        {activeTab === 'overview' && (
          <div className="tab-content-area">
            <div className="kpi-cards-grid">
              <div className="kpi-card ff-card">
                <span className="kpi-label">Total Fuel Cost</span>
                <strong className="kpi-number" style={{ color: '#f59e0b' }}>
                  ${stats.total_fuel_cost?.toLocaleString() || 0}
                </strong>
              </div>
              <div className="kpi-card ff-card">
                <span className="kpi-label">Liters Consumed</span>
                <strong className="kpi-number">{stats.total_liters_consumed?.toLocaleString() || 0} L</strong>
              </div>
              <div className="kpi-card ff-card">
                <span className="kpi-label">Avg Cost / Liter</span>
                <strong className="kpi-number">${stats.average_cost_per_liter?.toFixed(2) || '0.00'}</strong>
              </div>
              <div className="kpi-card ff-card">
                <span className="kpi-label">Total Fuel Logs</span>
                <strong className="kpi-number">{records.length}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            TAB 2: ADD FUEL LOG
            ================================================== */}
        {activeTab === 'add_log' && (
          <div className="tab-content-area">
            <div className="ff-card" style={{ padding: '1.5rem', maxWidth: '700px' }}>
              <h3>Add New Fuel Refuel Log</h3>
              <form onSubmit={handleCreate} style={{ marginTop: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Vehicle *</label>
                  <select
                    className="form-select"
                    value={modalForm.vehicle_id}
                    onChange={(e) => setModalForm({ ...modalForm, vehicle_id: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Vehicle --</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.registration_number} ({v.brand || ''} {v.model || v.vehicle_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Volume (Liters) *</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={modalForm.liters}
                      onChange={(e) => setModalForm({ ...modalForm, liters: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Cost ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={modalForm.cost}
                      onChange={(e) => setModalForm({ ...modalForm, cost: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Odometer Reading (km) *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={modalForm.odometer_km}
                      onChange={(e) => setModalForm({ ...modalForm, odometer_km: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fuel Type</label>
                    <select
                      className="form-select"
                      value={modalForm.fuel_type}
                      onChange={(e) => setModalForm({ ...modalForm, fuel_type: e.target.value })}
                    >
                      <option value="Diesel">Diesel</option>
                      <option value="Petrol">Petrol / Gasoline</option>
                      <option value="CNG">CNG</option>
                      <option value="Electric">Electric (kWh)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">Fuel Station</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Station name"
                      value={modalForm.fuel_station}
                      onChange={(e) => setModalForm({ ...modalForm, fuel_station: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Receipt / Invoice #</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Receipt #"
                      value={modalForm.receipt_number}
                      onChange={(e) => setModalForm({ ...modalForm, receipt_number: e.target.value })}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  <Plus size={16} /> Save Fuel Log
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================
            TAB 3: HISTORY
            ================================================== */}
        {activeTab === 'history' && (
          <div className="tab-content-area">
            <div className="table-controls-card ff-card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
              <div className="search-box">
                <Search size={18} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search fuel station, receipt #, vehicle registration..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="ff-table-wrapper">
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading fuel logs...</div>
              ) : filteredRecords.length === 0 ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                  <Fuel size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p>No fuel records found.</p>
                </div>
              ) : (
                <table className="ff-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Liters</th>
                      <th>Total Cost</th>
                      <th>Odometer</th>
                      <th>Fuel Station</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r) => (
                      <tr key={r.fuel_id || r.id}>
                        <td><strong>{r.registration_number || r.vehicle_registration || 'Vehicle'}</strong></td>
                        <td>{r.liters} L</td>
                        <td className="font-semibold" style={{ color: '#f59e0b' }}>${r.cost}</td>
                        <td>{r.odometer_km} km</td>
                        <td>{r.fuel_station || 'Standard Station'}</td>
                        <td>{r.fuel_date ? new Date(r.fuel_date).toLocaleDateString() : '--'}</td>
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
