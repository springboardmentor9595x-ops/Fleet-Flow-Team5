import React, { useState, useEffect, useCallback } from 'react';
import VehicleModal from '../components/vehicles/VehicleModal';
import { getVehicles, getVehicleStats, deleteVehicle } from '../api/vehicles';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  Truck, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Wrench 
} from 'lucide-react';
import './VehiclesPage.css';

import { useSearchParams } from 'react-router-dom';

export default function VehiclesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'ALL';
  const [statusFilter, setStatusFilter] = useState(currentTab);
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState({ total: 0, available: 0, in_transit: 0, maintenance: 0, out_of_service: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const handleTabChange = (tabId) => {
    setStatusFilter(tabId);
    setSearchParams({ tab: tabId });
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const canManage = user?.role === 'Admin' || user?.role === 'FleetManager';
  const canViewStats = user?.role === 'Admin' || user?.role === 'FleetManager';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchPromises = [getVehicles(statusFilter !== 'ALL' ? { status: statusFilter } : {})];
      if (canViewStats) {
        fetchPromises.push(getVehicleStats());
      }
      const results = await Promise.all(fetchPromises);
      setVehicles(results[0].data);
      if (canViewStats && results[1]) {
        setStats(results[1].data);
      }
    } catch (err) {
      toast.error('Failed to load fleet vehicles.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, canViewStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (vehicleId, regNum) => {
    if (!window.confirm(`Are you sure you want to delete vehicle ${regNum}?`)) return;
    try {
      await deleteVehicle(vehicleId);
      toast.success(`Vehicle ${regNum} deleted.`);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete vehicle.');
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const term = searchTerm.toLowerCase();
    const reg = (v.registration_number || '').toLowerCase();
    const brand = (v.brand || '').toLowerCase();
    const model = (v.model || '').toLowerCase();
    const type = (v.vehicle_type || '').toLowerCase();
    return reg.includes(term) || brand.includes(term) || model.includes(term) || type.includes(term);
  });

  const getStatusClass = (status) => {
    const s = (status || '').toLowerCase().replace(/ /g, '');
    if (s === 'available') return 'status-available';
    if (s === 'intransit') return 'status-intransit';
    if (s === 'maintenance') return 'status-maintenance';
    return 'status-outofservice';
  };

  return (
    <div className="vehicles-page-wrapper">
      <main className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1>Fleet Vehicle Management</h1>
            <p>Monitor, configure and assign vehicles across your distribution network</p>
          </div>

          {canManage && (
            <div className="header-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedVehicle(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus size={18} />
                <span>Add Vehicle</span>
              </button>
            </div>
          )}
        </div>

        {/* Status Count Metric Cards (Admin & FleetManager) */}
        {canViewStats && (
          <div className="fleet-stats-grid">
            <div className="stat-card">
              <div className="stat-icon total-icon">
                <Truck size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Fleet</span>
                <span className="stat-value">{stats.total}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon avail-icon">
                <CheckCircle2 size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Available</span>
                <span className="stat-value">{stats.available}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon transit-icon">
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">In Transit</span>
                <span className="stat-value">{stats.in_transit}</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon maint-icon">
                <Wrench size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Maintenance</span>
                <span className="stat-value">{stats.maintenance}</span>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="table-controls-card ff-card">
          <div className="search-box">
            <Search size={18} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Search by plate, brand, model, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="status-filter-tabs">
            {['ALL', 'Available', 'Assigned', 'In Transit', 'Maintenance'].map((tab) => (
              <button
                key={tab}
                className={`filter-tab ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => handleTabChange(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle Table */}
        <div className="ff-table-wrapper">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading fleet vehicles...
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Truck size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p>{searchTerm || statusFilter !== 'ALL' ? 'No vehicles found matching your criteria.' : 'No vehicles found.'}</p>
            </div>
          ) : (
            <table className="ff-table">
              <thead>
                <tr>
                  <th>Plate / Registration</th>
                  <th>Type</th>
                  <th>Make & Model</th>
                  <th>Year</th>
                  <th>Fuel</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v) => (
                  <tr key={v.vehicle_id}>
                    <td>
                      <span className="plate-badge">{v.registration_number}</span>
                    </td>
                    <td>{v.vehicle_type || 'Truck'}</td>
                    <td>
                      <div className="vehicle-model-cell">
                        <strong>{v.brand || 'Standard'}</strong> {v.model || ''}
                      </div>
                    </td>
                    <td>{v.manufacture_year || '—'}</td>
                    <td>
                      <span className="fuel-pill">{v.fuel_type || 'Diesel'}</span>
                    </td>
                    <td>{v.capacity ? `${v.capacity.toLocaleString()} kg` : '—'}</td>
                    <td>
                      <span className={`status-pill ${getStatusClass(v.status)}`}>
                        {v.status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-group">
                          <button
                            className="action-icon-btn edit-btn"
                            title="Edit Vehicle"
                            onClick={() => {
                              setSelectedVehicle(v);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            className="action-icon-btn delete-btn"
                            title="Delete Vehicle"
                            onClick={() => handleDelete(v.vehicle_id, v.registration_number)}
                          >
                            <Trash2 size={16} />
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

      {/* Add / Edit Modal */}
      <VehicleModal
        isOpen={isModalOpen}
        vehicle={selectedVehicle}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVehicle(null);
        }}
        onSaved={fetchData}
      />
    </div>
  );
}
